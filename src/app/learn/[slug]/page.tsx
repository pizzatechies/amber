import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { getLearnContext, resumeLectureId } from "@/lib/courses/learn";
import { courseUrl, learnUrl, studioUrl } from "@/lib/urls";
import { firstParam } from "@/lib/utils";

export const metadata: Metadata = { title: "Course player", robots: { index: false } };

export default function LearnIndexPage(props: PageProps<"/learn/[slug]">) {
  return (
    <Suspense fallback={<Skeleton className="m-6 aspect-video" />}>
      <Resume params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

/** Send the learner to the lecture they should continue with. */
async function Resume({ params, searchParams }: Pick<PageProps<"/learn/[slug]">, "params" | "searchParams">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const ctx = await getLearnContext(slug);
  if (!ctx) notFound();
  if (!ctx.access.canLearn) {
    redirect(ctx.user ? courseUrl(slug) : `/login?next=${encodeURIComponent(learnUrl(slug))}`);
  }

  const lectureId = resumeLectureId(ctx);
  // Keep ?tab=... so links from notifications open the right tab.
  const tab = firstParam(sp.tab);
  if (lectureId) redirect(learnUrl(slug, lectureId) + (tab ? `?tab=${encodeURIComponent(tab)}` : ""));

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
