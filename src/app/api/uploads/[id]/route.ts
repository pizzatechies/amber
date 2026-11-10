import { Readable, Transform } from "node:stream";
import type { ReadableStream as NodeWebStream } from "node:stream/web";
import { getCurrentUser } from "@/lib/auth/session";
import { deleteAssets } from "@/lib/assets";
import { db } from "@/lib/db";
import { isSameOrigin, json, jsonError } from "@/lib/http";
import { storage } from "@/lib/storage";
import { UPLOAD_CHUNK_BYTES } from "@/lib/storage/files";

type Ctx = { params: Promise<{ id: string }> };

async function ownedUpload(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: jsonError("Please sign in to upload files.", 401) } as const;
  const asset = await db.asset.findFirst({ where: { id, ownerId: user.id } });
  if (!asset) return { error: jsonError("Upload not found.", 404) } as const;
  return { asset, user } as const;
}

/** Upload progress, used by the client to resume after an interruption. */
export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const found = await ownedUpload(id);
  if ("error" in found) return found.error;
  const { asset } = found;
  return json({
    status: asset.status,
    uploadedBytes: Number(asset.uploadedBytes),
    sizeBytes: Number(asset.sizeBytes),
  });
}

/** Fails the stream if the body is not exactly `expected` bytes long. */
function exactLength(expected: number): Transform {
  let seen = 0;
  return new Transform({
    transform(chunk: Buffer, _enc, done) {
      seen += chunk.length;
      if (seen > expected) return done(new Error("Chunk is larger than declared."));
      done(null, chunk);
    },
    flush(done) {
      done(seen === expected ? null : new Error("Chunk is smaller than declared."));
    },
  });
}

/** Store one chunk: PUT /api/uploads/:id?offset=<bytes> with the raw bytes as the body. */
export async function PUT(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return jsonError("Cross-site request blocked.", 403);
  const { id } = await params;
  const found = await ownedUpload(id);
  if ("error" in found) return found.error;
  const { asset } = found;
  if (asset.status !== "UPLOADING") return jsonError("This upload is already complete.", 409);

  const total = Number(asset.sizeBytes);
  const uploaded = Number(asset.uploadedBytes);
  const offset = Number(new URL(request.url).searchParams.get("offset"));
  const length = Number(request.headers.get("content-length"));

  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(length) || length <= 0) {
    return jsonError("Invalid chunk: offset and Content-Length are required.", 400);
  }
  // Chunks sit on fixed boundaries. A chunk may be re-sent (offset < uploaded)
  // when its response was lost, but never skipped ahead.
  if (offset % UPLOAD_CHUNK_BYTES !== 0 || offset > uploaded) {
    return json({ error: "Chunk is out of sequence.", uploadedBytes: uploaded }, 409);
  }
  const isLast = offset + length === total;
  if (offset + length > total || length > UPLOAD_CHUNK_BYTES || (!isLast && length !== UPLOAD_CHUNK_BYTES)) {
    return jsonError("Invalid chunk size.", 400);
  }
  if (!request.body) return jsonError("Missing request body.", 400);

  const body = Readable.fromWeb(request.body as unknown as NodeWebStream<Uint8Array>).pipe(exactLength(length));
  try {
    await storage().writeChunk({
      key: asset.storageKey,
      uploadId: asset.uploadId,
      offset,
      partNumber: offset / UPLOAD_CHUNK_BYTES + 1,
      body,
      length,
    });
  } catch (err) {
    console.error("[uploads] chunk failed:", err);
    return json({ error: "The chunk could not be stored. Please retry.", uploadedBytes: uploaded }, 500);
  }

  const uploadedBytes = offset + length;
  await db.asset.update({ where: { id: asset.id }, data: { uploadedBytes: BigInt(uploadedBytes) } });
  return json({ uploadedBytes });
}

/** Finish the upload once every byte has arrived. */
export async function POST(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return jsonError("Cross-site request blocked.", 403);
  const { id } = await params;
  const found = await ownedUpload(id);
  if ("error" in found) return found.error;
  const { asset } = found;

  if (asset.status === "UPLOADING") {
    if (asset.uploadedBytes !== asset.sizeBytes) {
      return json({ error: "The upload is incomplete.", uploadedBytes: Number(asset.uploadedBytes) }, 409);
    }
    await storage().completeUpload(asset.storageKey, asset.uploadId);
    const stored = await storage().size(asset.storageKey);
    if (stored !== Number(asset.sizeBytes)) {
      await deleteAssets([asset.id]);
      return jsonError("The stored file did not match what was sent. Please upload it again.", 422);
    }
    await db.asset.update({ where: { id: asset.id }, data: { status: "READY", uploadId: "" } });
  }

  return json({
    asset: {
      id: asset.id,
      kind: asset.kind,
      filename: asset.filename,
      sizeBytes: Number(asset.sizeBytes),
      durationSec: asset.durationSec,
    },
  });
}

/** Cancel an upload, or discard a finished file that was never attached to anything. */
export async function DELETE(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return jsonError("Cross-site request blocked.", 403);
  const { id } = await params;
  const found = await ownedUpload(id);
  if ("error" in found) return found.error;

  const attached = await db.asset.findFirst({
    where: {
      id,
      OR: [
        { avatarOf: { isNot: null } },
        { thumbnailOf: { isNot: null } },
        { promoOf: { isNot: null } },
        { lecture: { isNot: null } },
        { resource: { isNot: null } },
      ],
    },
    select: { id: true },
  });
  if (attached) return jsonError("This file is in use. Remove it from where it is used instead.", 409);

  await deleteAssets([id]);
  return new Response(null, { status: 204 });
}
