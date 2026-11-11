import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { BookCopy, Plus } from "lucide-react";
import { CourseCover } from "@/components/course/cover";
import { LinkButton } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { requireInstructor } from "@/lib/auth/session";
import { COURSE_STATUS } from "@/lib/commerce/status";
import { db } from "@/lib/db";
import { formatCount, formatDate, formatRating } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import { studioUrl } from "@/lib/urls";
import { pluralize } from "@/lib/utils";

export const metadata: Metadata = { title: "Your courses" };

export default function InstructorCoursesPage() {
  return (
    <>
      <PageHeader
        title="Courses"
        actions={
          <LinkButton href="/instructor/courses/new">
            <Plus aria-hidden /> New course
          </LinkButton>
        }
      />
      <div className="mt-8">
        <Suspense fallback={<Skeleton className="h-72 w-full" />}>
          <CourseList />
        </Suspense>
      </div>
    </>
  );
}

async function CourseList() {
  const user = await requireInstructor("/instructor/courses");
  const courses = await db.course.findMany({
    where: { instructorId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      priceCents: true,
      thumbnailAssetId: true,
      enrollmentCount: true,
      ratingAvg: true,
      ratingCount: true,
      lectureCount: true,
      updatedAt: true,
    },
  });

  if (courses.length === 0) {
    return (
      <EmptyState icon={<BookCopy />} title="No courses yet" action={<LinkButton href="/instructor/courses/new">Create a course</LinkButton>}>
        Your drafts and published courses will be listed here.
      </EmptyState>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {courses.map((c) => (
        <li key={c.id}>
          <Link
            href={studioUrl(c.id)}
            className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-3 transition-shadow hover:shadow-card"
          >
            <div className="hidden w-32 shrink-0 overflow-hidden rounded-lg sm:block">
              <CourseCover title={c.title} seed={c.id} assetId={c.thumbnailAssetId} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{c.title}</p>
              <p className="mt-1 text-xs text-subtle">
                {pluralize(c.lectureCount, "lecture")} · {formatPrice(c.priceCents)} · Updated {formatDate(c.updatedAt)}
              </p>
              <p className="mt-1 text-xs text-muted">
                {formatCount(c.enrollmentCount)} students
                {c.ratingCount > 0 ? ` · ${formatRating(c.ratingAvg)} rating (${c.ratingCount})` : ""}
              </p>
            </div>
            <Badge tone={COURSE_STATUS[c.status]!.tone}>{COURSE_STATUS[c.status]!.label}</Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}
