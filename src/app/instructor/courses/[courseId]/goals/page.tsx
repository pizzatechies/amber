import { Suspense } from "react";
import type { Metadata } from "next";
import { FormSkeleton } from "@/components/site/auth-card";
import { GoalsForm } from "@/components/studio/course-forms";
import { getStudioCourse } from "@/lib/studio-course";

export const metadata: Metadata = { title: "Course goals" };
type Props = PageProps<"/instructor/courses/[courseId]/goals">;

export default function GoalsPage(props: Props) {
  return (
    <Suspense fallback={<div className="max-w-3xl"><FormSkeleton fields={4} /></div>}>
      <Goals params={props.params} />
    </Suspense>
  );
}

async function Goals({ params }: Pick<Props, "params">) {
  const { course } = await getStudioCourse((await params).courseId);
  return <GoalsForm course={course} />;
}
