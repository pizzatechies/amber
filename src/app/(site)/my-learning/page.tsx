import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Award, BookOpen, CircleCheck } from "lucide-react";
import { CourseCover } from "@/components/course/cover";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, ProgressBar, Skeleton } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { completedCounts, percentOf } from "@/lib/courses/progress";
import { db } from "@/lib/db";
import { learnUrl } from "@/lib/urls";
import { cn, firstParam } from "@/lib/utils";

export const metadata: Metadata = { title: "My learning" };

const FILTERS = [
  { id: "", label: "All courses" },
  { id: "in-progress", label: "In progress" },
  { id: "completed", label: "Completed" },
];

export default function MyLearningPage(props: PageProps<"/my-learning">) {
  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">My learning</h1>
        <LinkButton href="/my-learning/certificates" variant="outline">
          <Award aria-hidden /> My certificates
        </LinkButton>
      </div>
      <Suspense fallback={<Skeleton className="mt-8 h-72 w-full" />}>
        <Enrollments searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Enrollments({ searchParams }: Pick<PageProps<"/my-learning">, "searchParams">) {
  const filter = firstParam((await searchParams).filter) ?? "";
  const user = await requireUser("/my-learning");

  const enrollments = await db.enrollment.findMany({
    where: { userId: user.id, revokedAt: null },
    orderBy: [{ lastAccessedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    select: {
      completedAt: true,
      course: {
        select: {
          id: true,
          slug: true,
          title: true,
          thumbnailAssetId: true,
          lectureCount: true,
          instructor: { select: { name: true } },
        },
      },
    },
  });

  if (enrollments.length === 0) {
    return (
      <EmptyState
        className="mt-8"
        icon={<BookOpen />}
        title="You haven't enrolled in anything yet"
        action={<LinkButton href="/courses">Browse courses</LinkButton>}
      >
        When you enroll in a course it appears here, along with your progress.
      </EmptyState>
    );
  }

  const done = await completedCounts(
    user.id,
    enrollments.map((e) => e.course.id),
  );
  const all = enrollments.map(({ course }) => {
    const percent = percentOf(done[course.id] ?? 0, course.lectureCount);
    return { ...course, percent, finished: course.lectureCount > 0 && percent === 100 };
  });
  const shown = all.filter((c) => (filter === "completed" ? c.finished : filter === "in-progress" ? !c.finished : true));

  return (
    <>
      <nav aria-label="Filter courses" className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={f.id ? `/my-learning?filter=${f.id}` : "/my-learning"}
            aria-current={filter === f.id ? "true" : undefined}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-semibold",
              filter === f.id ? "border-fg bg-fg text-bg" : "border-line-strong hover:bg-surface-2",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <p className="mt-10 text-muted">No courses match this filter.</p>
      ) : (
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((course) => (
            <li key={course.id} className="group relative flex flex-col">
              <div className="overflow-hidden rounded-xl border border-line transition-shadow group-hover:shadow-card">
                <CourseCover title={course.title} seed={course.id} assetId={course.thumbnailAssetId} />
              </div>
              <h2 className="mt-3 line-clamp-2 leading-snug font-bold">
                <Link href={learnUrl(course.slug)} className="after:absolute after:inset-0 group-hover:text-brand-text">
                  {course.title}
                </Link>
              </h2>
              <p className="mt-1 text-sm text-muted">{course.instructor.name}</p>
              <ProgressBar value={course.percent} className="mt-3" label={`${course.title} progress`} />
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-subtle">
                {course.finished ? (
                  <>
                    <CircleCheck className="size-3.5 text-success" aria-hidden /> Completed
                  </>
                ) : course.percent > 0 ? (
                  `${course.percent}% complete`
                ) : (
                  "Not started"
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
