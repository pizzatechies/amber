import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, open, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
import type { ByteRange, ChunkInput, StorageDriver } from "./types";

/** Stores files under a directory on the server's disk. */
export class LocalStorage implements StorageDriver {
  readonly name = "local" as const;
  private readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  /** Absolute path for a key, refusing anything that would escape the root. */
  private resolve(key: string): string {
    const full = path.resolve(this.root, key);
    if (full !== this.root && !full.startsWith(this.root + path.sep)) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    return full;
  }

  private partPath(key: string): string {
    return this.resolve(path.join(".uploads", key.replace(/[\\/]/g, "__") + ".part"));
  }

  async beginUpload(key: string): Promise<string> {
    const part = this.partPath(key);
    await mkdir(path.dirname(part), { recursive: true });
    await writeFile(part, Buffer.alloc(0));
    return "";
  }

  async writeChunk({ key, offset, body }: ChunkInput): Promise<void> {
    const part = this.partPath(key);
    // Drop anything past `offset` left behind by an interrupted attempt, so a
    // retried chunk always lands on a clean boundary.
    const handle = await open(part, "r+");
    try {
      await handle.truncate(offset);
    } finally {
      await handle.close();
    }
    await pipeline(body, createWriteStream(part, { flags: "r+", start: offset }));
  }

  async completeUpload(key: string): Promise<void> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await rename(this.partPath(key), target);
  }

  async abortUpload(key: string): Promise<void> {
    await rm(this.partPath(key), { force: true });
  }

  async put(key: string, data: Buffer): Promise<void> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
  }

  async size(key: string): Promise<number | null> {
    try {
      const info = await stat(this.resolve(key));
      return info.isFile() ? info.size : null;
    } catch {
      return null;
    }
  }

  async read(key: string, range?: ByteRange): Promise<Readable> {
    return createReadStream(this.resolve(key), range ? { start: range.start, end: range.end } : undefined);
  }

  async remove(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  async signedUrl(): Promise<string | null> {
    return null;
  }
}
