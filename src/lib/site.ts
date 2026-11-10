/**
 * Brand-level configuration. Safe to import from client components.
 * NEXT_PUBLIC_* values are inlined at build time.
 */
export const site = {
  name: process.env.NEXT_PUBLIC_SITE_NAME || "Amber",
  tagline: "Learn from people who do the work",
  description:
    "An online learning marketplace. Take courses taught by practitioners, or publish your own and reach learners everywhere.",
  currency: (process.env.NEXT_PUBLIC_CURRENCY || "USD").toUpperCase(),
} as const;

export const LEVELS = {
  ALL_LEVELS: "All levels",
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
} as const;

export const LANGUAGES = [
  "English",
  "Arabic",
  "Bengali",
  "Chinese",
  "French",
  "German",
  "Hindi",
  "Indonesian",
  "Italian",
  "Japanese",
  "Korean",
  "Portuguese",
  "Russian",
  "Spanish",
  "Swahili",
  "Turkish",
  "Other",
] as const;
