import "server-only";
import type { Tx } from "@/lib/db";
import { refreshEnrollmentCount } from "@/lib/courses/stats";
import type { EnrollmentSource } from "@/generated/prisma/enums";

/**
 * Give a user access to a course. Re-activates a previously revoked
 * enrollment, and clears the course from the user's cart and wishlist.
 */
export async function grantEnrollment(
  tx: Tx,
  userId: string,
  courseId: string,
  source: EnrollmentSource,
): Promise<void> {
  await tx.enrollment.upsert({
    where: { userId_courseId: { userId, courseId } },
    create: { userId, courseId, source },
    update: { revokedAt: null, source },
  });
  await tx.cartItem.deleteMany({ where: { userId, courseId } });
  await tx.wishlistItem.deleteMany({ where: { userId, courseId } });
  await refreshEnrollmentCount(courseId, tx);
}
