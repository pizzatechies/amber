import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireInstructor } from "@/lib/auth/session";
import { db } from "@/lib/db";

/**
 * The course being edited, for the signed-in instructor. 404s when the course
 * doesn't exist or belongs to someone else (admins may open any course).
 * Cached per request so the editor layout and page share one lookup.
 */
export const getStudioCourse = cache(async (courseId: string) => {
  const user = await requireInstructor(`/instructor/courses/${courseId}`);
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      description: true,
      language: true,
      level: true,
      categoryId: true,
      priceCents: true,
      outcomes: true,
      requirements: true,
      audience: true,
      thumbnailAssetId: true,
      promoAssetId: true,
      promo: { select: { filename: true } },
      status: true,
      reviewNote: true,
      instructorId: true,
      enrollmentCount: true,
      lectureCount: true,
      publishedAt: true,
    },
  });
  if (!course || (user.role !== "ADMIN" && course.instructorId !== user.id)) notFound();
  return { user, course };
});
