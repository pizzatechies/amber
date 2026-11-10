import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Badge, EmptyState, Skeleton } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { ORDER_STATUS } from "@/lib/commerce/status";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { courseUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Purchase history" };

export default function PurchasesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <Purchases />
    </Suspense>
  );
}

async function Purchases() {
  const user = await requireUser("/account/purchases");
  const orders = await db.order.findMany({
    where: { userId: user.id, status: { in: ["PAID", "REFUNDED", "PENDING"] } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      number: true,
      status: true,
      totalCents: true,
      discountCents: true,
      currency: true,
      createdAt: true,
      items: { select: { id: true, title: true, priceCents: true, couponCode: true, course: { select: { slug: true } } } },
    },
  });

  if (orders.length === 0) {
    return (
      <EmptyState icon={<Receipt />} title="No purchases yet" action={<LinkButton href="/courses">Browse courses</LinkButton>}>
        Courses you buy will be listed here with their receipts.
      </EmptyState>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {orders.map((order) => {
        const status = ORDER_STATUS[order.status]!;
        return (
          <li key={order.id} className="rounded-2xl border border-line bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
              <p className="text-sm">
                <span className="font-bold">Order #{order.number}</span>
                <span className="text-muted"> · {formatDate(order.createdAt)}</span>
              </p>
              <div className="flex items-center gap-3">
                <Badge tone={status.tone}>{status.label}</Badge>
                <span className="font-bold">{formatMoney(order.totalCents, order.currency)}</span>
              </div>
            </div>
            <ul className="divide-y divide-line">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                  <span className="min-w-0">
                    {item.course ? (
                      <Link href={courseUrl(item.course.slug)} className="font-semibold hover:text-brand-text hover:underline">
                        {item.title}
                      </Link>
                    ) : (
                      <span className="font-semibold">{item.title}</span>
                    )}
                    {item.couponCode ? <span className="ml-2 text-xs text-success">Coupon {item.couponCode}</span> : null}
                  </span>
                  <span className="shrink-0 text-muted">{formatMoney(item.priceCents, order.currency)}</span>
                </li>
              ))}
            </ul>
            {order.status === "PENDING" ? (
              <div className="border-t border-line px-5 py-3">
                <Link href={`/checkout/complete?order=${order.id}`} className="text-sm font-bold text-brand-text hover:underline">
                  Check payment status
                </Link>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
