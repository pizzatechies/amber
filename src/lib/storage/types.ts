import type { Readable } from "node:stream";

export type ByteRange = { start: number; end: number };

export type ChunkInput = {
  key: string;
  /** Driver upload id returned by beginUpload ("" when the driver has none). */
  uploadId: string;
  /** Byte offset of this chunk within the file. */
  offset: number;
  /** 1-based sequence number of the chunk. */
  partNumber: number;
  body: Readable;
  length: number;
};

/**
 * Where file bytes live. Two drivers ship with the app: local disk and
 * S3-compatible object storage. Uploads are chunked so large videos survive
 * flaky connections and proxy body limits.
 */
export interface StorageDriver {
  readonly name: "local" | "s3";

  /** Start a chunked upload. Returns a driver-specific upload id. */
  beginUpload(key: string, contentType: string): Promise<string>;
  /** Store one chunk. Must be safe to retry with the same offset. */
  writeChunk(input: ChunkInput): Promise<void>;
  /** Finish the upload and make the object readable at `key`. */
  completeUpload(key: string, uploadId: string): Promise<void>;
  /** Discard an unfinished upload. */
  abortUpload(key: string, uploadId: string): Promise<void>;

  /** Write a whole (small) object in one call. */
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  /** Size in bytes, or null when the object does not exist. */
  size(key: string): Promise<number | null>;
  read(key: string, range?: ByteRange): Promise<Readable>;
  remove(key: string): Promise<void>;

  /**
   * A short-lived URL the browser can fetch directly, or null when the driver
   * has no such thing and the app must stream the bytes itself.
   */
  signedUrl(key: string, opts: { expiresInSec: number; contentType: string; disposition: string }): Promise<string | null>;
}
