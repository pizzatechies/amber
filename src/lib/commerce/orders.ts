import "server-only";
import { ActionError } from "@/lib/action";
import { refreshEnrollmentCount } from "@/lib/courses/stats";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { mails, sendMail } from "@/lib/mail";
import { shareOf } from "@/lib/money";
import { notify } from "@/lib/notify";
import { chargeFor, paymentMethods, providerFor, type PaymentMethodId } from "@/lib/payments";
import { chargeLabel, chargeOf } from "./pricing";
import { getSettings } from "@/lib/settings";
import { site } from "@/lib/site";
import { getCart } from "./cart";
import { grantEnrollment } from "./enroll";

/**
 * Turn the user's cart into an order and begin payment.
 * Returns the URL to send the buyer to next.
 */
export async function checkoutCart(
  user: { id: string; email: string; name: string },
  methodId: PaymentMethodId = "card",
): Promise<string> {
  const cart = await getCart(user.id, Date.now());
  if (cart.purchasable.length === 0) {
    throw new ActionError("There is nothing in your cart to check out.");
  }
  const { instructorSharePercent } = await getSettings();
  const method = (await paymentMethods()).find((m) => m.id === methodId);
  if (!method) throw new ActionError("That payment method isn't available. Please choose another.");
  const provider = method.provider;
  const isFree = cart.totals.totalCents === 0;
  const charge = chargeFor(method, cart.totals.totalCents);
  if (!isFree && charge.amount <= 0) throw new ActionError("That payment method isn't available. Please choose another.");

  // Only one open order at a time: abandon any earlier unpaid checkout.
  const stale = await db.order.findMany({
    where: { userId: user.id, status: "PENDING" },
    select: { id: true, provider: true, providerRef: true },
  });
  if (stale.length > 0) {
    await db.order.updateMany({ where: { id: { in: stale.map((o) => o.id) } }, data: { status: "CANCELED" } });
    await Promise.all(stale.map((o) => providerFor(o.provider)?.cancel({ providerRef: o.providerRef })));
  }

  const order = await db.order.create({
    data: {
      userId: user.id,
      currency: site.currency,
      subtotalCents: cart.totals.subtotalCents,
      discountCents: cart.totals.discountCents,
      totalCents: cart.totals.totalCents,
      chargeAmount: isFree ? 0 : charge.amount,
      chargeCurrency: isFree ? site.currency : charge.currency,
      provider: isFree ? "none" : provider.id,
      items: {
        create: cart.purchasable.map((line) => ({
          courseId: line.course.id,
          instructorId: line.course.instructorId,
          title: line.course.title,
          listPriceCents: line.listCents,
          priceCents: line.priceCents,
          couponId: line.coupon?.id,
          couponCode: line.coupon?.code ?? "",
          instructorShareCents: shareOf(line.priceCents, instructorSharePercent),
        })),
      },
    },
    select: { id: true, number: true, totalCents: true, currency: true, items: { select: { title: true, priceCents: true } } },
  });

  if (isFree) {
    await fulfillOrder(order.id);
    return `/checkout/complete?order=${order.id}`;
  }

  try {
    // Gateways charge the converted amount; per-item prices are only sent when no conversion applies.
    const converted = charge.currency !== order.currency;
    const started = await provider.startCheckout({
      id: order.id,
      number: order.number,
      totalCents: charge.amount,
      currency: charge.currency,
      buyerEmail: user.email,
      buyerName: user.name,
      items: converted ? order.items.map((i) => ({ title: i.title, priceCents: 0 })) : order.items,
    });
    await db.order.update({ where: { id: order.id }, data: { providerRef: started.providerRef } });
    return started.redirectUrl;
  } catch (err) {
    console.error("[orders] could not start checkout:", err);
    await db.order.update({ where: { id: order.id }, data: { status: "FAILED" } });
    throw new ActionError("We couldn't start the payment. Nothing was charged — please try again.");
  }
}

