import "server-only";
import { db } from "@/lib/db";
import { priceLine, sumLines, type PricedLine, type Totals } from "./pricing";

export type CartLine = PricedLine & {
  course: {
    id: string;
    slug: string;
    title: string;
    thumbnailAssetId: string | null;
    instructorId: string;
    instructorName: string;
    ratingAvg: number;
    ratingCount: number;
    durationSec: number;
    lectureCount: number;
  };
  /** Set when this item can't be bought (unpublished, already owned, ...). */
  problem: string | null;
};

export type Cart = {
  lines: CartLine[];
  /** Lines without a problem: what checkout will actually charge for. */
  purchasable: CartLine[];
  totals: Totals;
};

/** The user's cart with current prices. `now` is the request time in ms. */
export async function getCart(userId: string, now: number): Promise<Cart> {
  const [items, enrollments] = await Promise.all([
    db.cartItem.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: {
        coupon: true,
        course: {
          select: {
            id: true,
            slug: true,
            title: true,
            status: true,
            priceCents: true,
            thumbnailAssetId: true,
            instructorId: true,
            ratingAvg: true,
            ratingCount: true,
            durationSec: true,
            lectureCount: true,
            instructor: { select: { name: true } },
          },
        },
      },
    }),
    db.enrollment.findMany({ where: { userId, revokedAt: null }, select: { courseId: true } }),
  ]);
  const owned = new Set(enrollments.map((e) => e.courseId));

  const lines: CartLine[] = items.map(({ course, coupon }) => {
    const problem =
      course.status !== "PUBLISHED"
        ? "This course is no longer available."
        : owned.has(course.id)
          ? "You already have this course."
          : course.instructorId === userId
            ? "This is your own course."
            : null;
    // A coupon only counts for the course it was created for.
    const validCoupon = coupon && coupon.courseId === course.id ? coupon : null;
    return {
      ...priceLine(course.priceCents, validCoupon, now),
      problem,
      course: {
        id: course.id,
        slug: course.slug,
        title: course.title,
        thumbnailAssetId: course.thumbnailAssetId,
        instructorId: course.instructorId,
        instructorName: course.instructor.name,
        ratingAvg: course.ratingAvg,
        ratingCount: course.ratingCount,
        durationSec: course.durationSec,
        lectureCount: course.lectureCount,
      },
    };
  });

  const purchasable = lines.filter((l) => !l.problem);
  return { lines, purchasable, totals: sumLines(purchasable) };
}
