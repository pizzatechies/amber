import { fulfillOrder } from "@/lib/commerce/orders";
import { chargeOf } from "@/lib/commerce/pricing";
import { db } from "@/lib/db";
import { isValidFlutterwaveSignature, flutterwaveProvider } from "@/lib/payments/flutterwave";

/**
 * Flutterwave calls this after each payment attempt. In the Flutterwave
 * dashboard (Settings → Webhooks) set the URL to /api/webhooks/flutterwave and
 * a secret hash, and put the same hash in FLUTTERWAVE_WEBHOOK_HASH.
 *
 * The event body is only used to find the order: whether it was paid is always
 * re-checked with Flutterwave's verify endpoint before anything is unlocked.
 */
export async function POST(request: Request) {
  if (!isValidFlutterwaveSignature(request.headers.get("verif-hash"))) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = (await request.json().catch(() => null)) as { event?: string; data?: { tx_ref?: string } } | null;
  const txRef = event?.data?.tx_ref;
  if (event?.event === "charge.completed" && txRef) {
    const order = await db.order.findUnique({
      where: { id: txRef },
      select: { id: true, status: true, provider: true, providerRef: true, totalCents: true, currency: true, chargeAmount: true, chargeCurrency: true },
    });
    if (order && order.provider === "flutterwave" && (order.status === "PENDING" || order.status === "CANCELED")) {
      try {
        const charge = chargeOf(order);
        const state = await flutterwaveProvider.confirm({
          id: order.id,
          providerRef: order.providerRef,
          totalCents: charge.amount,
          currency: charge.currency,
        });
        if (state === "paid") await fulfillOrder(order.id);
      } catch (err) {
        // Answer with an error so Flutterwave retries later.
        console.error("[flutterwave] could not verify webhook payment:", err);
        return new Response("Verification failed", { status: 502 });
      }
    }
  }
  // Acknowledge everything else so Flutterwave doesn't retry it.
  return Response.json({ received: true });
}
