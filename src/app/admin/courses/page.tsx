import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Table } from "@/components/studio/stat";
import { Badge, PageHeader, Pagination, Skeleton } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/session";
import { COURSE_STATUS } from "@/lib/commerce/status";
import { db } from "@/lib/db";
import { formatCount, formatDate } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import type { CourseStatus } from "@/generated/prisma/enums";
import { cn, firstParam, pageParam } from "@/lib/utils";

export const metadata: Metadata = { title: "Courses" };
const PAGE_SIZE = 25;
const FILTERS: Array<{ id: string; label: string; status?: CourseStatus }> = [
  { id: "in_review", label: "In review", status: "IN_REVIEW" },
  { id: "published", label: "Published", status: "PUBLISHED" },
  { id: "draft", label: "Drafts", status: "DRAFT" },
  { id: "rejected", label: "Changes requested", status: "REJECTED" },
  { id: "unpublished", label: "Unpublished", status: "UNPUBLISHED" },
  { id: "all", label: "All" },
];

export default function AdminCoursesPage(props: PageProps<"/admin/courses">) {
  return (
    <>
      <PageHeader title="Courses" description="Review submissions and moderate the catalogue." />
      <Suspense fallback={<Skeleton className="mt-8 h-80 w-full" />}>
        <Courses searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Courses({ searchParams }: Pick<PageProps<"/admin/courses">, "searchParams">) {
  const sp = await searchParams;
  await requireAdmin("/admin/courses");
  const filter = FILTERS.find((f) => f.id === firstParam(sp.status)) ?? FILTERS[0]!;
  const page = pageParam(sp.page);
  const where = filter.status ? { status: filter.status } : {};
  const [total, courses, counts] = await Promise.all([
    db.course.count({ where }),
    db.course.findMany({
      where,
      orderBy: filter.status === "IN_REVIEW" ? { submittedAt: "asc" } : { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        status: true,
        priceCents: true,
        enrollmentCount: true,
        submittedAt: true,
        updatedAt: true,
        instructor: { select: { name: true } },
      },
    }),
    db.course.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const countOf = (s?: CourseStatus) => (s ? (counts.find((c) => c.status === s)?._count._all ?? 0) : counts.reduce((n, c) => n + c._count._all, 0));

  return (
    <>
      <nav aria-label="Filter by status" className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={`/admin/courses?status=${f.id}`}
            aria-current={f.id === filter.id ? "true" : undefined}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-semibold",
              f.id === filter.id ? "border-fg bg-fg text-bg" : "border-line-strong hover:bg-surface-2",
            )}
          >
            {f.label} <span className="font-normal opacity-70">{countOf(f.status)}</span>
          </Link>
        ))}
      </nav>
      <div className="mt-6">
        {courses.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center text-muted">
            {filter.id === "in_review" ? "Nothing is waiting for review." : "No courses here."}
          </p>
        ) : (
          <Table head={["Course", "Instructor", "Price", "Students", filter.status === "IN_REVIEW" ? "Submitted" : "Updated", "Status"]}>
            {courses.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/admin/courses/${c.id}`} className="font-semibold text-brand-text hover:underline">
                    {c.title}
                  </Link>
                </td>
                <td>{c.instructor.name}</td>
                <td className="whitespace-nowrap">{formatPrice(c.priceCents)}</td>
                <td>{formatCount(c.enrollmentCount)}</td>
                <td className="whitespace-nowrap text-muted">{formatDate(filter.status === "IN_REVIEW" && c.submittedAt ? c.submittedAt : c.updatedAt)}</td>
                <td>
                  <Badge tone={COURSE_STATUS[c.status]!.tone}>{COURSE_STATUS[c.status]!.label}</Badge>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>
      <div className="mt-6">
        <Pagination page={page} pageCount={Math.ceil(total / PAGE_SIZE)} basePath="/admin/courses" params={{ status: filter.id }} />
      </div>
    </>
  );
}
