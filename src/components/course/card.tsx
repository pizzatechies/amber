import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, Skeleton, Stars } from "@/components/ui/misc";
import type { CourseCardData } from "@/lib/courses/queries";
import { formatCount, formatDuration, formatRating } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import { LEVELS } from "@/lib/site";
import { courseUrl } from "@/lib/urls";
import { cn, pluralize } from "@/lib/utils";
import { CourseCover } from "./cover";

export function RatingLine({
  avg,
  count,
  size = 14,
  className,
}: {
  avg: number;
  count: number;
  size?: number;
  className?: string;
}) {
  if (count === 0) return <p className={cn("text-sm text-subtle", className)}>No ratings yet</p>;
  return (
    <p className={cn("flex items-center gap-1.5 text-sm", className)}>
      <span className="font-bold text-brand-text">{formatRating(avg)}</span>
      <Stars value={avg} size={size} />
      <span className="text-subtle">({formatCount(count)})</span>
    </p>
  );
}

const NEW_WINDOW_MS = 21 * 24 * 60 * 60 * 1000;

/** Catalogue card. `now` (request time) is used to flag recently published courses. */
export function CourseCard({ course, now, footer }: { course: CourseCardData; now?: number; footer?: ReactNode }) {
  const isNew = !!now && !!course.publishedAt && now - course.publishedAt.getTime() < NEW_WINDOW_MS;
  return (
    <article className="group relative flex flex-col">
      <div className="relative overflow-hidden rounded-xl border border-line transition-shadow group-hover:shadow-card">
        <CourseCover title={course.title} seed={course.id} assetId={course.thumbnailAssetId} />
        {isNew ? (
          <Badge tone="brand" className="absolute top-2.5 left-2.5 shadow-sm">
            New
          </Badge>
        ) : null}
      </div>
      <h3 className="mt-3 line-clamp-2 leading-snug font-bold">
        <Link href={courseUrl(course.slug)} className="after:absolute after:inset-0 group-hover:text-brand-text">
          {course.title}
        </Link>
      </h3>
      <p className="mt-1 truncate text-sm text-muted">{course.instructor.name}</p>
      <RatingLine avg={course.ratingAvg} count={course.ratingCount} className="mt-1" />
      <p className="mt-1 text-xs text-subtle">
        {course.durationSec > 0 ? `${formatDuration(course.durationSec)} · ` : ""}
        {pluralize(course.lectureCount, "lecture")} · {LEVELS[course.level]}
      </p>
      <p className="mt-2 font-bold">{formatPrice(course.priceCents)}</p>
      {footer ? <div className="relative z-10 mt-3">{footer}</div> : null}
    </article>
  );
}

export function CourseGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", className)}>
      {children}
    </div>
  );
}

export function CourseCardSkeleton() {
  return (
    <div aria-hidden>
      <Skeleton className="aspect-video w-full rounded-xl" />
      <Skeleton className="mt-3 h-5 w-11/12" />
      <Skeleton className="mt-2 h-4 w-1/2" />
      <Skeleton className="mt-2 h-4 w-2/5" />
      <Skeleton className="mt-3 h-5 w-16" />
    </div>
  );
}

export function CourseGridSkeleton({ count = 8, className }: { count?: number; className?: string }) {
  return (
    <CourseGrid className={className}>
      {Array.from({ length: count }, (_, i) => (
        <CourseCardSkeleton key={i} />
      ))}
    </CourseGrid>
  );
}
