import "server-only";
import { cache } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { courseAccess, type CourseAccess } from "./access";
import { getCourseProgress, type CourseProgress } from "./progress";
import { flattenCurriculum, getCurriculum, type CurriculumLecture, type CurriculumSection } from "./queries";

export type LearnContext = {
  user: Awaited<ReturnType<typeof getCurrentUser>>;
  course: {
    id: string;
    slug: string;
    title: string;
    status: "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "REJECTED" | "UNPUBLISHED";
    instructorId: string;
    instructorName: string;
    priceCents: number;
  };
  access: CourseAccess;
  /** The outline as this viewer may see it. Managers also see unfinished lectures. */
  sections: CurriculumSection[];
  lectures: CurriculumLecture[];
  /** Null for visitors watching a free preview. */
  progress: CourseProgress | null;
  certificateCode: string | null;
  lastLectureId: string | null;
};

/**
 * Everything the course player needs to know about one course for the current
 * viewer. Cached per request, so the layout and the page share one lookup.
 * Returns null when the course does not exist.
 */
export const getLearnContext = cache(async (slug: string): Promise<LearnContext | null> => {
  const user = await getCurrentUser();
  const row = await db.course.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      instructorId: true,
      priceCents: true,
      instructor: { select: { name: true } },
    },
  });
  if (!row) return null;

  const { instructor, ...rest } = row;
  const course = { ...rest, instructorName: instructor.name };
  const access = await courseAccess(user, course);

  const [sections, progress, enrollment, certificate] = await Promise.all([
    getCurriculum(course.id, { readyOnly: !access.canManage }),
    user && access.canLearn ? getCourseProgress(user.id, course.id) : Promise.resolve(null),
    user && access.isEnrolled
      ? db.enrollment.findUnique({
          where: { userId_courseId: { userId: user.id, courseId: course.id } },
          select: { lastLectureId: true },
        })
      : Promise.resolve(null),
    user && access.isEnrolled
      ? db.certificate.findUnique({
          where: { userId_courseId: { userId: user.id, courseId: course.id } },
          select: { code: true },
        })
      : Promise.resolve(null),
  ]);

  return {
    user,
    course,
    access,
    sections,
    lectures: flattenCurriculum(sections),
    progress,
    certificateCode: certificate?.code ?? null,
    lastLectureId: enrollment?.lastLectureId ?? null,
  };
});

/** May this viewer open this lecture in the player? */
export function canOpenLecture(ctx: LearnContext, lecture: CurriculumLecture): boolean {
  if (ctx.access.canLearn) return true;
  return lecture.isPreview && lecture.isReady && ctx.course.status === "PUBLISHED";
}

/** Where to drop a learner who opens the course without picking a lecture. */
export function resumeLectureId(ctx: LearnContext): string | null {
  const ids = new Set(ctx.lectures.map((l) => l.id));
  if (ctx.lastLectureId && ids.has(ctx.lastLectureId)) return ctx.lastLectureId;
  const done = new Set(ctx.progress?.completedIds ?? []);
  return (ctx.lectures.find((l) => !done.has(l.id)) ?? ctx.lectures[0])?.id ?? null;
}
