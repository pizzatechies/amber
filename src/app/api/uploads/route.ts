import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getCurrentUser, isInstructor } from "@/lib/auth/session";
import { rateLimit } from "@/lib/auth/rate-limit";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { isSameOrigin, json, jsonError } from "@/lib/http";
import { storage } from "@/lib/storage";
import {
  UPLOAD_CHUNK_BYTES,
  allowedExtensions,
  contentTypeFor,
  fileExtension,
  sanitizeFilename,
  type AssetKindName,
} from "@/lib/storage/files";
import { formatBytes } from "@/lib/format";

const PURPOSES = {
  avatar: { kind: "IMAGE", isPublic: true, instructorOnly: false },
  thumbnail: { kind: "IMAGE", isPublic: true, instructorOnly: true },
  promo: { kind: "VIDEO", isPublic: false, instructorOnly: true },
  "lecture-video": { kind: "VIDEO", isPublic: false, instructorOnly: true },
  "lecture-document": { kind: "FILE", isPublic: false, instructorOnly: true },
  resource: { kind: "FILE", isPublic: false, instructorOnly: true },
} as const satisfies Record<string, { kind: AssetKindName; isPublic: boolean; instructorOnly: boolean }>;

const bodySchema = z.object({
  purpose: z.enum(Object.keys(PURPOSES) as [keyof typeof PURPOSES, ...Array<keyof typeof PURPOSES>]),
  filename: z.string().min(1).max(300),
  sizeBytes: z.number().int().positive(),
  durationSec: z.number().finite().min(0).max(60 * 60 * 24).optional(),
});

function maxBytes(kind: AssetKindName): number {
  const e = env();
  return kind === "VIDEO" ? e.MAX_VIDEO_MB : kind === "IMAGE" ? e.MAX_IMAGE_MB : e.MAX_FILE_MB;
}

/** Start a chunked upload. Responds with the asset id and the chunk size to use. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Cross-site request blocked.", 403);

  const user = await getCurrentUser();
  if (!user) return jsonError("Please sign in to upload files.", 401);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid upload request.", 400);
  const { purpose, sizeBytes, durationSec } = parsed.data;
  const rule = PURPOSES[purpose];

  if (rule.instructorOnly && !isInstructor(user)) {
    return jsonError("Only instructors can upload course files.", 403);
  }

  const limit = rateLimit(`upload:${user.id}`, isInstructor(user) ? 600 : 20, 60 * 60 * 1000);
  if (!limit.ok) return jsonError("Too many uploads. Please try again later.", 429);

  const filename = sanitizeFilename(parsed.data.filename);
  const contentType = contentTypeFor(rule.kind, filename);
  if (!contentType) {
    return jsonError(
      `That file type isn't supported here. Allowed: ${allowedExtensions(rule.kind).join(", ")}.`,
      415,
    );
  }

  const max = maxBytes(rule.kind);
  if (sizeBytes > max) {
    return jsonError(`That file is too large. The limit is ${formatBytes(max)}.`, 413);
  }

  const storageKey = `${rule.kind.toLowerCase()}/${randomUUID()}.${fileExtension(filename)}`;
  const uploadId = await storage().beginUpload(storageKey, contentType);

  const asset = await db.asset.create({
    data: {
      ownerId: user.id,
      kind: rule.kind,
      storageKey,
      filename,
      mimeType: contentType,
      sizeBytes: BigInt(sizeBytes),
      uploadId,
      durationSec: rule.kind === "VIDEO" ? Math.round(durationSec ?? 0) : 0,
      isPublic: rule.isPublic,
    },
    select: { id: true },
  });

  return json({ assetId: asset.id, chunkSize: UPLOAD_CHUNK_BYTES, uploadedBytes: 0 }, 201);
}
