import "server-only";
import { db, type Tx } from "@/lib/db";
import { readQuiz } from "./quiz";
import { embedUrl } from "./video";

type ReadinessInput = {
  type: "VIDEO" | "ARTICLE" | "DOCUMENT" | "QUIZ";
  mediaAssetId: string | null;
  videoUrl: string;
  content: string;
  quiz: unknown;
};

/** A lecture is shown to students only once it actually has something to show. */
export function lectureIsReady(l: ReadinessInput): boolean {
  switch (l.type) {
    case "VIDEO":
      return !!l.mediaAssetId || embedUrl(l.videoUrl) !== null;
    case "DOCUMENT":
      return !!l.mediaAssetId;
    case "ARTICLE":
      return l.content.trim().length > 0;
    case "QUIZ":
      return (readQuiz(l.quiz)?.questions.length ?? 0) > 0;
  }
}

/** Recompute a course's lecture count and total duration from its ready lectures. */
export async function refreshCourseContentStats(courseId: string, client: Tx | typeof db = db): Promise<void> {
  const agg = await client.lecture.aggregate({
    where: { courseId, isReady: true },
    _count: { _all: true },
    _sum: { durationSec: true },
  });
  await client.course.update({
    where: { id: courseId },
    data: { lectureCount: agg._count._all, durationSec: agg._sum.durationSec ?? 0 },
  });
}

/** Recompute a course's average rating and review count. */
export async function refreshCourseRating(courseId: string, client: Tx | typeof db = db): Promise<void> {
  const agg = await client.review.aggregate({
    where: { courseId },
    _count: { _all: true },
    _avg: { rating: true },
  });
  await client.course.update({
    where: { id: courseId },
    data: { ratingCount: agg._count._all, ratingAvg: agg._avg.rating ?? 0 },
  });
}

/** Recompute how many students currently have access to a course. */
export async function refreshEnrollmentCount(courseId: string, client: Tx | typeof db = db): Promise<void> {
  const count = await client.enrollment.count({ where: { courseId, revokedAt: null } });
  await client.course.update({ where: { id: courseId }, data: { enrollmentCount: count } });
}
