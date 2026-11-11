import "server-only";
import { db } from "@/lib/db";

/** Headline numbers for an instructor across all of their courses. */
export async function instructorTotals(instructorId: string) {
  const [courses, earnings, openQuestions] = await Promise.all([
    db.course.aggregate({
      where: { instructorId },
      _count: { _all: true },
      _sum: { enrollmentCount: true, ratingCount: true },
    }),
    db.orderItem.aggregate({
      where: { instructorId, order: { status: "PAID" } },
      _sum: { instructorShareCents: true, priceCents: true },
      _count: { _all: true },
    }),
    db.question.count({ where: { course: { instructorId }, isResolved: false, answers: { none: { userId: instructorId } } } }),
  ]);
  const rated = await db.course.findMany({
    where: { instructorId, ratingCount: { gt: 0 } },
    select: { ratingAvg: true, ratingCount: true },
  });
  const ratings = rated.reduce((n, c) => n + c.ratingCount, 0);
  return {
    courseCount: courses._count._all,
    students: courses._sum.enrollmentCount ?? 0,
    reviews: courses._sum.ratingCount ?? 0,
    rating: ratings > 0 ? rated.reduce((n, c) => n + c.ratingAvg * c.ratingCount, 0) / ratings : 0,
    earningsCents: earnings._sum.instructorShareCents ?? 0,
    salesCents: earnings._sum.priceCents ?? 0,
    saleCount: earnings._count._all,
    openQuestions,
  };
}
