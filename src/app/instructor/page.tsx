import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Stat, StatGrid } from "@/components/studio/stat";
import { LinkButton } from "@/components/ui/button";
import { Alert, Avatar, Badge, Card, PageHeader, Skeleton } from "@/components/ui/misc";
import { requireInstructor } from "@/lib/auth/session";
import { COURSE_STATUS } from "@/lib/commerce/status";
import { db } from "@/lib/db";
import { formatCount, formatRating, timeAgo } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { requestTime } from "@/lib/request";
import { instructorTotals } from "@/lib/studio";
import { studioUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Instructor dashboard" };

export default function InstructorDashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        actions={
          <LinkButton href="/instructor/courses/new">
            <Plus aria-hidden /> New course
          </LinkButton>
        }
      />
      <div className="mt-8">
        <Suspense fallback={<Skeleton className="h-80 w-full" />}>
          <Dashboard />
        </Suspense>
      </div>
    </>
  );
}

async function Dashboard() {
  const user = await requireInstructor("/instructor");
  const [totals, courses, recent, now] = await Promise.all([
    instructorTotals(user.id),
    db.course.findMany({
      where: { instructorId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, title: true, status: true, enrollmentCount: true, reviewNote: true },
    }),
    db.enrollment.findMany({
      where: { course: { instructorId: user.id }, revokedAt: null },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, createdAt: true, user: { select: { name: true, avatarAssetId: true } }, course: { select: { title: true } } },
    }),
    requestTime(),
  ]);

  if (totals.courseCount === 0) {
    return (
      <Card className="p-8 text-center">
        <h2 className="font-display text-2xl font-semibold">Create your first course</h2>
        <p className="mx-auto mt-2 max-w-md text-muted">
          Start with a title. You can add lessons, set a price and publish whenever you&apos;re ready.
        </p>
        <LinkButton href="/instructor/courses/new" size="lg" className="mt-6">
          <Plus aria-hidden /> New course
        </LinkButton>
      </Card>
    );
  }

  const rejected = courses.filter((c) => c.status === "REJECTED");
  return (
    <div className="flex flex-col gap-8">
      {rejected.map((c) => (
        <Alert key={c.id} tone="warn" title={`Changes requested for “${c.title}”`}>
          {c.reviewNote || "The reviewer asked for changes."}{" "}
          <Link href={studioUrl(c.id)} className="font-bold text-brand-text hover:underline">
            Open course
          </Link>
        </Alert>
      ))}
      <StatGrid>
        <Stat label="Students" value={formatCount(totals.students)} />
        <Stat label="Your earnings" value={formatMoney(totals.earningsCents)} hint={`${formatCount(totals.saleCount)} sales`} />
        <Stat label="Average rating" value={totals.reviews > 0 ? formatRating(totals.rating) : "—"} hint={`${formatCount(totals.reviews)} reviews`} />
        <Stat
          label="Unanswered questions"
          value={formatCount(totals.openQuestions)}
          hint={totals.openQuestions > 0 ? <Link href="/instructor/questions" className="font-bold text-brand-text hover:underline">Answer them</Link> : "All caught up"}
        />
      </StatGrid>

      <div className="grid gap-8 xl:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Your courses</h2>
            <Link href="/instructor/courses" className="text-sm font-bold text-brand-text hover:underline">
              See all
            </Link>
          </div>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {courses.map((c) => (
              <li key={c.id}>
                <Link href={studioUrl(c.id)} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                  <span className="min-w-0 flex-1 truncate font-semibold">{c.title}</span>
                  <span className="shrink-0 text-xs text-subtle">{formatCount(c.enrollmentCount)} students</span>
                  <Badge tone={COURSE_STATUS[c.status]!.tone}>{COURSE_STATUS[c.status]!.label}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl font-semibold">Recent enrollments</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-muted">No students yet. They&apos;ll appear here as they enroll.</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {recent.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={e.user.name} assetId={e.user.avatarAssetId} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{e.user.name}</span>
                    <span className="block truncate text-xs text-subtle">{e.course.title}</span>
                  </span>
                  <span className="shrink-0 text-xs text-subtle">{timeAgo(e.createdAt, new Date(now))}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
