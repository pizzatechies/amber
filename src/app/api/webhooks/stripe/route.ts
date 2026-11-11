import type Stripe from "stripe";
import { closeUnpaidOrder, fulfillOrder } from "@/lib/commerce/orders";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { stripeClient } from "@/lib/payments/stripe";

/**
 * Stripe calls this when a checkout finishes. Point a webhook endpoint at
 * /api/webhooks/stripe for the events `checkout.session.completed`,
 * `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`
 * and `checkout.session.expired`, and put its signing secret in STRIPE_WEBHOOK_SECRET.
 */
export async function POST(request: Request) {
  const secret = env().STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return new Response("Webhook is not configured", { status: 400 });

  let event: Stripe.Event;
  try {
    // The signature covers the exact bytes Stripe sent, so read the raw body.
    event = await stripeClient().webhooks.constructEventAsync(await request.text(), signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type.startsWith("checkout.session.")) {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId ?? session.client_reference_id;
    const order = orderId
      ? await db.order.findUnique({ where: { id: orderId }, select: { id: true, totalCents: true, currency: true } })
      : null;

    if (order) {
      const paidEvent = event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded";
      if (paidEvent && session.payment_status === "paid") {
        const matches = session.amount_total === order.totalCents && session.currency?.toLowerCase() === order.currency.toLowerCase();
        if (matches) await fulfillOrder(order.id);
        else console.error(`[stripe] amount mismatch on order ${order.id}; not fulfilling automatically`);
      } else if (event.type === "checkout.session.expired") {
        await closeUnpaidOrder(order.id, "CANCELED");
      } else if (event.type === "checkout.session.async_payment_failed") {
        await closeUnpaidOrder(order.id, "FAILED");
      }
    }
  }
  return Response.json({ received: true });
}
