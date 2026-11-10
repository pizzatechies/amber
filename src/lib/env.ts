import "server-only";
import { z } from "zod";

const bool = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const megabytes = (fallback: number) =>
  z.coerce
    .number()
    .positive()
    .default(fallback)
    .transform((mb) => Math.round(mb * 1024 * 1024));

const schema = z
  .object({
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    APP_URL: z.url().default("http://localhost:3000"),

    STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    UPLOAD_DIR: z.string().default("./storage"),
    S3_BUCKET: z.string().optional(),
    S3_REGION: z.string().default("us-east-1"),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_ENDPOINT: z.string().optional(),
    S3_FORCE_PATH_STYLE: bool,

    MAX_VIDEO_MB: megabytes(2048),
    MAX_FILE_MB: megabytes(200),
    MAX_IMAGE_MB: megabytes(8),

    PAYMENT_PROVIDER: z.enum(["sandbox", "stripe"]).default("sandbox"),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),

    SMTP_URL: z.string().optional(),
    MAIL_FROM: z.string().default("Amber <no-reply@example.com>"),
  })
  .superRefine((v, ctx) => {
    if (v.STORAGE_DRIVER === "s3" && !v.S3_BUCKET) {
      ctx.addIssue({ code: "custom", path: ["S3_BUCKET"], message: "S3_BUCKET is required when STORAGE_DRIVER=s3" });
    }
    if (v.PAYMENT_PROVIDER === "stripe" && !v.STRIPE_SECRET_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["STRIPE_SECRET_KEY"],
        message: "STRIPE_SECRET_KEY is required when PAYMENT_PROVIDER=stripe",
      });
    }
  });

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/**
 * Validated server configuration. Parsed on first use rather than at import
 * time so that `next build` works without any environment present.
 */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  cached = parsed.data;
  return cached;
}

/** The site's public base URL without a trailing slash. */
export function appUrl(path = ""): string {
  return env().APP_URL.replace(/\/+$/, "") + path;
}
