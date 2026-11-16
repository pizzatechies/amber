import { applyPercentOff, formatMoney, minorUnitDigits } from "@/lib/money";

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

/**
 * Convert an amount to another currency at `rate` (units of `to` per unit of
 * `from`), rounded UP to a whole unit of `to` — mobile money has no cents.
 * Returns minor units of `to`.
 */
export function convertCharge(minor: number, from: string, to: string, rate: number): number {
  if (minor <= 0 || !(rate > 0)) return 0;
  const major = minor / 10 ** minorUnitDigits(from);
  // toFixed guards against float noise such as 1000.0000000001 rounding up a whole unit.
  const whole = Math.ceil(Number((major * rate).toFixed(6)));
  return whole * 10 ** minorUnitDigits(to);
}

/** What an order was (or will be) charged: the local amount when converted, else the order total. */
export function chargeOf(order: { totalCents: number; currency: string; chargeAmount: number; chargeCurrency: string }) {
  return order.chargeCurrency
    ? { amount: order.chargeAmount, currency: order.chargeCurrency }
    : { amount: order.totalCents, currency: order.currency };
}

/** "KES 6,474.00 (US$49.99)" for converted orders, otherwise just the total. */
export function chargeLabel(order: { totalCents: number; currency: string; chargeAmount: number; chargeCurrency: string }): string {
  const total = formatMoney(order.totalCents, order.currency);
  const charge = chargeOf(order);
  return charge.currency !== order.currency ? `${formatMoney(charge.amount, charge.currency)} (${total})` : total;
}
