import "server-only";
import { env } from "@/lib/env";
import { LocalStorage } from "./local";
import { S3Storage } from "./s3";
import type { StorageDriver } from "./types";

export type { StorageDriver } from "./types";

let driver: StorageDriver | undefined;

/** The configured storage driver (see STORAGE_DRIVER in .env.example). */
export function storage(): StorageDriver {
  if (driver) return driver;
  const e = env();
  driver =
    e.STORAGE_DRIVER === "s3"
      ? new S3Storage({
          bucket: e.S3_BUCKET!,
          region: e.S3_REGION,
          accessKeyId: e.S3_ACCESS_KEY_ID,
          secretAccessKey: e.S3_SECRET_ACCESS_KEY,
          endpoint: e.S3_ENDPOINT,
          forcePathStyle: e.S3_FORCE_PATH_STYLE,
        })
      : new LocalStorage(e.UPLOAD_DIR);
  return driver;
}
