import { Suspense } from "react";
import type { Metadata } from "next";
import { FormSkeleton } from "@/components/site/auth-card";
import { DetailsForm } from "@/components/studio/course-forms";
import { db } from "@/lib/db";
import { getStudioCourse } from "@/lib/studio-course";

export const metadata: Metadata = { title: "Course details" };
type Props = PageProps<"/instructor/courses/[courseId]/details">;

export default function DetailsPage(props: Props) {
  return (
    <Suspense fallback={<div className="max-w-3xl"><FormSkeleton fields={5} /></div>}>
      <Details params={props.params} />
    </Suspense>
  );
}

async function Details({ params }: Pick<Props, "params">) {
  const { course } = await getStudioCourse((await params).courseId);
  const categories = await db.category.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }], select: { id: true, name: true } });
  return <DetailsForm course={course} categories={categories} />;
}
