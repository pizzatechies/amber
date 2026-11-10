import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { CourseCard, CourseGrid, CourseGridSkeleton } from "@/components/course/card";
import { Avatar, Skeleton } from "@/components/ui/misc";
import { listCourses } from "@/lib/courses/queries";
import { db } from "@/lib/db";
import { formatCount, formatRating } from "@/lib/format";
import { requestTime } from "@/lib/request";

type Props = PageProps<"/instructors/[id]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const user = await db.user.findUnique({ where: { id }, select: { name: true, headline: true, role: true } });
  if (!user || user.role === "STUDENT") return { title: "Instructor" };
  return { title: user.name, description: user.headline || undefined };
}

export default function InstructorPage(props: Props) {
  return (
    <div className="container-page py-10">
      <Suspense
        fallback={
          <div aria-busy="true">
            <Skeleton className="h-28 w-full max-w-2xl" />
            <CourseGridSkeleton count={4} className="mt-12" />
          </div>
        }
      >
        <Instructor params={props.params} />
      </Suspense>
    </div>
  );
}

async function Instructor({ params }: Pick<Props, "params">) {
  const { id } = await params;
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, name: true, headline: true, bio: true, websiteUrl: true, avatarAssetId: true, role: true, status: true },
  });
  if (!user || user.role === "STUDENT" || user.status !== "ACTIVE") notFound();

  const [courses, stats, now] = await Promise.all([
    listCourses("popular", 48, { instructorId: user.id }),
    db.course.aggregate({
      where: { instructorId: user.id, status: "PUBLISHED" },
      _sum: { enrollmentCount: true, ratingCount: true },
    }),
    requestTime(),
  ]);
  const rated = courses.filter((c) => c.ratingCount > 0);
  const totalRatings = rated.reduce((sum, c) => sum + c.ratingCount, 0);
  const average = totalRatings > 0 ? rated.reduce((sum, c) => sum + c.ratingAvg * c.ratingCount, 0) / totalRatings : 0;

  const facts = [
    { label: "Students", value: formatCount(stats._sum.enrollmentCount ?? 0) },
    { label: "Reviews", value: formatCount(stats._sum.ratingCount ?? 0) },
    { label: "Average rating", value: totalRatings > 0 ? formatRating(average) : "—" },
    { label: "Courses", value: formatCount(courses.length) },
  ];

  return (
    <>
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <Avatar name={user.name} assetId={user.avatarAssetId} size={112} />
        <div className="min-w-0">
          <p className="text-sm font-bold tracking-wide text-brand-text uppercase">Instructor</p>
          <h1 className="mt-1 font-display text-4xl font-semibold">{user.name}</h1>
          {user.headline ? <p className="mt-1 text-lg text-muted">{user.headline}</p> : null}
          <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
            {facts.map((f) => (
              <div key={f.label}>
                <dd className="font-display text-2xl font-semibold">{f.value}</dd>
                <dt className="text-xs text-muted">{f.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </header>

      {user.bio ? (
        <section className="mt-10 max-w-3xl">
          <h2 className="font-display text-2xl font-semibold">About</h2>
          <p className="mt-3 leading-relaxed whitespace-pre-line">{user.bio}</p>
          {user.websiteUrl ? (
            <a
              href={user.websiteUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-brand-text hover:underline"
            >
              <ExternalLink className="size-4" aria-hidden /> Website
            </a>
          ) : null}
        </section>
      ) : null}

      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">Courses by {user.name}</h2>
        {courses.length > 0 ? (
          <CourseGrid className="mt-6">
            {courses.map((c) => (
              <CourseCard key={c.id} course={c} now={now} />
            ))}
          </CourseGrid>
        ) : (
          <p className="mt-3 text-muted">No published courses yet.</p>
        )}
      </section>
    </>
  );
}
