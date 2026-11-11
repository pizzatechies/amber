import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { getQuestions, QuestionList } from "@/components/course/qa";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { requireInstructor } from "@/lib/auth/session";
import { requestTime } from "@/lib/request";
import { cn, firstParam } from "@/lib/utils";

export const metadata: Metadata = { title: "Questions and answers" };

export default function QuestionsPage(props: PageProps<"/instructor/questions">) {
  return (
    <>
      <PageHeader title="Q&A" description="Questions students have asked across your courses." />
      <Suspense fallback={<Skeleton className="mt-8 h-72 w-full" />}>
        <Questions searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Questions({ searchParams }: Pick<PageProps<"/instructor/questions">, "searchParams">) {
  const filter = firstParam((await searchParams).show) === "all" ? "all" : "open";
  const user = await requireInstructor("/instructor/questions");
  const [questions, now] = await Promise.all([
    getQuestions({ course: { instructorId: user.id }, ...(filter === "open" ? { isResolved: false } : {}) }, 60),
    requestTime(),
  ]);
  const chip = (active: boolean) =>
    cn("rounded-full border px-4 py-1.5 text-sm font-semibold", active ? "border-fg bg-fg text-bg" : "border-line-strong hover:bg-surface-2");

  return (
    <>
      <nav aria-label="Filter questions" className="mt-6 flex gap-2">
        <Link href="/instructor/questions" className={chip(filter === "open")} aria-current={filter === "open" ? "true" : undefined}>
          Unresolved
        </Link>
        <Link href="/instructor/questions?show=all" className={chip(filter === "all")} aria-current={filter === "all" ? "true" : undefined}>
          All
        </Link>
      </nav>
      <div className="mt-6">
        {questions.length === 0 ? (
          <EmptyState icon={<MessagesSquare />} title={filter === "open" ? "No unresolved questions" : "No questions yet"}>
            Questions from your students appear here so you can answer them in one place.
          </EmptyState>
        ) : (
          <QuestionList questions={questions} viewer={{ id: user.id, isAdmin: user.role === "ADMIN" }} now={now} showCourse />
        )}
      </div>
    </>
  );
}
