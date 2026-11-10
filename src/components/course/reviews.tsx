import { Avatar, Stars } from "@/components/ui/misc";
import { db } from "@/lib/db";
import { formatRating, timeAgo } from "@/lib/format";
import { pluralize } from "@/lib/utils";

export const REVIEWS_PAGE_SIZE = 8;

export async function getReviews(courseId: string, page: number) {
  const [reviews, distribution] = await Promise.all([
    db.review.findMany({
      where: { courseId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * REVIEWS_PAGE_SIZE,
      take: REVIEWS_PAGE_SIZE,
      select: {
        id: true,
        rating: true,
        comment: true,
        reply: true,
        repliedAt: true,
        createdAt: true,
        user: { select: { name: true, avatarAssetId: true } },
      },
    }),
    db.review.groupBy({ by: ["rating"], where: { courseId }, _count: { _all: true } }),
  ]);
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of distribution) counts[row.rating] = row._count._all;
  return { reviews, counts };
}

export type ReviewData = Awaited<ReturnType<typeof getReviews>>;

export function RatingSummary({ avg, count, counts }: { avg: number; count: number; counts: Record<number, number> }) {
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
      <div className="shrink-0 text-center sm:w-36">
        <p className="font-display text-6xl leading-none font-semibold text-brand-text">{formatRating(avg)}</p>
        <Stars value={avg} size={18} className="mt-2" />
        <p className="mt-1 text-sm text-muted">{pluralize(count, "rating")}</p>
      </div>
      <ul className="flex flex-1 flex-col gap-1.5" aria-label="Rating breakdown">
        {[5, 4, 3, 2, 1].map((stars) => {
          const share = count > 0 ? Math.round(((counts[stars] ?? 0) / count) * 100) : 0;
          return (
            <li key={stars} className="flex items-center gap-3 text-sm">
              <span className="w-12 shrink-0 text-muted">{stars} star</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                <span className="block h-full rounded-full bg-brand" style={{ width: `${share}%` }} />
              </span>
              <span className="w-10 shrink-0 text-right text-muted tabular-nums">{share}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ReviewList({
  reviews,
  instructorName,
  now,
}: {
  reviews: ReviewData["reviews"];
  instructorName: string;
  now: number;
}) {
  const at = new Date(now);
  return (
    <ul className="flex flex-col divide-y divide-line">
      {reviews.map((r) => (
        <li key={r.id} className="py-5 first:pt-0 last:pb-0">
          <div className="flex items-center gap-3">
            <Avatar name={r.user.name} assetId={r.user.avatarAssetId} size={40} />
            <div className="min-w-0">
              <p className="truncate font-bold">{r.user.name}</p>
              <p className="flex items-center gap-2 text-xs text-subtle">
                <Stars value={r.rating} size={13} />
                {timeAgo(r.createdAt, at)}
              </p>
            </div>
          </div>
          {r.comment ? <p className="mt-3 leading-relaxed whitespace-pre-line">{r.comment}</p> : null}
          {r.reply ? (
            <div className="mt-3 ml-4 rounded-xl border-l-2 border-brand bg-surface-2 px-4 py-3 text-sm">
              <p className="font-bold">
                {instructorName} <span className="font-normal text-subtle">· Instructor</span>
              </p>
              <p className="mt-1 leading-relaxed whitespace-pre-line">{r.reply}</p>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
