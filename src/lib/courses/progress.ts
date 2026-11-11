import "server-only";
import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { percentOf } from "./progress-math";

export { percentOf };

// ───────────────────────── Reading progress ─────────────────────────

export type CourseProgress = {
  /** Ids of completed lectures (ready ones only). */
  completedIds: string[];
  /** Saved playback position per lecture, in seconds. */
  positions: Record<string, number>;
  completed: number;
  total: number;
  percent: number;
};

/** A learner's progress through one course, counted over lectures students can see. */
export async function getCourseProgress(userId: string, courseId: string): Promise<CourseProgress> {
  const [total, rows] = await Promise.all([
    db.lecture.count({ where: { courseId, isReady: true } }),
    db.lectureProgress.findMany({
      where: { userId, courseId, lecture: { isReady: true } },
      select: { lectureId: true, positionSec: true, completedAt: true },
    }),
  ]);
  const completedIds = rows.filter((r) => r.completedAt).map((r) => r.lectureId);
  const positions = Object.fromEntries(rows.map((r) => [r.lectureId, r.positionSec]));
  return {
    completedIds,
    positions,
    completed: completedIds.length,
    total,
    percent: percentOf(completedIds.length, total),
  };
}

/** Completed-lecture counts for many courses at once: { courseId: count }. */
export async function completedCounts(userId: string, courseIds: string[]): Promise<Record<string, number>> {
  if (courseIds.length === 0) return {};
  const groups = await db.lectureProgress.groupBy({
    by: ["courseId"],
    where: { userId, courseId: { in: courseIds }, completedAt: { not: null }, lecture: { isReady: true } },
    _count: { _all: true },
  });
  return Object.fromEntries(groups.map((g) => [g.courseId, g._count._all]));
}

// ───────────────────────── Writing progress ─────────────────────────

export type CompletionOutcome = {
  percent: number;
  completed: number;
  total: number;
  /** Set when this change finished the course and a certificate now exists. */
  certificateCode: string | null;
  /** True only the first time the course reaches 100%. */
  justCompleted: boolean;
};

/**
 * Mark a lecture complete or incomplete, then update the enrollment's
 * completion state and issue a certificate the first time everything is done.
 * The caller must already have checked that the user may learn this course.
 */
export async function setLectureCompletion(
  userId: string,
  lecture: { id: string; courseId: string },
  completed: boolean,
): Promise<CompletionOutcome> {
  const now = new Date();
  await db.lectureProgress.upsert({
    where: { userId_lectureId: { userId, lectureId: lecture.id } },
    create: { userId, lectureId: lecture.id, courseId: lecture.courseId, completedAt: completed ? now : null },
    update: { completedAt: completed ? now : null },
  });

  const progress = await getCourseProgress(userId, lecture.courseId);
  const allDone = progress.total > 0 && progress.completed >= progress.total;

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: lecture.courseId } },
    select: { id: true, completedAt: true, revokedAt: true },
  });

  let certificateCode: string | null = null;
  let justCompleted = false;

  // Instructors and admins previewing their own course have no enrollment, and get no certificate.
  if (enrollment && enrollment.revokedAt === null) {
    if (allDone && !enrollment.completedAt) {
      await db.enrollment.update({ where: { id: enrollment.id }, data: { completedAt: now } });
      justCompleted = true;
    }
    if (allDone) certificateCode = await ensureCertificate(userId, lecture.courseId);
  }

  return {
    percent: progress.percent,
    completed: progress.completed,
    total: progress.total,
    certificateCode,
    justCompleted,
  };
}

// ───────────────────────── Certificates ─────────────────────────

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

/** A verification code such as "K7QM-2XHD-9PRA". */
export function newCertificateCode(): string {
  const group = () => Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
  return `${group()}-${group()}-${group()}`;
}

/** Return the learner's certificate for a course, creating it if needed. */
export async function ensureCertificate(userId: string, courseId: string): Promise<string> {
  const existing = await db.certificate.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { code: true },
  });
  if (existing) return existing.code;

  const [user, course] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } }),
    db.course.findUniqueOrThrow({
      where: { id: courseId },
      select: { title: true, instructor: { select: { name: true } } },
    }),
  ]);

  try {
    const created = await db.certificate.create({
      data: {
        code: newCertificateCode(),
        userId,
        courseId,
        recipientName: user.name,
        courseTitle: course.title,
        instructorName: course.instructor.name,
      },
      select: { code: true },
    });
    return created.code;
  } catch {
    // Two requests finished the course at once: the other one won, use its certificate.
    const winner = await db.certificate.findUniqueOrThrow({
      where: { userId_courseId: { userId, courseId } },
      select: { code: true },
    });
    return winner.code;
  }
}
