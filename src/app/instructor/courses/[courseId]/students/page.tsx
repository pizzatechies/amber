import { Suspense } from "react";
import type { Metadata } from "next";
import { Users } from "lucide-react";
import { Table } from "@/components/studio/stat";
import { Avatar, Badge, EmptyState, Pagination, ProgressBar, Skeleton } from "@/components/ui/misc";
import { percentOf } from "@/lib/courses/progress";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getStudioCourse } from "@/lib/studio-course";
import { studioUrl } from "@/lib/urls";
import { pageParam } from "@/lib/utils";

export const metadata: Metadata = { title: "Students" };
type Props = PageProps<"/instructor/courses/[courseId]/students">;
const PAGE_SIZE = 25;

export default function StudentsPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-80 w-full" />}>
      <Students params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Students({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const { course } = await getStudioCourse((await params).courseId);
  const page = pageParam((await searchParams).page);
  const where = { courseId: course.id, revokedAt: null };
  const [total, enrollments] = await Promise.all([
    db.enrollment.count({ where }),
    db.enrollment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, userId: true, createdAt: true, completedAt: true, source: true, user: { select: { name: true, avatarAssetId: true } } },
    }),
  ]);

  if (total === 0) {
    return (
      <EmptyState icon={<Users />} title="No students yet">
        Once the course is published, everyone who enrolls is listed here with their progress.
      </EmptyState>
    );
  }

  const done = await db.lectureProgress.groupBy({
    by: ["userId"],
    where: { courseId: course.id, userId: { in: enrollments.map((e) => e.userId) }, completedAt: { not: null }, lecture: { isReady: true } },
    _count: { _all: true },
  });
  const doneBy = new Map(done.map((d) => [d.userId, d._count._all]));

  return (
    <>
      <Table head={["Student", "Enrolled", "Access", "Progress"]}>
        {enrollments.map((e) => {
          const percent = percentOf(doneBy.get(e.userId) ?? 0, course.lectureCount);
          return (
            <tr key={e.id}>
              <td>
                <span className="flex items-center gap-3">
                  <Avatar name={e.user.name} assetId={e.user.avatarAssetId} size={32} />
                  <span className="font-semibold">{e.user.name}</span>
                </span>
              </td>
              <td className="whitespace-nowrap text-muted">{formatDate(e.createdAt)}</td>
              <td>
                <Badge>{e.source === "PURCHASE" ? "Purchased" : e.source === "FREE" ? "Free" : "Granted"}</Badge>
              </td>
              <td className="min-w-40">
                <span className="flex items-center gap-3">
                  <ProgressBar value={percent} label={`${e.user.name}'s progress`} />
                  <span className="w-10 shrink-0 text-right text-xs tabular-nums">{percent}%</span>
                </span>
              </td>
            </tr>
          );
        })}
      </Table>
      <div className="mt-6">
        <Pagination page={page} pageCount={Math.ceil(total / PAGE_SIZE)} basePath={studioUrl(course.id, "students")} />
      </div>
    </>
  );
}
