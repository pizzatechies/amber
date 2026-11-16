import { timingSafeEqual } from "node:crypto";
import { appUrl, env } from "@/lib/env";
import { minorUnitDigits } from "@/lib/money";
import { site } from "@/lib/site";
import type { PaymentProvider } from "./types";

/**
 * Flutterwave Checkout (hosted payment page), API v3.
 * https://developer.flutterwave.com/docs/collections-inflow/flutterwave-standard
 *
 * The order id is the transaction reference (tx_ref). Orders are fulfilled when
 * the buyer returns to /checkout/complete or when Flutterwave calls
 * /api/webhooks/flutterwave, whichever happens first, and only after the
 * transaction has been re-checked with Flutterwave's verify endpoint.
 */

/** FLUTTERWAVE_API_BASE points at a stand-in server in the automated tests. */
function apiBase(): string {
  return (process.env.FLUTTERWAVE_API_BASE ?? "https://api.flutterwave.com").replace(/\/+$/, "");
}

class FlutterwaveError extends Error {}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<{ status: number; json: T }> {
  const key = env().FLUTTERWAVE_SECRET_KEY;
  if (!key) throw new FlutterwaveError("FLUTTERWAVE_SECRET_KEY is not configured");
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, json };
}

/** Payment methods shown on the checkout page, per currency. */
const DEFAULT_OPTIONS: Record<string, string> = {
  KES: "mpesa, card",
  GHS: "mobilemoneyghana, card",
  UGX: "mobilemoneyuganda, card",
  RWF: "mobilemoneyrwanda, card",
  ZMW: "mobilemoneyzambia, card",
  TZS: "mobilemoneytanzania, card",
  XAF: "mobilemoneyfranco, card",
  XOF: "mobilemoneyfranco, card",
  NGN: "card, banktransfer, ussd, account",
  ZAR: "card, account",
};

const toMajor = (minor: number, currency: string) => minor / 10 ** minorUnitDigits(currency);

type VerifyResponse = {
  status?: string;
  data?: { id?: number; tx_ref?: string; status?: string; amount?: number | string; currency?: string };
};

/** Look a transaction up by our reference. Null when Flutterwave has no transaction for it yet. */
async function findTransaction(txRef: string) {
  const { status, json } = await call<VerifyResponse>(
    "GET",
    `/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
  );
  if (status === 404 || (status === 400 && !json.data)) return null;
  if (status !== 200 || json.status !== "success" || !json.data) {
    throw new FlutterwaveError(`Flutterwave verify failed (HTTP ${status})`);
  }
  return json.data;
}

export const flutterwaveProvider: PaymentProvider = {
  id: "flutterwave",
  get isTestMode() {
    return (env().FLUTTERWAVE_SECRET_KEY ?? "").startsWith("FLWSECK_TEST");
  },

  async startCheckout(order) {
    const e = env();
    const currency = order.currency.toUpperCase();
    const { status, json } = await call<{ status?: string; message?: string; data?: { link?: string } }>("POST", "/v3/payments", {
      tx_ref: order.id,
      // Flutterwave takes major units ("6450" for KES 6,450).
      amount: String(toMajor(order.totalCents, currency)),
      currency,
      redirect_url: appUrl(`/checkout/complete?order=${order.id}`),
      customer: { email: order.buyerEmail, name: order.buyerName },
      customizations: {
        title: site.name,
        description: order.items.length === 1 ? order.items[0]!.title : `${order.items.length} courses`,
      },
      payment_options: e.FLUTTERWAVE_PAYMENT_OPTIONS ?? DEFAULT_OPTIONS[currency] ?? "card",
      meta: { orderNumber: order.number },
      configurations: { session_duration: 60, max_retry_attempt: 5 },
    });
    const link = json.data?.link;
    if (status !== 200 || json.status !== "success" || !link) {
      throw new FlutterwaveError(`Flutterwave did not create a payment link (HTTP ${status}: ${json.message ?? "no message"})`);
    }
    return { redirectUrl: link, providerRef: order.id };
  },

  async confirm(order) {
    const tx = await findTransaction(order.providerRef || order.id);
    if (!tx) return "pending";
    if (tx.status === "successful") {
      const currency = order.currency.toUpperCase();
      const ok =
        tx.tx_ref === (order.providerRef || order.id) &&
        (tx.currency ?? "").toUpperCase() === currency &&
        Number(tx.amount) >= toMajor(order.totalCents, currency);
      if (!ok) {
        console.error(`[flutterwave] paid amount/currency/reference does not match order ${order.id}; not fulfilling automatically`);
        return "pending";
      }
      return "paid";
    }
    // A failed attempt doesn't end the checkout: the buyer can retry on Flutterwave's page.
    return "pending";
  },

  async cancel() {
    // The payment link expires on its own (session_duration). Nothing to do.
  },

  async refund(order) {
    const tx = await findTransaction(order.providerRef || order.id);
    if (!tx?.id || tx.status !== "successful") throw new FlutterwaveError("No successful payment was found for this order on Flutterwave.");
    const { status, json } = await call<{ status?: string; message?: string }>("POST", `/v3/transactions/${tx.id}/refund`, {
      amount: toMajor(order.totalCents, order.currency),
      comments: `Refund of order ${order.id}`,
    });
    if (status !== 200 || json.status !== "success") {
      throw new FlutterwaveError(`Flutterwave refused the refund (HTTP ${status}: ${json.message ?? "no message"})`);
    }
  },
};

/** Check the `verif-hash` header Flutterwave sends with webhooks against FLUTTERWAVE_WEBHOOK_HASH. */
export function isValidFlutterwaveSignature(header: string | null): boolean {
  const expected = env().FLUTTERWAVE_WEBHOOK_HASH;
  if (!expected || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
