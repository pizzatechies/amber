import { Suspense } from "react";
import type { Metadata } from "next";
import { CurriculumEditor, type EditorSection } from "@/components/studio/curriculum-editor";
import { Skeleton } from "@/components/ui/misc";
import { readQuiz } from "@/lib/courses/quiz";
import { db } from "@/lib/db";
import { getStudioCourse } from "@/lib/studio-course";

export const metadata: Metadata = { title: "Curriculum" };
type Props = PageProps<"/instructor/courses/[courseId]/curriculum">;

export default function CurriculumPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Curriculum params={props.params} />
    </Suspense>
  );
}

async function Curriculum({ params }: Pick<Props, "params">) {
  const { course } = await getStudioCourse((await params).courseId);
  const rows = await db.section.findMany({
    where: { courseId: course.id },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      lectures: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          type: true,
          isPreview: true,
          isReady: true,
          durationSec: true,
          content: true,
          videoUrl: true,
          quiz: true,
          media: { select: { id: true, filename: true, sizeBytes: true } },
          resources: { orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true, title: true, url: true, assetId: true } },
        },
      },
    },
  });
  // Convert to plain values the client editor can receive (no BigInt, parsed quiz).
  const sections: EditorSection[] = rows.map((s) => ({
    id: s.id,
    title: s.title,
    lectures: s.lectures.map((l) => ({
      ...l,
      quiz: readQuiz(l.quiz),
      media: l.media ? { ...l.media, sizeBytes: Number(l.media.sizeBytes) } : null,
    })),
  }));
  return <CurriculumEditor courseId={course.id} sections={sections} />;
}
