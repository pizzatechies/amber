import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { isSameOrigin, jsonError } from "@/lib/http";

const bodySchema = z.object({
  lectureId: z.string().min(1).max(64),
  positionSec: z.number().finite().min(0).max(60 * 60 * 24),
});

/**
 * Records where a learner is in a lecture. The player calls this every few
 * seconds and when the page is hidden, so it is a Route Handler (works with
 * `navigator.sendBeacon`) rather than a Server Action.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Cross-site request blocked.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Not signed in.", 401);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid request.", 400);
  const { lectureId } = parsed.data;
  const positionSec = Math.floor(parsed.data.positionSec);

  const lecture = await db.lecture.findUnique({
    where: { id: lectureId },
    select: { id: true, courseId: true, course: { select: { instructorId: true } } },
  });
  if (!lecture) return jsonError("Lecture not found.", 404);

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId: lecture.courseId } },
    select: { id: true, revokedAt: true },
  });
  const enrolled = !!enrollment && enrollment.revokedAt === null;
  const manages = user.role === "ADMIN" || lecture.course.instructorId === user.id;
  if (!enrolled && !manages) return jsonError("You don't have access to this lecture.", 403);

  await db.lectureProgress.upsert({
    where: { userId_lectureId: { userId: user.id, lectureId } },
    create: { userId: user.id, lectureId, courseId: lecture.courseId, positionSec },
    update: { positionSec },
  });
  if (enrolled) {
    await db.enrollment.update({
      where: { id: enrollment.id },
      data: { lastLectureId: lectureId, lastAccessedAt: new Date() },
    });
  }
  return new Response(null, { status: 204 });
}