/**
 * Mark an order paid and grant access to its courses. Safe to call more than
 * once (the webhook and the return page may both call it): only the first call
 * does anything. Returns true when this call fulfilled the order.
 *
 * Only call this once payment is certain. A CANCELED order is still fulfilled,
 * because the buyer may have paid in an older tab after starting a newer checkout.
 */
export async function fulfillOrder(orderId: string): Promise<boolean> {
  const order = await db.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: { in: ["PENDING", "CANCELED"] } },
      data: { status: "PAID", paidAt: new Date() },
    });
    if (claimed.count === 0) return null;

    const paid = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: {
        id: true,
        number: true,
        totalCents: true,
        currency: true,
        chargeAmount: true,
        chargeCurrency: true,
        userId: true,
        user: { select: { name: true, email: true } },
        items: { select: { courseId: true, couponId: true, title: true, instructorId: true } },
      },
    });
    for (const item of paid.items) {
      if (!item.courseId) continue;
      await grantEnrollment(tx, paid.userId, item.courseId, "PURCHASE");
      if (item.couponId) {
        await tx.coupon.updateMany({ where: { id: item.couponId }, data: { redemptionCount: { increment: 1 } } });
      }
    }
    return paid;
  });
  if (!order) return false;

  // Everything below is best-effort and must not undo a successful payment.
  await notify([
    {
      userId: order.userId,
      title: order.items.length === 1 ? "You're enrolled" : `You're enrolled in ${order.items.length} courses`,
      body: order.items.map((i) => i.title).join(", "),
      href: "/my-learning",
    },
    ...order.items.map((i) => ({
      userId: i.instructorId,
      title: "New student enrolled",
      body: `${order.user.name} joined ${i.title}`,
      href: "/instructor",
    })),
  ]);
  await sendMail(
    mails.orderReceipt(order.user.email, order.user.name, {
      number: order.number,
      total: chargeLabel(order),
      items: order.items.map((i) => i.title),
      link: appUrl("/my-learning"),
    }),
  );
  return true;
}

/** Record that an unpaid checkout failed or was abandoned. */
export async function closeUnpaidOrder(orderId: string, status: "FAILED" | "CANCELED"): Promise<void> {
  await db.order.updateMany({ where: { id: orderId, status: "PENDING" }, data: { status } });
}

/**
 * Refund a paid order: return the money through the gateway, then withdraw
 * access to the courses it bought.
 */
export async function refundOrder(orderId: string): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      number: true,
      status: true,
      userId: true,
      provider: true,
      providerRef: true,
      totalCents: true,
      currency: true,
      chargeAmount: true,
      chargeCurrency: true,
      items: { select: { courseId: true, title: true } },
    },
  });
  if (!order) throw new ActionError("Order not found.");
  if (order.status !== "PAID") throw new ActionError("Only paid orders can be refunded.");

  if (order.totalCents > 0) {
    const provider = providerFor(order.provider);
    if (!provider) throw new ActionError(`Unknown payment provider "${order.provider}".`);
    try {
      const charge = chargeOf(order);
      await provider.refund({ id: order.id, providerRef: order.providerRef, totalCents: charge.amount, currency: charge.currency });
    } catch (err) {
      console.error("[orders] refund failed:", err);
      throw new ActionError("The payment provider rejected the refund. Nothing was changed.");
    }
  }

  const courseIds = order.items.map((i) => i.courseId).filter((id): id is string => !!id);
  await db.$transaction(async (tx) => {
    const now = new Date();
    await tx.order.update({ where: { id: order.id }, data: { status: "REFUNDED", refundedAt: now } });
    await tx.enrollment.updateMany({
      where: { userId: order.userId, courseId: { in: courseIds }, source: "PURCHASE", revokedAt: null },
      data: { revokedAt: now },
    });
    for (const courseId of courseIds) await refreshEnrollmentCount(courseId, tx);
  });

  await notify({
    userId: order.userId,
    title: `Order #${order.number} was refunded`,
    body: "Access to the courses in this order has been removed.",
    href: "/account/purchases",
  });
}
