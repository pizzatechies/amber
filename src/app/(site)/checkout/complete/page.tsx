import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CircleCheck, CircleX, Clock, PlayCircle } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Card, Skeleton } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { closeUnpaidOrder, fulfillOrder } from "@/lib/commerce/orders";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { providerFor } from "@/lib/payments";
import { learnUrl } from "@/lib/urls";
import { firstParam } from "@/lib/utils";
import { AutoRefresh } from "./auto-refresh";

export const metadata: Metadata = { title: "Order status", robots: { index: false } };

export default function CheckoutCompletePage(props: PageProps<"/checkout/complete">) {
  return (
    <div className="container-page flex justify-center py-12">
      <Suspense fallback={<Skeleton className="h-80 w-full max-w-xl" />}>
        <OrderStatus searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function loadOrder(orderId: string, userId: string) {
  return db.order.findFirst({
    where: { id: orderId, userId },
    select: {
      id: true,
      number: true,
      status: true,
      totalCents: true,
      currency: true,
      provider: true,
      providerRef: true,
      items: { select: { id: true, title: true, course: { select: { slug: true } } } },
    },
  });
}

async function OrderStatus({ searchParams }: Pick<PageProps<"/checkout/complete">, "searchParams">) {
  const orderId = firstParam((await searchParams).order) ?? "";
  const user = await requireUser(`/checkout/complete?order=${orderId}`);
  let order = await loadOrder(orderId, user.id);
  if (!order) notFound();

  // Returning from a hosted payment page: ask the gateway how it went, in case
  // its webhook has not reached us yet.
  if (order.status === "PENDING" && order.providerRef) {
    try {
      const state = await providerFor(order.provider)?.confirm(order);
      if (state === "paid") await fulfillOrder(order.id);
      if (state === "failed") await closeUnpaidOrder(order.id, "FAILED");
      if (state === "paid" || state === "failed") order = (await loadOrder(orderId, user.id)) ?? order;
    } catch (err) {
      console.error("[checkout] could not confirm payment:", err);
    }
  }

  const total = formatMoney(order.totalCents, order.currency);

  if (order.status === "PAID") {
    return (
      <Card className="w-full max-w-xl p-8 text-center shadow-card">
        <CircleCheck className="mx-auto size-14 text-success" aria-hidden />
        <h1 className="mt-4 font-display text-3xl font-semibold">You&apos;re enrolled</h1>
        <p className="mt-2 text-muted">
          Order #{order.number}
          {order.totalCents > 0 ? ` · ${total} paid` : ""}. A receipt is on its way to {user.email}.
        </p>
        <ul className="mt-6 flex flex-col gap-2 text-left">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
              <span className="min-w-0 text-sm font-semibold">{item.title}</span>
              {item.course ? (
                <LinkButton href={learnUrl(item.course.slug)} size="sm">
                  <PlayCircle aria-hidden /> Start
                </LinkButton>
              ) : null}
            </li>
          ))}
        </ul>
        <LinkButton href="/my-learning" variant="outline" className="mt-6">
          Go to my learning
        </LinkButton>
      </Card>
    );
  }

  if (order.status === "PENDING") {
    return (
      <Card className="w-full max-w-xl p-8 text-center shadow-card">
        <Clock className="mx-auto size-14 text-brand-text" aria-hidden />
        <h1 className="mt-4 font-display text-3xl font-semibold">Confirming your payment…</h1>
        <p className="mt-2 text-muted">
          This usually takes a few seconds. This page checks again automatically — you don&apos;t need to pay twice.
        </p>
        <AutoRefresh />
      </Card>
    );
  }

  const refunded = order.status === "REFUNDED";
  return (
    <Card className="w-full max-w-xl p-8 text-center shadow-card">
      <CircleX className="mx-auto size-14 text-danger" aria-hidden />
      <h1 className="mt-4 font-display text-3xl font-semibold">
        {refunded ? "This order was refunded" : "The payment didn't go through"}
      </h1>
      <p className="mt-2 text-muted">
        {refunded
          ? `Order #${order.number} has been refunded and access to its courses was removed.`
          : "You haven't been charged. Your cart is unchanged, so you can try again."}
      </p>
      <LinkButton href={refunded ? "/account/purchases" : "/cart"} className="mt-6">
        {refunded ? "View purchase history" : "Back to cart"}
      </LinkButton>
    </Card>
  );
}
