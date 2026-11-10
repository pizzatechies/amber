import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { getLearnContext, resumeLectureId } from "@/lib/courses/learn";
import { courseUrl, learnUrl, studioUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Course player", robots: { index: false } };

export default function LearnIndexPage(props: PageProps<"/learn/[slug]">) {
  return (
    <Suspense fallback={<Skeleton className="m-6 aspect-video" />}>
      <Resume params={props.params} />
    </Suspense>
  );
}

/** Send the learner to the lecture they should continue with. */
async function Resume({ params }: Pick<PageProps<"/learn/[slug]">, "params">) {
  const { slug } = await params;
  const ctx = await getLearnContext(slug);
  if (!ctx) notFound();
  if (!ctx.access.canLearn) {
    redirect(ctx.user ? courseUrl(slug) : `/login?next=${encodeURIComponent(learnUrl(slug))}`);
  }

  const lectureId = resumeLectureId(ctx);
  if (lectureId) redirect(learnUrl(slug, lectureId));

  return (
    <EmptyState
      className="m-6"
      icon={<BookOpen />}
      title="This course has no lectures yet"
      action={
        ctx.access.canManage ? (
          <LinkButton href={studioUrl(ctx.course.id, "curriculum")}>Add lectures</LinkButton>
        ) : (
          <LinkButton href="/my-learning" variant="outline">
            Back to my learning
          </LinkButton>
        )
      }
    >
      {ctx.access.canManage
        ? "Add a section and a lecture in the curriculum editor to see it here."
        : "The instructor is still preparing the content. Check back soon."}
    </EmptyState>
  );
}
