import { z } from "zod";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/password";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address.").max(254, "That email address is too long."));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, "That password is too long.");

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Enter your name.")
  .max(80, "Keep your name under 80 characters.");

export const idSchema = z.string().min(1).max(64);

/** A trimmed single-line string with a length range. */
export function text(label: string, min: number, max: number) {
  const base = z.string().trim().max(max, `${label} must be ${max} characters or fewer.`);
  return min > 0 ? base.min(min, min === 1 ? `${label} is required.` : `${label} needs at least ${min} characters.`) : base;
}

/** Optional http(s) URL; empty string allowed. */
export const optionalUrlSchema = z
  .string()
  .trim()
  .max(300, "That link is too long.")
  .refine((v) => v === "" || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(v), "Enter a full link starting with https://");
