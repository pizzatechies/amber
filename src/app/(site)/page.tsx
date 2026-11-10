import { Suspense } from "react";
import Link from "next/link";
import Form from "next/form";
import { ArrowRight, BookOpen, Search } from "lucide-react";
import { CourseCard, CourseGrid, CourseGridSkeleton } from "@/components/course/card";
import { CourseCover } from "@/components/course/cover";
import { Button, LinkButton } from "@/components/ui/button";
import { EmptyState, ProgressBar, Skeleton } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { completedCounts, percentOf } from "@/lib/courses/progress";
import { getCategories, listCourses } from "@/lib/courses/queries";
import { db } from "@/lib/db";
import { requestTime } from "@/lib/request";
import { site } from "@/lib/site";
import { learnUrl } from "@/lib/urls";

export default function HomePage() {
  return (
    <>
      <Hero />
      <div className="container-page">
        <Suspense fallback={<HomeSkeleton />}>
          <HomeSections />
        </Suspense>
      </div>
      <TeachBand />
    </>
  );
}

function Hero() {
  return (
    <section className="border-b border-line bg-surface">
      <div className="container-page grid items-center gap-10 py-14 lg:grid-cols-[1.1fr_1fr] lg:py-20">
        <div>
          <p className="text-sm font-bold tracking-wide text-brand-text uppercase">Online courses</p>
          <h1 className="mt-3 font-display text-4xl leading-[1.08] font-semibold sm:text-5xl lg:text-6xl">
            {site.tagline}.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
            Practical courses made by working professionals. Learn at your own pace, keep lifetime access, and earn a
            certificate when you finish.
          </p>
          <Form action="/courses" role="search" className="mt-8 flex max-w-xl gap-2">
            <label className="relative flex-1">
              <span className="sr-only">Search courses</span>
              <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-subtle" aria-hidden />
              <input
                type="search"
                name="q"
                placeholder="What do you want to learn?"
                className="h-12 w-full rounded-full border border-line-strong bg-bg pr-4 pl-12 placeholder:text-subtle hover:border-fg/40 focus:border-focus focus:outline-2 focus:outline-offset-0 focus:outline-focus/30"
              />
            </label>
            <Button type="submit" size="lg" className="rounded-full">
              Search
            </Button>
          </Form>
        </div>

        {/* Decorative stack of generated covers */}
        <div aria-hidden className="relative mx-auto hidden h-80 w-full max-w-md lg:block">
          <div className="absolute top-2 left-0 w-64 -rotate-6 overflow-hidden rounded-2xl border border-line shadow-pop">
            <CourseCover title="Design" seed="hero-design-3" />
          </div>
          <div className="absolute top-16 right-0 w-64 rotate-3 overflow-hidden rounded-2xl border border-line shadow-pop">
            <CourseCover title="Business" seed="hero-business-12" />
          </div>
          <div className="absolute bottom-0 left-16 w-72 -rotate-1 overflow-hidden rounded-2xl border border-line shadow-pop">
            <CourseCover title="Code" seed="hero-code-5" />
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({ title, href }: { title: string; href?: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <h2 className="font-display text-2xl font-semibold sm:text-3xl">{title}</h2>
      {href ? (
        <Link href={href} className="flex shrink-0 items-center gap-1 text-sm font-bold text-brand-text hover:underline">
          See all <ArrowRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

async function HomeSections() {
  const user = await getCurrentUser();
  const now = await requestTime();

  const [categories, popular, newest, continuing] = await Promise.all([
    getCategories(),
    listCourses("popular", 8),
    listCourses("newest", 4),
    user ? continueLearning(user.id) : Promise.resolve([]),
  ]);

  if (popular.length === 0) {
    return (
      <EmptyState
        className="my-16"
        icon={<BookOpen />}
        title="No courses have been published yet"
        action={<LinkButton href="/teach">Create the first course</LinkButton>}
      >
        This is a fresh installation. Publish a course from the instructor studio, or load the demo catalogue with{" "}
        <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">npm run db:seed:demo</code>.
      </EmptyState>
    );
  }

  const topRated = [...popular]
    .filter((c) => c.ratingCount > 0)
    .sort((a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount)
    .slice(0, 4);

  return (
    <>
      {continuing.length > 0 ? (
        <section className="pt-12">
          <SectionHeading title="Continue learning" href="/my-learning" />
          <div className="grid gap-4 md:grid-cols-3">
            {continuing.map((c) => (
              <Link
                key={c.id}
                href={learnUrl(c.slug)}
                className="group flex gap-4 rounded-2xl border border-line bg-surface p-3 transition-shadow hover:shadow-card"
              >
                <div className="w-28 shrink-0 overflow-hidden rounded-lg">
                  <CourseCover title={c.title} seed={c.id} assetId={c.thumbnailAssetId} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center">
                  <p className="line-clamp-2 text-sm leading-snug font-bold group-hover:text-brand-text">{c.title}</p>
                  <ProgressBar value={c.percent} className="mt-2.5" label={`${c.title} progress`} />
                  <p className="mt-1.5 text-xs text-subtle">{c.percent}% complete</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="pt-12">
        <SectionHeading title="Browse by category" />
        <ul className="flex flex-wrap gap-2.5">
          {categories
            .filter((c) => c.courseCount > 0)
            .map((c) => (
              <li key={c.id}>
                <Link
                  href={`/courses?category=${c.slug}`}
                  className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-4 py-2 text-sm font-semibold hover:border-fg/50 hover:bg-surface-2"
                >
                  {c.name}
                  <span className="text-xs font-normal text-subtle">{c.courseCount}</span>
                </Link>
              </li>
            ))}
        </ul>
      </section>

      <section className="pt-14">
        <SectionHeading title="Popular right now" href="/courses" />
        <CourseGrid>
          {popular.map((c) => (
            <CourseCard key={c.id} course={c} now={now} />
          ))}
        </CourseGrid>
      </section>

      {topRated.length >= 4 ? (
        <section className="pt-14">
          <SectionHeading title="Highest rated" href="/courses?sort=rating" />
          <CourseGrid>
            {topRated.map((c) => (
              <CourseCard key={c.id} course={c} now={now} />
            ))}
          </CourseGrid>
        </section>
      ) : null}

      <section className="pt-14">
        <SectionHeading title="New and noteworthy" href="/courses?sort=newest" />
        <CourseGrid>
          {newest.map((c) => (
            <CourseCard key={c.id} course={c} now={now} />
          ))}
        </CourseGrid>
      </section>
    </>
  );
}

async function continueLearning(userId: string) {
  const enrollments = await db.enrollment.findMany({
    where: { userId, revokedAt: null, completedAt: null },
    orderBy: [{ lastAccessedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: 3,
    select: { course: { select: { id: true, slug: true, title: true, thumbnailAssetId: true, lectureCount: true } } },
  });
  const done = await completedCounts(
    userId,
    enrollments.map((e) => e.course.id),
  );
  return enrollments.map(({ course }) => ({
    ...course,
    percent: percentOf(done[course.id] ?? 0, course.lectureCount),
  }));
}

function HomeSkeleton() {
  return (
    <div className="pt-12" aria-busy="true">
      <Skeleton className="mb-6 h-8 w-56" />
      <div className="flex flex-wrap gap-2.5">
        {[112, 96, 80, 104, 128, 88].map((w, i) => (
          <Skeleton key={i} className="h-10 rounded-full" style={{ width: w }} />
        ))}
      </div>
      <Skeleton className="mt-14 mb-6 h-8 w-64" />
      <CourseGridSkeleton count={8} />
    </div>
  );
}

function TeachBand() {
  return (
    <section className="container-page pt-20">
      <div className="relative overflow-hidden rounded-3xl bg-ink px-6 py-12 text-paper sm:px-12">
        <div className="relative z-10 max-w-xl">
          <h2 className="font-display text-3xl font-semibold sm:text-4xl">Know something worth teaching?</h2>
          <p className="mt-3 leading-relaxed text-paper-muted">
            Publish video lessons, articles, documents and quizzes. Set your own price, and keep the larger share of
            every sale.
          </p>
          <LinkButton href="/teach" size="lg" className="mt-7">
            Start teaching <ArrowRight aria-hidden />
          </LinkButton>
        </div>
        <svg aria-hidden viewBox="0 0 300 300" className="absolute -right-10 -bottom-24 hidden h-96 w-96 md:block">
          <circle cx="150" cy="150" r="150" fill="var(--brand)" />
          <circle cx="150" cy="150" r="92" fill="var(--ink)" />
          <circle cx="150" cy="150" r="40" fill="var(--brand)" />
        </svg>
      </div>
    </section>
  );
}
