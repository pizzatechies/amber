import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { NavTabs } from "@/components/site/nav-tabs";
import { LinkButton } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/misc";
import { COURSE_STATUS } from "@/lib/commerce/status";
import { getStudioCourse } from "@/lib/studio-course";
import { courseUrl, learnUrl, studioUrl } from "@/lib/urls";

type Params = LayoutProps<"/instructor/courses/[courseId]">["params"];

export default function CourseEditorLayout({ children, params }: LayoutProps<"/instructor/courses/[courseId]">) {
  return (
    <>
      <Link href="/instructor/courses" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-fg">
        <ChevronLeft className="size-4" aria-hidden /> All courses
      </Link>
      <Suspense fallback={<Skeleton className="mt-3 h-24 w-full" />}>
        <EditorHeader params={params} />
      </Suspense>
      <div className="pt-8">{children}</div>
    </>
  );
}

async function EditorHeader({ params }: { params: Params }) {
  const { course } = await getStudioCourse((await params).courseId);
  const status = COURSE_STATUS[course.status]!;
  const base = studioUrl(course.id);
  return (
    <>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl leading-tight font-semibold sm:text-3xl">{course.title}</h1>
          <p className="mt-2">
            <Badge tone={status.tone}>{status.label}</Badge>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={learnUrl(course.slug)} variant="outline" size="sm">
            Preview as student
          </LinkButton>
          {course.status === "PUBLISHED" ? (
            <LinkButton href={courseUrl(course.slug)} variant="outline" size="sm">
              <ExternalLink aria-hidden /> Public page
            </LinkButton>
          ) : null}
        </div>
      </div>
      <NavTabs
        className="mt-5"
        label="Course editor"
        items={[
          { href: base, label: "Publish", exact: true },
          { href: `${base}/details`, label: "Details" },
          { href: `${base}/goals`, label: "Goals" },
          { href: `${base}/curriculum`, label: "Curriculum" },
          { href: `${base}/pricing`, label: "Pricing" },
          { href: `${base}/students`, label: "Students" },
          { href: `${base}/announcements`, label: "Announcements" },
        ]}
      />
    </>
  );
}
