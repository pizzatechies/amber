import Stripe from "stripe";
import { appUrl, env } from "@/lib/env";
import type { PaymentProvider } from "./types";

let client: Stripe | undefined;

export function stripeClient(): Stripe {
  if (client) return client;
  const key = env().STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  client = new Stripe(key, stripeClientOptions());
  return client;
}

/**
 * STRIPE_API_BASE points the SDK at a different server. It exists for the
 * automated tests, which run against a local stand-in for the Stripe API.
 */
function stripeClientOptions(): Stripe.StripeConfig {
  const base = process.env.STRIPE_API_BASE;
  if (!base) return {};
  const url = new URL(base);
  return {
    host: url.hostname,
    port: Number(url.port) || (url.protocol === "https:" ? 443 : 80),
    protocol: url.protocol === "https:" ? "https" : "http",
  };
}

/**
 * Stripe Checkout (hosted payment page). Orders are fulfilled by the webhook
 * at /api/webhooks/stripe, and also when the buyer returns to
 * /checkout/complete, whichever happens first.
 */
export const stripeProvider: PaymentProvider = {
  id: "stripe",
  get isTestMode() {
    return (env().STRIPE_SECRET_KEY ?? "").startsWith("sk_test_");
  },

  async startCheckout(order) {
    const session = await stripeClient().checkout.sessions.create({
      mode: "payment",
      client_reference_id: order.id,
      customer_email: order.buyerEmail,
      metadata: { orderId: order.id },
      line_items: order.items
        // Items made free by a coupon stay on our order but can't be Stripe line items.
        .filter((item) => item.priceCents > 0)
        .map((item) => ({
          quantity: 1,
          price_data: {
            currency: order.currency.toLowerCase(),
            unit_amount: item.priceCents,
            product_data: { name: item.title.slice(0, 250) },
          },
        })),
      success_url: appUrl(`/checkout/complete?order=${order.id}`),
      cancel_url: appUrl("/cart"),
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { redirectUrl: session.url, providerRef: session.id };
  },

  async confirm(order) {
    const session = await stripeClient().checkout.sessions.retrieve(order.providerRef);
    if (session.payment_status === "paid") {
      const matches =
        session.amount_total === order.totalCents && session.currency?.toLowerCase() === order.currency.toLowerCase();
      if (!matches) {
        console.error(`[stripe] paid amount does not match order ${order.id}; not fulfilling automatically`);
        return "pending";
      }
      return "paid";
    }
    return session.status === "expired" ? "failed" : "pending";
  },

  async cancel(order) {
    if (!order.providerRef) return;
    await stripeClient()
      .checkout.sessions.expire(order.providerRef)
      .catch(() => undefined);
  },

  async refund(order) {
    const session = await stripeClient().checkout.sessions.retrieve(order.providerRef);
    const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (!paymentIntent) throw new Error("No payment was found for this order on Stripe.");
    await stripeClient().refunds.create({ payment_intent: paymentIntent });
  },
};
