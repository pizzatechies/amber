import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { requestTime } from "@/lib/request";
import { cn } from "@/lib/utils";
import { MarkRead } from "./mark-read";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <div className="container-page max-w-3xl py-10">
      <h1 className="font-display text-3xl font-semibold sm:text-4xl">Notifications</h1>
      <Suspense fallback={<Skeleton className="mt-8 h-64 w-full" />}>
        <Notifications />
      </Suspense>
    </div>
  );
}

async function Notifications() {
  const user = await requireUser("/notifications");
  const items = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: { id: true, title: true, body: true, href: true, readAt: true, createdAt: true },
  });
  const now = new Date(await requestTime());

  if (items.length === 0) {
    return (
      <EmptyState className="mt-8" icon={<Bell />} title="Nothing here yet">
        You&apos;ll be notified about enrollments, answers to your questions and course reviews.
      </EmptyState>
    );
  }

  const hasUnread = items.some((n) => !n.readAt);
  return (
    <>
      {hasUnread ? <MarkRead /> : null}
      <ul className="mt-8 flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {items.map((n) => {
          const content = (
            <>
              <span
                aria-hidden
                className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-brand")}
              />
              <span className="min-w-0 flex-1">
                <span className={cn("block leading-snug", !n.readAt && "font-bold")}>
                  {n.title}
                  {!n.readAt ? <span className="sr-only"> (unread)</span> : null}
                </span>
                {n.body ? <span className="mt-0.5 block text-sm text-muted">{n.body}</span> : null}
                <span className="mt-1 block text-xs text-subtle">{timeAgo(n.createdAt, now)}</span>
              </span>
            </>
          );
          return (
            <li key={n.id}>
              {n.href ? (
                <Link href={n.href} className="flex gap-3 px-5 py-4 hover:bg-surface-2">
                  {content}
                </Link>
              ) : (
                <div className="flex gap-3 px-5 py-4">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
