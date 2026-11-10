import "server-only";
import { cache } from "react";
import { z } from "zod";
import { db } from "@/lib/db";

export const settingsSchema = z.object({
  /** When on, a course must be approved by an admin before it goes live. */
  requireCourseReview: z.boolean(),
  /** Percentage of each sale that belongs to the instructor. */
  instructorSharePercent: z.number().int().min(0).max(100),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  requireCourseReview: true,
  instructorSharePercent: 70,
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
