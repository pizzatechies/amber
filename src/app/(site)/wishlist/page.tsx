import { Suspense } from "react";
import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { CourseCard, CourseGrid, CourseGridSkeleton } from "@/components/course/card";
import { ActionButton } from "@/components/ui/action-form";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { courseCardSelect } from "@/lib/courses/queries";
import { db } from "@/lib/db";
import { requestTime } from "@/lib/request";
import { addToCartAction, toggleWishlistAction } from "@/server/actions/commerce";

export const metadata: Metadata = { title: "Wishlist" };

export default function WishlistPage() {
  return (
    <div className="container-page py-10">
      <h1 className="font-display text-3xl font-semibold sm:text-4xl">Wishlist</h1>
      <div className="mt-8">
        <Suspense fallback={<CourseGridSkeleton count={4} />}>
          <Wishlist />
        </Suspense>
      </div>
    </div>
  );
}

async function Wishlist() {
  const user = await requireUser("/wishlist");
  const items = await db.wishlistItem.findMany({
    where: { userId: user.id, course: { status: "PUBLISHED" } },
    orderBy: { createdAt: "desc" },
    select: { course: { select: courseCardSelect } },
  });
  const now = await requestTime();

  if (items.length === 0) {
    return (
      <EmptyState icon={<Heart />} title="Your wishlist is empty" action={<LinkButton href="/courses">Browse courses</LinkButton>}>
        Tap the heart on any course to save it for later.
      </EmptyState>
    );
  }

  return (
    <CourseGrid>
      {items.map(({ course }) => (
        <CourseCard
          key={course.id}
          course={course}
          now={now}
          footer={
            <div className="flex gap-2">
              {course.priceCents > 0 ? (
                <ActionButton action={addToCartAction.bind(null, course.id, undefined)} size="sm" className="flex-1">
                  Add to cart
                </ActionButton>
              ) : (
                <LinkButton href={`/courses/${course.slug}`} size="sm" className="flex-1">
                  View course
                </LinkButton>
              )}
              <ActionButton action={toggleWishlistAction.bind(null, course.id)} size="sm" variant="outline">
                Remove
              </ActionButton>
            </div>
          }
        />
      ))}
    </CourseGrid>
  );
}
