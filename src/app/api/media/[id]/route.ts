import { Readable } from "node:stream";
import { getCurrentUser } from "@/lib/auth/session";
import { readableAsset } from "@/lib/assets";
import { contentDisposition, parseRange } from "@/lib/http";
import { storage } from "@/lib/storage";
import { isInlineType } from "@/lib/storage/files";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Serves an uploaded file after checking the viewer may read it.
 * Supports HTTP Range so videos can seek. With S3 storage, private files are
 * handed off to a short-lived signed URL instead of being proxied.
 */
export async function GET(request: Request, { params }: Ctx) {
  const { id } = await params;
  const user = await getCurrentUser();
  const asset = await readableAsset(id, user);
  // 404 for both "missing" and "not allowed" so ids can't be probed.
  if (!asset) return new Response("Not found", { status: 404 });

  const forceDownload = new URL(request.url).searchParams.get("download") === "1";
  const inline = !forceDownload && isInlineType(asset.mimeType);
  const disposition = contentDisposition(inline ? "inline" : "attachment", asset.filename);
  const cacheControl = asset.isPublic ? "public, max-age=31536000, immutable" : "private, max-age=0, must-revalidate";
  const store = storage();

  if (!asset.isPublic) {
    const signed = await store.signedUrl(asset.storageKey, {
      expiresInSec: 6 * 60 * 60,
      contentType: asset.mimeType,
      disposition,
    });
    if (signed) {
      return new Response(null, { status: 302, headers: { Location: signed, "Cache-Control": "private, no-store" } });
    }
  }

  const headers = new Headers({
    "Content-Type": asset.mimeType,
    "Content-Disposition": disposition,
    "Accept-Ranges": "bytes",
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
  });

  const range = parseRange(request.headers.get("range"), asset.sizeBytes);
  if (range === "unsatisfiable") {
    headers.set("Content-Range", `bytes */${asset.sizeBytes}`);
    return new Response(null, { status: 416, headers });
  }

  try {
    if (range) {
      headers.set("Content-Range", `bytes ${range.start}-${range.end}/${asset.sizeBytes}`);
      headers.set("Content-Length", String(range.end - range.start + 1));
      const stream = await store.read(asset.storageKey, range);
      return new Response(Readable.toWeb(stream) as ReadableStream, { status: 206, headers });
    }
    headers.set("Content-Length", String(asset.sizeBytes));
    const stream = await store.read(asset.storageKey);
    return new Response(Readable.toWeb(stream) as ReadableStream, { status: 200, headers });
  } catch (err) {
    console.error("[media] could not read stored file:", err);
    return new Response("File unavailable", { status: 404 });
  }
}
