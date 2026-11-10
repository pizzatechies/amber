import { site } from "./site";

/** Number of decimal places the currency uses (2 for USD, 0 for JPY, ...). */
export function minorUnitDigits(currency: string = site.currency): number {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/** Format an amount held in minor units, e.g. 1999 -> "$19.99". */
export function formatMoney(minor: number, currency: string = site.currency): string {
  const digits = minorUnitDigits(currency);
  const value = minor / 10 ** digits;
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      minimumFractionDigits: Number.isInteger(value) ? 0 : digits,
      maximumFractionDigits: digits,
    }).format(value);
  } catch {
    return `${value.toFixed(digits)} ${currency}`;
  }
}

export function formatPrice(minor: number, currency: string = site.currency): string {
  return minor <= 0 ? "Free" : formatMoney(minor, currency);
}

/** Convert a user-typed amount ("19.99") to minor units. Returns null if invalid. */
export function parseAmount(input: string, currency: string = site.currency): number | null {
  const cleaned = input.trim().replace(/,/g, "");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const digits = minorUnitDigits(currency);
  const minor = Math.round(Number(cleaned) * 10 ** digits);
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Minor units -> plain decimal string for form inputs ("19.99"). */
export function toAmountInput(minor: number, currency: string = site.currency): string {
  const digits = minorUnitDigits(currency);
  return (minor / 10 ** digits).toFixed(digits);
}

/** Apply a percentage discount, rounding in the buyer's favour. */
export function applyPercentOff(minor: number, percentOff: number): number {
  const pct = Math.min(100, Math.max(0, percentOff));
  return Math.max(0, Math.floor((minor * (100 - pct)) / 100));
}

/** The instructor's share of a sale. */
export function shareOf(minor: number, sharePercent: number): number {
  const pct = Math.min(100, Math.max(0, sharePercent));
  return Math.round((minor * pct) / 100);
}
