import { Suspense } from "react";
import type { Metadata } from "next";
import { Star } from "lucide-react";
import { ReviewReplyForm } from "@/components/studio/panels";
import { Avatar, Card, EmptyState, PageHeader, Pagination, Skeleton, Stars } from "@/components/ui/misc";
import { requireInstructor } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { requestTime } from "@/lib/request";
import { pageParam } from "@/lib/utils";

export const metadata: Metadata = { title: "Reviews" };
const PAGE_SIZE = 15;

export default function ReviewsPage(props: PageProps<"/instructor/reviews">) {
  return (
    <>
      <PageHeader title="Reviews" description="What students say about your courses. Replies are public." />
      <Suspense fallback={<Skeleton className="mt-8 h-72 w-full" />}>
        <Reviews searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Reviews({ searchParams }: Pick<PageProps<"/instructor/reviews">, "searchParams">) {
  const page = pageParam((await searchParams).page);
  const user = await requireInstructor("/instructor/reviews");
  const where = { course: { instructorId: user.id } };
  const [total, reviews, now] = await Promise.all([
    db.review.count({ where }),
    db.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        rating: true,
        comment: true,
        reply: true,
        createdAt: true,
        user: { select: { name: true, avatarAssetId: true } },
        course: { select: { title: true } },
      },
    }),
    requestTime(),
  ]);

  if (total === 0) {
    return (
      <EmptyState className="mt-8" icon={<Star />} title="No reviews yet">
        Reviews appear here as soon as students rate your courses.
      </EmptyState>
    );
  }

  return (
    <>
      <ul className="mt-8 flex flex-col gap-4">
        {reviews.map((r) => (
          <li key={r.id}>
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <Avatar name={r.user.name} assetId={r.user.avatarAssetId} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{r.user.name}</p>
                  <p className="truncate text-xs text-subtle">
                    {r.course.title} · {timeAgo(r.createdAt, new Date(now))}
                  </p>
                </div>
                <Stars value={r.rating} />
              </div>
              {r.comment ? <p className="mt-3 leading-relaxed whitespace-pre-line">{r.comment}</p> : <p className="mt-3 text-sm text-subtle">No written comment.</p>}
              {r.reply ? (
                <p className="mt-3 rounded-xl border-l-2 border-brand bg-surface-2 px-4 py-3 text-sm whitespace-pre-line">
                  <span className="font-bold">Your reply: </span>
                  {r.reply}
                </p>
              ) : null}
              <div className="mt-3">
                <ReviewReplyForm reviewId={r.id} reply={r.reply} />
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <Pagination page={page} pageCount={Math.ceil(total / PAGE_SIZE)} basePath="/instructor/reviews" />
      </div>
    </>
  );
}
