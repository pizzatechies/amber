import { Suspense } from "react";
import type { Metadata } from "next";
import { CircleDollarSign } from "lucide-react";
import { Stat, StatGrid, Table } from "@/components/studio/stat";
import { Alert, EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { requireInstructor } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatCount, formatDate, formatMonth } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Earnings" };

export default function EarningsPage() {
  return (
    <>
      <PageHeader title="Earnings" description="Sales of your courses and your share of each one." />
      <Suspense fallback={<Skeleton className="mt-8 h-80 w-full" />}>
        <Earnings />
      </Suspense>
    </>
  );
}

async function Earnings() {
  const user = await requireInstructor("/instructor/earnings");
  const [items, settings] = await Promise.all([
    db.orderItem.findMany({
      where: { instructorId: user.id, order: { status: "PAID" } },
      orderBy: { order: { paidAt: "desc" } },
      take: 2000,
      select: {
        id: true,
        title: true,
        priceCents: true,
        instructorShareCents: true,
        couponCode: true,
        order: { select: { paidAt: true, createdAt: true, number: true } },
      },
    }),
    getSettings(),
  ]);

  if (items.length === 0) {
    return (
      <EmptyState className="mt-8" icon={<CircleDollarSign />} title="No sales yet">
        When students buy your paid courses, each sale and your {settings.instructorSharePercent}% share is listed here.
      </EmptyState>
    );
  }

  const total = items.reduce((n, i) => n + i.instructorShareCents, 0);
  const gross = items.reduce((n, i) => n + i.priceCents, 0);
  const months = new Map<string, { label: string; sales: number; share: number }>();
  const courses = new Map<string, { sales: number; share: number }>();
  for (const item of items) {
    const when = item.order.paidAt ?? item.order.createdAt;
    const key = when.toISOString().slice(0, 7);
    const m = months.get(key) ?? { label: formatMonth(when), sales: 0, share: 0 };
    m.sales++;
    m.share += item.instructorShareCents;
    months.set(key, m);
    const c = courses.get(item.title) ?? { sales: 0, share: 0 };
    c.sales++;
    c.share += item.instructorShareCents;
    courses.set(item.title, c);
  }
  const monthRows = [...months.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);
  const peak = Math.max(...monthRows.map(([, m]) => m.share), 1);

  return (
    <div className="mt-8 flex flex-col gap-10">
      <StatGrid>
        <Stat label="Your earnings" value={formatMoney(total)} />
        <Stat label="Gross sales" value={formatMoney(gross)} />
        <Stat label="Sales" value={formatCount(items.length)} />
        <Stat label="Your share" value={`${settings.instructorSharePercent}%`} hint="Applied to new sales" />
      </StatGrid>
      <Alert tone="info">
        These figures show what you have earned. Payouts are arranged with the site administrators and are not sent automatically.
      </Alert>

      <section>
        <h2 className="mb-4 font-display text-xl font-semibold">By month</h2>
        <Table head={["Month", "Sales", "Earnings", ""]}>
          {monthRows.map(([key, m]) => (
            <tr key={key}>
              <td className="font-semibold whitespace-nowrap">{m.label}</td>
              <td>{m.sales}</td>
              <td className="whitespace-nowrap">{formatMoney(m.share)}</td>
              <td className="w-1/2">
                <span className="block h-2 rounded-full bg-brand" style={{ width: `${Math.max(2, (m.share / peak) * 100)}%` }} aria-hidden />
              </td>
            </tr>
          ))}
        </Table>
      </section>

      <section>
        <h2 className="mb-4 font-display text-xl font-semibold">By course</h2>
        <Table head={["Course", "Sales", "Earnings"]}>
          {[...courses.entries()].sort((a, b) => b[1].share - a[1].share).map(([title, c]) => (
            <tr key={title}>
              <td className="font-semibold">{title}</td>
              <td>{c.sales}</td>
              <td className="whitespace-nowrap">{formatMoney(c.share)}</td>
            </tr>
          ))}
        </Table>
      </section>

      <section>
        <h2 className="mb-4 font-display text-xl font-semibold">Recent sales</h2>
        <Table head={["Date", "Course", "Paid", "You earn"]}>
          {items.slice(0, 25).map((i) => (
            <tr key={i.id}>
              <td className="whitespace-nowrap text-muted">{formatDate(i.order.paidAt ?? i.order.createdAt)}</td>
              <td>
                {i.title}
                {i.couponCode ? <span className="ml-2 text-xs text-success">{i.couponCode}</span> : null}
              </td>
              <td className="whitespace-nowrap">{formatMoney(i.priceCents)}</td>
              <td className="font-semibold whitespace-nowrap">{formatMoney(i.instructorShareCents)}</td>
            </tr>
          ))}
        </Table>
      </section>
    </div>
  );
}
