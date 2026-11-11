import { Suspense } from "react";
import type { Metadata } from "next";
import { Markdown } from "@/components/markdown";
import { AnnouncementForm, DeleteAnnouncementButton } from "@/components/studio/panels";
import { Card, Skeleton } from "@/components/ui/misc";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getStudioCourse } from "@/lib/studio-course";

export const metadata: Metadata = { title: "Announcements" };
type Props = PageProps<"/instructor/courses/[courseId]/announcements">;

export default function AnnouncementsPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-80 w-full max-w-3xl" />}>
      <Announcements params={props.params} />
    </Suspense>
  );
}

async function Announcements({ params }: Pick<Props, "params">) {
  const { course } = await getStudioCourse((await params).courseId);
  const announcements = await db.announcement.findMany({
    where: { courseId: course.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, title: true, body: true, createdAt: true },
  });
  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <section>
        <h2 className="font-display text-xl font-semibold">New announcement</h2>
        <p className="mt-1 mb-5 text-sm text-muted">Everyone enrolled gets a notification and sees it in the course player.</p>
        <AnnouncementForm courseId={course.id} />
      </section>
      {announcements.length > 0 ? (
        <section>
          <h2 className="mb-4 font-display text-xl font-semibold">Posted</h2>
          <ul className="flex flex-col gap-4">
            {announcements.map((a) => (
              <li key={a.id}>
                <Card className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold">{a.title}</h3>
                      <p className="text-xs text-subtle">{formatDate(a.createdAt)}</p>
                    </div>
                    <DeleteAnnouncementButton id={a.id} />
                  </div>
                  <Markdown className="mt-3 text-sm">{a.body}</Markdown>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
