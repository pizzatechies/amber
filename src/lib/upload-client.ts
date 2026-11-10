// Browser-side half of the chunked upload protocol (see src/app/api/uploads).
// Files are sent in fixed-size chunks; a failed chunk is retried, and after a
// dropped connection the upload resumes from what the server already has.

export type UploadPurpose = "avatar" | "thumbnail" | "promo" | "lecture-video" | "lecture-document" | "resource";

export type UploadedAsset = {
  id: string;
  kind: "IMAGE" | "VIDEO" | "FILE";
  filename: string;
  sizeBytes: number;
  durationSec: number;
};

export class UploadError extends Error {}

const MAX_ATTEMPTS = 6;

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

/** PUT one chunk with XMLHttpRequest, which (unlike fetch) reports upload progress. */
function putChunk(
  url: string,
  chunk: Blob,
  onProgress: (loaded: number) => void,
  signal: AbortSignal,
): Promise<{ status: number; body: { uploadedBytes?: number; error?: string } }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.responseType = "json";
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => resolve({ status: xhr.status, body: (xhr.response as { uploadedBytes?: number }) ?? {} });
    xhr.onerror = () => reject(new Error("network"));
    xhr.ontimeout = () => reject(new Error("timeout"));
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(chunk);
  });
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Upload cancelled", "AbortError"));
      },
      { once: true },
    );
  });

export async function uploadFile(
  file: Blob,
  opts: {
    purpose: UploadPurpose;
    filename: string;
    durationSec?: number;
    onProgress?: (fraction: number) => void;
    signal?: AbortSignal;
  },
): Promise<UploadedAsset> {
  const signal = opts.signal ?? new AbortController().signal;
  if (file.size === 0) throw new UploadError("That file is empty.");

  const init = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      purpose: opts.purpose,
      filename: opts.filename,
      sizeBytes: file.size,
      durationSec: opts.durationSec,
    }),
    signal,
  });
  if (!init.ok) throw new UploadError(await readError(init, "The upload could not be started."));
  const { assetId, chunkSize } = (await init.json()) as { assetId: string; chunkSize: number };
  const base = `/api/uploads/${assetId}`;

  try {
    let offset = 0;
    let attempt = 0;
    while (offset < file.size) {
      const chunk = file.slice(offset, offset + chunkSize);
      try {
        const res = await putChunk(
          `${base}?offset=${offset}`,
          chunk,
          (loaded) => opts.onProgress?.(Math.min(0.99, (offset + loaded) / file.size)),
          signal,
        );
        if (res.status === 200 && typeof res.body.uploadedBytes === "number") {
          offset = res.body.uploadedBytes;
          attempt = 0;
          continue;
        }
        if (res.status === 409 && typeof res.body.uploadedBytes === "number") {
          // Out of step with the server: carry on from where it says we are.
          offset = Math.floor(res.body.uploadedBytes / chunkSize) * chunkSize;
          continue;
        }
        if (res.status >= 400 && res.status < 500) {
          throw new UploadError(res.body.error || "The upload was rejected.");
        }
        throw new Error(`server ${res.status}`);
      } catch (err) {
        if (err instanceof UploadError || (err instanceof DOMException && err.name === "AbortError")) throw err;
        if (++attempt >= MAX_ATTEMPTS) {
          throw new UploadError("The connection kept dropping. Check your internet and try again.");
        }
        await sleep(Math.min(15_000, 500 * 2 ** attempt), signal);
        // Ask the server how far it got before retrying.
        const status = await fetch(base, { signal }).catch(() => null);
        if (status?.ok) {
          const { uploadedBytes } = (await status.json()) as { uploadedBytes: number };
          offset = Math.floor(uploadedBytes / chunkSize) * chunkSize;
        }
      }
    }

    const done = await fetch(base, { method: "POST", signal });
    if (!done.ok) throw new UploadError(await readError(done, "The upload could not be completed."));
    opts.onProgress?.(1);
    return ((await done.json()) as { asset: UploadedAsset }).asset;
  } catch (err) {
    // Don't leave a half-uploaded file behind.
    fetch(base, { method: "DELETE", keepalive: true }).catch(() => undefined);
    throw err;
  }
}

/** Delete an uploaded file that was never attached to anything. */
export function discardUpload(assetId: string): void {
  fetch(`/api/uploads/${assetId}`, { method: "DELETE", keepalive: true }).catch(() => undefined);
}

/** Read a video file's duration in seconds (0 if the browser can't tell). */
export function videoDuration(file: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const finish = (value: number) => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(value) && value > 0 ? value : 0);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => finish(video.duration);
    video.onerror = () => finish(0);
    setTimeout(() => finish(0), 8000);
    video.src = url;
  });
}

/**
 * Crop an image to the given aspect ratio and scale it down in the browser,
 * so a 12-megapixel photo doesn't become a multi-megabyte thumbnail.
 */
export async function resizeImage(file: Blob, width: number, height: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new UploadError("That image couldn't be read. Try a JPEG or PNG file.");

  const scale = Math.max(width / bitmap.width, height / bitmap.height);
  const sw = width / scale;
  const sh = height / scale;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new UploadError("Your browser couldn't process that image.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (bitmap.width - sw) / 2, (bitmap.height - sh) / 2, sw, sh, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  if (!blob) throw new UploadError("Your browser couldn't process that image.");
  return blob;
}
