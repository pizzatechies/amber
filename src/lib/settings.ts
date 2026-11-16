import "server-only";
import { cache } from "react";
import { z } from "zod";
import { db } from "@/lib/db";

export const settingsSchema = z.object({
  /** When on, a course must be approved by an admin before it goes live. */
  requireCourseReview: z.boolean(),
  /** Percentage of each sale that belongs to the instructor. */
  instructorSharePercent: z.number().int().min(0).max(100),
  /**
   * Exchange rate for local-currency payments (Flutterwave): how many units of
   * FLUTTERWAVE_CURRENCY one unit of the site currency buys. 0 = not set, and
   * local-currency payment is not offered.
   */
  localCurrencyRate: z.number().min(0).max(1_000_000),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  requireCourseReview: true,
  instructorSharePercent: 70,
  localCurrencyRate: 0,
};

/** Platform settings, falling back to defaults for anything not stored yet. */
export const getSettings = cache(async (): Promise<Settings> => {
  const rows = await db.setting.findMany();
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const parsed = settingsSchema.partial().safeParse(stored);
  return { ...DEFAULT_SETTINGS, ...(parsed.success ? parsed.data : {}) };
});

export async function saveSettings(settings: Settings): Promise<void> {
  const valid = settingsSchema.parse(settings);
  await db.$transaction(
    Object.entries(valid).map(([key, value]) =>
      db.setting.upsert({ where: { key }, create: { key, value }, update: { value } }),
    ),
  );
}
