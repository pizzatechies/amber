import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Stat, StatGrid, Table } from "@/components/studio/stat";
import { Alert, Badge, PageHeader, Skeleton } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/session";
import { ORDER_STATUS } from "@/lib/commerce/status";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { formatCount, formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { payments } from "@/lib/payments";

export const metadata: Metadata = { title: "Admin overview" };

export default function AdminPage() {
  return (
    <>
      <PageHeader title="Overview" />
      <div className="mt-8">
        <Suspense fallback={<Skeleton className="h-80 w-full" />}>
          <Overview />
        </Suspense>
      </div>
    </>
  );
}

async function Overview() {
  await requireAdmin("/admin");
  const [users, instructors, published, pending, enrollments, sales, recent] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { role: "INSTRUCTOR" } }),
    db.course.count({ where: { status: "PUBLISHED" } }),
    db.course.count({ where: { status: "IN_REVIEW" } }),
    db.enrollment.count({ where: { revokedAt: null } }),
    db.orderItem.aggregate({ where: { order: { status: "PAID" } }, _sum: { priceCents: true, instructorShareCents: true } }),
    db.order.findMany({
      where: { status: { in: ["PAID", "REFUNDED"] } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, number: true, status: true, totalCents: true, currency: true, createdAt: true, user: { select: { name: true } } },
    }),
  ]);
  const gross = sales._sum.priceCents ?? 0;
  const owed = sales._sum.instructorShareCents ?? 0;

  return (
    <div className="flex flex-col gap-8">
      {pending > 0 ? (
        <Alert tone="warn" title={`${pending} course${pending === 1 ? " is" : "s are"} waiting for review`}>
          <Link href="/admin/courses?status=in_review" className="font-bold text-brand-text hover:underline">
            Open the review queue
          </Link>
        </Alert>
      ) : null}
      {payments().isTestMode ? (
        <Alert tone="info" title="Payments are in test mode">
          {env().PAYMENT_PROVIDER === "sandbox"
            ? "The sandbox provider simulates payments and never charges anyone. Configure a real provider before selling."
            : "Stripe is using a test key. No real money is collected."}
        </Alert>
      ) : null}
      <StatGrid>
        <Stat label="Users" value={formatCount(users)} hint={`${formatCount(instructors)} instructors`} />
        <Stat label="Published courses" value={formatCount(published)} hint={`${formatCount(pending)} in review`} />
        <Stat label="Enrollments" value={formatCount(enrollments)} />
        <Stat label="Gross sales" value={formatMoney(gross)} hint={`${formatMoney(gross - owed)} platform share`} />
      </StatGrid>
      <section>
        <h2 className="mb-4 font-display text-xl font-semibold">Recent orders</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted">No orders yet.</p>
        ) : (
          <Table head={["Order", "Buyer", "Date", "Total", "Status"]}>
            {recent.map((o) => (
              <tr key={o.id}>
                <td className="font-semibold">#{o.number}</td>
                <td>{o.user.name}</td>
                <td className="whitespace-nowrap text-muted">{formatDate(o.createdAt)}</td>
                <td className="whitespace-nowrap">{formatMoney(o.totalCents, o.currency)}</td>
                <td>
                  <Badge tone={ORDER_STATUS[o.status]!.tone}>{ORDER_STATUS[o.status]!.label}</Badge>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}
