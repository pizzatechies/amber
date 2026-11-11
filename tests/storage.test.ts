import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterAll, describe, expect, it } from "vitest";
import { LocalStorage } from "@/lib/storage/local";
import { S3Storage } from "@/lib/storage/s3";
import type { StorageDriver } from "@/lib/storage/types";

async function readAll(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks);
}

/** The behaviour every storage driver has to provide. */
function contract(name: string, make: () => Promise<StorageDriver>, chunkSize: number) {
  describe(name, () => {
    const key = `test/${Date.now()}-${Math.random().toString(36).slice(2)}.bin`;
    const data = Buffer.alloc(chunkSize * 2 + 1234);
    for (let i = 0; i < data.length; i++) data[i] = (i * 31) % 251;

    it("stores a file sent in chunks, even when a chunk is retried", async () => {
      const store = await make();
      const uploadId = await store.beginUpload(key, "application/octet-stream");
      const send = (offset: number) => {
        const body = data.subarray(offset, offset + chunkSize);
        return store.writeChunk({ key, uploadId, offset, partNumber: offset / chunkSize + 1, body: Readable.from([body]), length: body.length });
      };
      await send(0);
      await send(chunkSize);
      await send(chunkSize); // the client retries a chunk whose response was lost
      await send(chunkSize * 2);
      await store.completeUpload(key, uploadId);

      expect(await store.size(key)).toBe(data.length);
      expect((await readAll(await store.read(key))).equals(data)).toBe(true);
    });

    it("reads byte ranges", async () => {
      const store = await make();
      const part = await readAll(await store.read(key, { start: 100, end: 199 }));
      expect(part.equals(data.subarray(100, 200))).toBe(true);
    });

    it("puts, sizes and removes small objects", async () => {
      const store = await make();
      const small = `${key}.txt`;
      await store.put(small, Buffer.from("hello"), "text/plain");
      expect(await store.size(small)).toBe(5);
      await store.remove(small);
      expect(await store.size(small)).toBeNull();
      await store.remove(key);
      expect(await store.size(key)).toBeNull();
    });

    it("discards an aborted upload", async () => {
      const store = await make();
      const aborted = `${key}.aborted`;
      const uploadId = await store.beginUpload(aborted, "application/octet-stream");
      await store.abortUpload(aborted, uploadId);
      expect(await store.size(aborted)).toBeNull();
    });
  });
}

let dir: string | undefined;
afterAll(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

contract(
  "local disk storage",
  async () => {
    dir ??= await mkdtemp(path.join(tmpdir(), "amber-storage-"));
    return new LocalStorage(dir);
  },
  64 * 1024,
);

describe("local disk storage safety", () => {
  it("refuses keys that escape the upload directory", async () => {
    dir ??= await mkdtemp(path.join(tmpdir(), "amber-storage-"));
    const store = new LocalStorage(dir);
    await expect(store.put("../outside.txt", Buffer.from("x"), "text/plain")).rejects.toThrow(/Invalid storage key/);
    await expect(readFile(path.join(dir, "..", "outside.txt"))).rejects.toThrow();
  });
});

// Runs only when an S3-compatible endpoint is provided, e.g. a local MinIO:
//   S3_TEST_ENDPOINT=http://127.0.0.1:9000 S3_TEST_BUCKET=test npm test
const endpoint = process.env.S3_TEST_ENDPOINT;
if (endpoint) {
  contract(
    "S3 storage",
    async () =>
      new S3Storage({
        bucket: process.env.S3_TEST_BUCKET ?? "test",
        region: "us-east-1",
        endpoint,
        forcePathStyle: true,
        accessKeyId: process.env.S3_TEST_ACCESS_KEY ?? "test",
        secretAccessKey: process.env.S3_TEST_SECRET_KEY ?? "test",
      }),
    5 * 1024 * 1024, // S3's minimum part size
  );
}
