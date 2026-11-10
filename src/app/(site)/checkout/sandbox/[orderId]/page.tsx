import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { ActionButton } from "@/components/ui/action-form";
import { Card, Skeleton } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { sandboxPayAction } from "@/server/actions/commerce";

export const metadata: Metadata = { title: "Test payment", robots: { index: false } };

export default function SandboxCheckoutPage(props: PageProps<"/checkout/sandbox/[orderId]">) {
  return (
    <div className="container-page flex justify-center py-12">
      <Suspense fallback={<Skeleton className="h-96 w-full max-w-lg" />}>
        <SandboxCheckout params={props.params} />
      </Suspense>
    </div>
  );
}

async function SandboxCheckout({ params }: Pick<PageProps<"/checkout/sandbox/[orderId]">, "params">) {
  const { orderId } = await params;
  const user = await requireUser(`/checkout/sandbox/${orderId}`);
  const order = await db.order.findFirst({
    where: { id: orderId, userId: user.id, provider: "sandbox" },
    select: {
      id: true,
      number: true,
      status: true,
      totalCents: true,
      currency: true,
      items: { select: { id: true, title: true, priceCents: true } },
    },
  });
  if (!order) notFound();
  if (order.status !== "PENDING") redirect(`/checkout/complete?order=${order.id}`);

  return (
    <Card className="w-full max-w-lg overflow-hidden shadow-card">
      <div className="flex gap-3 bg-info-soft px-6 py-4 text-info">
        <FlaskConical className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="text-sm leading-relaxed text-fg">
          <p className="font-bold text-info">Test checkout — no real payment</p>
          <p>
            This page stands in for a payment provider. No card is needed and no money moves. Choose how the simulated
            payment should end.
          </p>
        </div>
      </div>
      <div className="p-6">
        <h1 className="font-display text-2xl font-semibold">Order #{order.number}</h1>
        <ul className="mt-4 flex flex-col gap-2 text-sm">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-4">
              <span className="min-w-0">{item.title}</span>
              <span className="shrink-0 font-semibold">{formatMoney(item.priceCents, order.currency)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
          <span className="font-bold">Total</span>
          <span className="font-display text-3xl font-semibold">{formatMoney(order.totalCents, order.currency)}</span>
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          <ActionButton action={sandboxPayAction.bind(null, order.id, "paid")} size="lg">
            Simulate a successful payment
          </ActionButton>
          <ActionButton action={sandboxPayAction.bind(null, order.id, "declined")} size="lg" variant="outline">
            Simulate a declined payment
          </ActionButton>
        </div>
      </div>
    </Card>
  );
}
