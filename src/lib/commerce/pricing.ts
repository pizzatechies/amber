import { applyPercentOff } from "@/lib/money";

// Pure pricing rules: no database access, so they are easy to test.

export type CouponInfo = {
  id: string;
  code: string;
  percentOff: number;
  maxRedemptions: number | null;
  redemptionCount: number;
  expiresAt: Date | null;
  isActive: boolean;
};

/** Coupon codes are case-insensitive and stored upper-case without spaces. */
export function normalizeCouponCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

export const COUPON_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,29}$/;

/** Why a coupon can't be used right now, or null when it is valid. */
export function couponProblem(coupon: CouponInfo, now: number): string | null {
  if (!coupon.isActive) return "This coupon is no longer active.";
  if (coupon.expiresAt && coupon.expiresAt.getTime() <= now) return "This coupon has expired.";
  if (coupon.maxRedemptions !== null && coupon.redemptionCount >= coupon.maxRedemptions) {
    return "This coupon has been used the maximum number of times.";
  }
  return null;
}

export type PricedLine = {
  listCents: number;
  priceCents: number;
  discountCents: number;
  coupon: { id: string; code: string; percentOff: number } | null;
};

/** Price of one course for a buyer, applying the coupon only if it is currently valid. */
export function priceLine(listCents: number, coupon: CouponInfo | null, now: number): PricedLine {
  if (!coupon || listCents <= 0 || couponProblem(coupon, now)) {
    return { listCents, priceCents: Math.max(0, listCents), discountCents: 0, coupon: null };
  }
  const priceCents = applyPercentOff(listCents, coupon.percentOff);
  return {
    listCents,
    priceCents,
    discountCents: listCents - priceCents,
    coupon: { id: coupon.id, code: coupon.code, percentOff: coupon.percentOff },
  };
}

export type Totals = { subtotalCents: number; discountCents: number; totalCents: number };

export function sumLines(lines: PricedLine[]): Totals {
  const subtotalCents = lines.reduce((sum, l) => sum + l.listCents, 0);
  const totalCents = lines.reduce((sum, l) => sum + l.priceCents, 0);
  return { subtotalCents, discountCents: subtotalCents - totalCents, totalCents };
}
