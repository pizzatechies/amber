import "server-only";
import { convertCharge } from "@/lib/commerce/pricing";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { site } from "@/lib/site";
import { flutterwaveProvider } from "./flutterwave";
import { sandboxProvider } from "./sandbox";
import { stripeProvider } from "./stripe";
import type { PaymentProvider } from "./types";

export type { PaymentProvider, CheckoutOrder, PaymentState } from "./types";

const providers: Record<string, PaymentProvider> = {
  sandbox: sandboxProvider,
  stripe: stripeProvider,
  flutterwave: flutterwaveProvider,
};

/** The card gateway selected by PAYMENT_PROVIDER. */
export function payments(): PaymentProvider {
  return providers[env().PAYMENT_PROVIDER]!;
}

/** The gateway that took a given order (it may differ from the current setting). */
export function providerFor(id: string): PaymentProvider | null {
  return providers[id] ?? null;
}

export type PaymentMethodId = "card" | "local";

export type PaymentMethod = {
  id: PaymentMethodId;
  provider: PaymentProvider;
  label: string;
  description: string;
  /** Present when this method charges in another currency. */
  local?: { currency: string; rate: number };
};

/**
 * The ways a buyer can pay right now. Card (Stripe, or the sandbox) is always
 * offered; local payment through Flutterwave is offered once its secret key and
 * an exchange rate are configured.
 */
export async function paymentMethods(): Promise<PaymentMethod[]> {
  const e = env();
  const card = payments();
  const methods: PaymentMethod[] = [
    {
      id: "card",
      provider: card,
      label: "Pay with card",
      description: card.id === "sandbox" ? "Test payment (no real charge)" : "Visa, Mastercard and more",
    },
  ];
  if (e.FLUTTERWAVE_SECRET_KEY) {
    const { localCurrencyRate } = await getSettings();
    const currency = e.FLUTTERWAVE_CURRENCY;
    if (localCurrencyRate > 0 && currency !== site.currency) {
      methods.push({
        id: "local",
        provider: flutterwaveProvider,
        label: currency === "KES" ? "Pay with M-Pesa" : "Pay with mobile money",
        description: currency === "KES" ? "M-Pesa or card, charged in Kenyan shillings" : `Mobile money or card, charged in ${currency}`,
        local: { currency, rate: localCurrencyRate },
      });
    } else if (currency === site.currency) {
      methods.push({ id: "local", provider: flutterwaveProvider, label: "Pay with Flutterwave", description: "Card and local payment methods" });
    }
  }
  return methods;
}

/** The amount a method will charge for a total in the site currency. */
export function chargeFor(method: PaymentMethod, totalCents: number): { amount: number; currency: string } {
  if (!method.local) return { amount: totalCents, currency: site.currency };
  return { amount: convertCharge(totalCents, site.currency, method.local.currency, method.local.rate), currency: method.local.currency };
}
