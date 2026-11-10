// File-type policy shared by the upload API (server) and upload widgets (client).
// The server derives the content type from the extension; it never trusts the
// type a browser claims.

export type AssetKindName = "IMAGE" | "VIDEO" | "FILE";

const IMAGE_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

const VIDEO_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  ogv: "video/ogg",
};

// Deliberately excludes anything a browser would execute when opened from our
// origin (html, svg, xml, js). Everything except PDF is served as a download.
const FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  zip: "application/zip",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  json: "application/json",
  rtf: "application/rtf",
  epub: "application/epub+zip",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
  ipynb: "application/x-ipynb+json",
  py: "text/plain; charset=utf-8",
  sql: "text/plain; charset=utf-8",
  srt: "text/plain; charset=utf-8",
  vtt: "text/vtt; charset=utf-8",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  psd: "application/octet-stream",
  fig: "application/octet-stream",
  sketch: "application/octet-stream",
  ...IMAGE_TYPES,
};

const TYPES: Record<AssetKindName, Record<string, string>> = {
  IMAGE: IMAGE_TYPES,
  VIDEO: VIDEO_TYPES,
  FILE: FILE_TYPES,
};

export function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot <= 0 ? "" : filename.slice(dot + 1).toLowerCase();
}

/** The content type we will serve for this file, or null if the type is not allowed. */
export function contentTypeFor(kind: AssetKindName, filename: string): string | null {
  return TYPES[kind][fileExtension(filename)] ?? null;
}

export function allowedExtensions(kind: AssetKindName): string[] {
  return Object.keys(TYPES[kind]);
}

/** Value for an <input type="file" accept="..."> attribute. */
export function acceptAttribute(kind: AssetKindName): string {
  return allowedExtensions(kind)
    .map((e) => `.${e}`)
    .join(",");
}

/** Types that are safe to display in the browser rather than download. */
export function isInlineType(mimeType: string): boolean {
  return mimeType.startsWith("image/") || mimeType.startsWith("video/") || mimeType === "application/pdf";
}

/** Strip path parts and control characters from an uploaded file name. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f"<>|:*?]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || "file").slice(0, 150);
}

/** Bytes per upload request. S3 multipart needs every part except the last to be >= 5 MB. */
export const UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;
