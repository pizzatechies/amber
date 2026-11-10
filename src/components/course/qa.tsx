import { CircleCheck, MessageSquare } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { Avatar, Badge } from "@/components/ui/misc";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import type { Prisma } from "@/generated/prisma/client";
import { pluralize } from "@/lib/utils";
import { AnswerForm, DeleteAnswerButton, QuestionActions } from "./qa-controls";

const questionSelect = {
  id: true,
  title: true,
  body: true,
  isResolved: true,
  createdAt: true,
  userId: true,
  user: { select: { name: true, avatarAssetId: true } },
  lecture: { select: { title: true } },
  course: { select: { id: true, title: true, slug: true, instructorId: true } },
  answers: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      body: true,
      createdAt: true,
      userId: true,
      user: { select: { name: true, avatarAssetId: true } },
    },
  },
} satisfies Prisma.QuestionSelect;

export type QuestionData = Prisma.QuestionGetPayload<{ select: typeof questionSelect }>;

export async function getQuestions(where: Prisma.QuestionWhereInput, take = 30): Promise<QuestionData[]> {
  return db.question.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take,
    select: questionSelect,
  });
}

/** A list of course questions with their answers and an answer box. */
export function QuestionList({
  questions,
  viewer,
  now,
  showCourse,
}: {
  questions: QuestionData[];
  viewer: { id: string; isAdmin: boolean };
  now: number;
  /** Show which course each question belongs to (instructor inbox). */
  showCourse?: boolean;
}) {
  const at = new Date(now);
  return (
    <ul className="flex flex-col gap-3">
      {questions.map((q) => {
        const isInstructor = viewer.id === q.course.instructorId;
        const canModerate = viewer.isAdmin || isInstructor || viewer.id === q.userId;
        return (
          <li key={q.id}>
            <details className="group rounded-2xl border border-line bg-surface">
              <summary className="flex list-none gap-3 p-4 hover:bg-surface-2 group-open:rounded-t-2xl [&::-webkit-details-marker]:hidden">
                <Avatar name={q.user.name} assetId={q.user.avatarAssetId} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="leading-snug font-bold">{q.title}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-subtle">
                    <span>{q.user.name}</span>
                    <span>· {timeAgo(q.createdAt, at)}</span>
                    {showCourse ? <span>· {q.course.title}</span> : null}
                    {q.lecture ? <span>· {q.lecture.title}</span> : null}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {q.isResolved ? (
                    <Badge tone="success">
                      <CircleCheck aria-hidden /> Resolved
                    </Badge>
                  ) : null}
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <MessageSquare className="size-3.5" aria-hidden />
                    {pluralize(q.answers.length, "answer")}
                  </span>
                </div>
              </summary>

              <div className="flex flex-col gap-4 border-t border-line p-4">
                {q.body ? <Markdown className="text-sm">{q.body}</Markdown> : null}
                <QuestionActions questionId={q.id} isResolved={q.isResolved} canModerate={canModerate} />

                {q.answers.length > 0 ? (
                  <ul className="flex flex-col gap-3">
                    {q.answers.map((a) => {
                      const byInstructor = a.userId === q.course.instructorId;
                      return (
                        <li
                          key={a.id}
                          className={`flex gap-3 rounded-xl p-3 ${byInstructor ? "bg-brand-soft" : "bg-surface-2"}`}
                        >
                          <Avatar name={a.user.name} assetId={a.user.avatarAssetId} size={32} />
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-2 text-sm">
                              <span className="font-bold">{a.user.name}</span>
                              {byInstructor ? <Badge tone="brand">Instructor</Badge> : null}
                              <span className="text-xs text-subtle">{timeAgo(a.createdAt, at)}</span>
                            </p>
                            <Markdown className="mt-1 text-sm">{a.body}</Markdown>
                          </div>
                          {viewer.isAdmin || isInstructor || viewer.id === a.userId ? (
                            <DeleteAnswerButton answerId={a.id} />
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}

                <AnswerForm questionId={q.id} />
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
