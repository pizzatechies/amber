import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, CircleDashed } from "lucide-react";
import { PublishActions } from "@/components/studio/panels";
import { Alert, Card, Skeleton } from "@/components/ui/misc";
import { publishChecklist } from "@/lib/courses/checklist";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getStudioCourse } from "@/lib/studio-course";
import { studioUrl } from "@/lib/urls";
import { pluralize } from "@/lib/utils";

export const metadata: Metadata = { title: "Publish course" };
type Props = PageProps<"/instructor/courses/[courseId]">;

export default function PublishPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-80 w-full max-w-3xl" />}>
      <Publish params={props.params} />
    </Suspense>
  );
}

async function Publish({ params }: Pick<Props, "params">) {
  const { user, course } = await getStudioCourse((await params).courseId);
  const [ready, unready, enrollments, settings] = await Promise.all([
    db.lecture.count({ where: { courseId: course.id, isReady: true } }),
    db.lecture.count({ where: { courseId: course.id, isReady: false } }),
    db.enrollment.count({ where: { courseId: course.id } }),
    getSettings(),
  ]);
  const checklist = publishChecklist({ ...course, readyLectureCount: ready });
  const complete = checklist.every((i) => i.done);
  const needsReview = settings.requireCourseReview && user.role !== "ADMIN";

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {course.status === "REJECTED" ? (
        <Alert tone="warn" title="The reviewer asked for changes">
          <p className="whitespace-pre-line">{course.reviewNote || "No note was left."}</p>
          <p className="mt-1">Make the changes, then submit the course again.</p>
        </Alert>
      ) : course.status === "IN_REVIEW" ? (
        <Alert tone="info" title="Waiting for review">
          Your course has been submitted. You&apos;ll get a notification as soon as it has been checked. You can keep editing meanwhile.
        </Alert>
      ) : course.status === "PUBLISHED" ? (
        <Alert tone="success" title="This course is live">
          Changes you make to the details and curriculum appear for students straight away.
        </Alert>
      ) : course.status === "UNPUBLISHED" ? (
        <Alert tone="info" title="This course is unpublished">
          It isn&apos;t listed in the catalogue. Existing students still have access.
        </Alert>
      ) : null}

      <Card className="p-6">
        <h2 className="font-display text-xl font-semibold">Before you publish</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {checklist.map((item) => (
            <li key={item.id} className="flex gap-3">
              {item.done ? (
                <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-label="Done" />
              ) : (
                <CircleDashed className="mt-0.5 size-5 shrink-0 text-subtle" aria-label="To do" />
              )}
              <div className="min-w-0">
                <p className="font-semibold">{item.label}</p>
                <p className="text-sm text-muted">
                  {item.detail}{" "}
                  {!item.done ? (
                    <Link href={studioUrl(course.id, item.tab)} className="font-bold text-brand-text hover:underline">
                      Fix this
                    </Link>
                  ) : null}
                </p>
              </div>
            </li>
          ))}
        </ul>
        {unready > 0 ? (
          <p className="mt-4 rounded-lg bg-warn-soft px-3 py-2 text-sm">
            {pluralize(unready, "lecture")} {unready === 1 ? "has" : "have"} no content yet and will stay hidden from students.
          </p>
        ) : null}
      </Card>

      <div>
        <PublishActions
          courseId={course.id}
          status={course.status}
          ready={complete}
          needsReview={needsReview}
          canDelete={enrollments === 0}
        />
        {course.status !== "PUBLISHED" && course.status !== "IN_REVIEW" ? (
          <p className="mt-3 text-sm text-muted">
            {!complete
              ? "Finish the checklist to enable publishing."
              : needsReview
                ? "An administrator reviews each course before it goes live."
                : "The course will appear in the catalogue immediately."}
          </p>
        ) : null}
      </div>
    </div>
  );
}
