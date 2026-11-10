import "server-only";
import { ActionError } from "@/lib/action";
import type { SessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import type { CourseStatus } from "@/generated/prisma/enums";

export type CourseAccess = {
  /** The course's instructor, or an admin. May edit and always see everything. */
  canManage: boolean;
  /** Has an active (not refunded) enrollment. */
  isEnrolled: boolean;
  /** May open the course player and all lecture content. */
  canLearn: boolean;
  /** May see the public course page. */
  canViewLanding: boolean;
};

/** Work out what a viewer may do with a course. */
export async function courseAccess(
  user: SessionUser | null,
  course: { id: string; status: CourseStatus; instructorId: string },
): Promise<CourseAccess> {
  const canManage = !!user && (user.role === "ADMIN" || user.id === course.instructorId);
  let isEnrolled = false;
  if (user) {
    const enrollment = await db.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId: course.id } },
      select: { revokedAt: true },
    });
    isEnrolled = !!enrollment && enrollment.revokedAt === null;
  }
  return {
    canManage,
    isEnrolled,
    // Students keep access to what they enrolled in even if it is later unpublished.
    canLearn: canManage || isEnrolled,
    canViewLanding: course.status === "PUBLISHED" || canManage || isEnrolled,
  };
}

/**
 * For instructor actions: load a course the user is allowed to edit, or fail.
 * Admins may edit any course.
 */
export async function manageableCourse(user: SessionUser, courseId: string) {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, slug: true, title: true, status: true, instructorId: true },
  });
  if (!course || (user.role !== "ADMIN" && course.instructorId !== user.id)) {
    throw new ActionError("That course doesn't exist or isn't yours to edit.");
  }
  return course;
}
