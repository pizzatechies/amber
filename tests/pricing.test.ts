import { describe, expect, it } from "vitest";
import { couponProblem, normalizeCouponCode, priceLine, sumLines, type CouponInfo } from "@/lib/commerce/pricing";
import { applyPercentOff, formatMoney, formatPrice, parseAmount, shareOf, toAmountInput } from "@/lib/money";

const NOW = Date.UTC(2026, 0, 15);
const coupon = (over: Partial<CouponInfo> = {}): CouponInfo => ({
  id: "c1",
  code: "SAVE20",
  percentOff: 20,
  maxRedemptions: null,
  redemptionCount: 0,
  expiresAt: null,
  isActive: true,
  ...over,
});

describe("coupons", () => {
  it("normalises codes", () => {
    expect(normalizeCouponCode("  save 20 ")).toBe("SAVE20");
  });

  it("accepts a valid coupon", () => {
    expect(couponProblem(coupon(), NOW)).toBeNull();
  });

  it("rejects disabled, expired and exhausted coupons", () => {
    expect(couponProblem(coupon({ isActive: false }), NOW)).toMatch(/no longer active/);
    expect(couponProblem(coupon({ expiresAt: new Date(NOW - 1) }), NOW)).toMatch(/expired/);
    expect(couponProblem(coupon({ maxRedemptions: 5, redemptionCount: 5 }), NOW)).toMatch(/maximum/);
    expect(couponProblem(coupon({ maxRedemptions: 5, redemptionCount: 4 }), NOW)).toBeNull();
    expect(couponProblem(coupon({ expiresAt: new Date(NOW + 1) }), NOW)).toBeNull();
  });
});

describe("pricing", () => {
  it("applies a valid coupon and reports the discount", () => {
    expect(priceLine(4999, coupon(), NOW)).toEqual({
      listCents: 4999,
      priceCents: 3999,
      discountCents: 1000,
      coupon: { id: "c1", code: "SAVE20", percentOff: 20 },
    });
  });

  it("ignores an invalid coupon instead of failing", () => {
    const line = priceLine(4999, coupon({ isActive: false }), NOW);
    expect(line.priceCents).toBe(4999);
    expect(line.coupon).toBeNull();
  });

  it("never discounts a free course or goes below zero", () => {
    expect(priceLine(0, coupon(), NOW).priceCents).toBe(0);
    expect(priceLine(1000, coupon({ percentOff: 100 }), NOW).priceCents).toBe(0);
  });

  it("rounds discounts in the buyer's favour", () => {
    expect(applyPercentOff(999, 33)).toBe(669); // 669.33 -> 669
    expect(applyPercentOff(1, 50)).toBe(0);
  });

  it("totals a cart", () => {
    const lines = [priceLine(4999, coupon(), NOW), priceLine(3999, null, NOW)];
    expect(sumLines(lines)).toEqual({ subtotalCents: 8998, discountCents: 1000, totalCents: 7998 });
  });

  it("computes the instructor's share", () => {
    expect(shareOf(3999, 70)).toBe(2799);
    expect(shareOf(3999, 0)).toBe(0);
    expect(shareOf(3999, 100)).toBe(3999);
  });
});

describe("money", () => {
  it("formats amounts held in minor units", () => {
    expect(formatMoney(1999, "USD")).toBe("$19.99");
    expect(formatMoney(2000, "USD")).toBe("$20.00");
    expect(formatMoney(1500, "JPY")).toBe("¥1,500");
    expect(formatPrice(0, "USD")).toBe("Free");
  });

  it("parses what people type", () => {
    expect(parseAmount("19.99", "USD")).toBe(1999);
    expect(parseAmount("1,250", "USD")).toBe(125000);
    expect(parseAmount("1500", "JPY")).toBe(1500);
    expect(parseAmount("", "USD")).toBeNull();
    expect(parseAmount("abc", "USD")).toBeNull();
    expect(parseAmount("-5", "USD")).toBeNull();
  });

  it("round-trips through the form input format", () => {
    expect(toAmountInput(2450, "USD")).toBe("24.50");
    expect(parseAmount(toAmountInput(2450, "USD"), "USD")).toBe(2450);
  });
});
