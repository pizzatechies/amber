import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ReviewDecisionForm, UnpublishButton } from "@/components/admin/controls";
import { CurriculumOutline } from "@/components/course/curriculum-outline";
import { Markdown } from "@/components/markdown";
import { LinkButton } from "@/components/ui/button";
import { Alert, Badge, Card, Skeleton } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/session";
import { COURSE_STATUS } from "@/lib/commerce/status";
import { publishChecklist } from "@/lib/courses/checklist";
import { getCurriculum } from "@/lib/courses/queries";
import { db } from "@/lib/db";
import { formatDate, formatDuration } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import { LEVELS } from "@/lib/site";
import { learnUrl, studioUrl } from "@/lib/urls";
import { pluralize } from "@/lib/utils";

export const metadata: Metadata = { title: "Review course" };
type Props = PageProps<"/admin/courses/[courseId]">;

export default function AdminCoursePage(props: Props) {
  return (
    <>
      <Link href="/admin/courses" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-fg">
        <ChevronLeft className="size-4" aria-hidden /> All courses
      </Link>
      <Suspense fallback={<Skeleton className="mt-4 h-96 w-full" />}>
        <Review params={props.params} />
      </Suspense>
    </>
  );
}

async function Review({ params }: Pick<Props, "params">) {
  const { courseId } = await params;
  await requireAdmin(`/admin/courses/${courseId}`);
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: {
      id: true, slug: true, title: true, subtitle: true, description: true, status: true, level: true, language: true,
      priceCents: true, outcomes: true, requirements: true, audience: true, categoryId: true, reviewNote: true,
      submittedAt: true, lectureCount: true, durationSec: true,
      category: { select: { name: true } },
      instructor: { select: { id: true, name: true, email: true } },
    },
  });
  if (!course) notFound();
  const sections = await getCurriculum(course.id, { readyOnly: false });
  const lectures = sections.flatMap((s) => s.lectures);
  const ready = lectures.filter((l) => l.isReady).length;
  const missing = publishChecklist({ ...course, readyLectureCount: ready }).filter((i) => !i.done);
  const status = COURSE_STATUS[course.status]!;

  return (
    <div className="mt-3 grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-8">
        <header>
          <Badge tone={status.tone}>{status.label}</Badge>
          <h1 className="mt-2 font-display text-3xl leading-tight font-semibold">{course.title}</h1>
          {course.subtitle ? <p className="mt-2 text-lg text-muted">{course.subtitle}</p> : null}
          <p className="mt-3 text-sm text-muted">
            By <strong className="text-fg">{course.instructor.name}</strong> ({course.instructor.email}) ·{" "}
            {course.category?.name ?? "No category"} · {LEVELS[course.level]} · {course.language} · {formatPrice(course.priceCents)}
          </p>
        </header>

        {course.outcomes.length > 0 ? (
          <section>
            <h2 className="font-display text-xl font-semibold">What students will learn</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {course.outcomes.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </section>
        ) : null}
        <section>
          <h2 className="font-display text-xl font-semibold">Description</h2>
          {course.description ? <Markdown className="mt-2">{course.description}</Markdown> : <p className="mt-2 text-muted">No description.</p>}
        </section>
        <section>
          <h2 className="font-display text-xl font-semibold">Curriculum</h2>
          <p className="mt-1 mb-3 text-sm text-muted">
            {pluralize(ready, "lecture")} with content{lectures.length > ready ? `, ${lectures.length - ready} empty` : ""}
            {course.durationSec > 0 ? ` · ${formatDuration(course.durationSec)}` : ""}. Open any lecture to check its content.
          </p>
          {sections.length > 0 ? <CurriculumOutline sections={sections} slug={course.slug} unlocked /> : <p className="text-muted">No lectures.</p>}
        </section>
      </div>

      <aside>
        <Card className="sticky top-24 flex flex-col gap-5 p-5">
          <LinkButton href={learnUrl(course.slug)} variant="outline">
            Open in the course player
          </LinkButton>
          <LinkButton href={studioUrl(course.id)} variant="ghost" size="sm">
            Open in the editor
          </LinkButton>
          {course.status === "IN_REVIEW" ? (
            <>
              {course.submittedAt ? <p className="text-xs text-subtle">Submitted {formatDate(course.submittedAt)}</p> : null}
              {missing.length > 0 ? (
                <Alert tone="warn" title="Checklist items missing">
                  {missing.map((m) => m.label).join(", ")}
                </Alert>
              ) : null}
              <ReviewDecisionForm courseId={course.id} />
            </>
          ) : course.status === "PUBLISHED" ? (
            <UnpublishButton courseId={course.id} />
          ) : course.status === "REJECTED" ? (
            <Alert tone="info" title="Changes were requested">
              <span className="whitespace-pre-line">{course.reviewNote}</span>
            </Alert>
          ) : (
            <p className="text-sm text-muted">This course is not waiting for review.</p>
          )}
        </Card>
      </aside>
    </div>
  );
}
