import { Suspense } from "react";
import type { Metadata } from "next";
import { RefundButton } from "@/components/admin/controls";
import { Table } from "@/components/studio/stat";
import { Badge, PageHeader, Pagination, Skeleton } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/session";
import { ORDER_STATUS } from "@/lib/commerce/status";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { pageParam } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders" };
const PAGE_SIZE = 25;

export default function AdminOrdersPage(props: PageProps<"/admin/orders">) {
  return (
    <>
      <PageHeader title="Orders" description="Every paid and refunded order. Refunding returns the money and removes access." />
      <Suspense fallback={<Skeleton className="mt-8 h-80 w-full" />}>
        <Orders searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Orders({ searchParams }: Pick<PageProps<"/admin/orders">, "searchParams">) {
  const page = pageParam((await searchParams).page);
  await requireAdmin("/admin/orders");
  const where = { status: { in: ["PAID" as const, "REFUNDED" as const] } };
  const [total, orders] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, number: true, status: true, totalCents: true, currency: true, provider: true, createdAt: true,
        user: { select: { name: true, email: true } },
        items: { select: { id: true, title: true } },
      },
    }),
  ]);

  if (total === 0) return <p className="mt-8 text-muted">No orders yet.</p>;
  return (
    <>
      <div className="mt-8">
        <Table head={["Order", "Buyer", "Courses", "Date", "Total", "Status", ""]}>
          {orders.map((o) => {
            const amount = formatMoney(o.totalCents, o.currency);
            return (
              <tr key={o.id}>
                <td className="font-semibold whitespace-nowrap">#{o.number}</td>
                <td>
                  <span className="block font-semibold">{o.user.name}</span>
                  <span className="block text-xs text-subtle">{o.user.email}</span>
                </td>
                <td className="max-w-64 text-xs text-muted">{o.items.map((i) => i.title).join(", ")}</td>
                <td className="whitespace-nowrap text-muted">{formatDate(o.createdAt)}</td>
                <td className="whitespace-nowrap">
                  {amount}
                  <span className="block text-xs text-subtle">{o.provider}</span>
                </td>
                <td>
                  <Badge tone={ORDER_STATUS[o.status]!.tone}>{ORDER_STATUS[o.status]!.label}</Badge>
                </td>
                <td className="text-right">{o.status === "PAID" ? <RefundButton orderId={o.id} number={o.number} total={amount} /> : null}</td>
              </tr>
            );
          })}
        </Table>
      </div>
      <div className="mt-6">
        <Pagination page={page} pageCount={Math.ceil(total / PAGE_SIZE)} basePath="/admin/orders" />
      </div>
    </>
  );
}
