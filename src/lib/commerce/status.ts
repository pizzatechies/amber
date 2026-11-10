import type { BadgeTone } from "@/components/ui/misc";

export const ORDER_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  PAID: { label: "Paid", tone: "success" },
  PENDING: { label: "Awaiting payment", tone: "warn" },
  FAILED: { label: "Failed", tone: "danger" },
  CANCELED: { label: "Cancelled", tone: "neutral" },
  REFUNDED: { label: "Refunded", tone: "info" },
};

export const COURSE_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  IN_REVIEW: { label: "In review", tone: "warn" },
  PUBLISHED: { label: "Published", tone: "success" },
  REJECTED: { label: "Changes requested", tone: "danger" },
  UNPUBLISHED: { label: "Unpublished", tone: "neutral" },
};
