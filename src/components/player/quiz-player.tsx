"use client";

import { useState } from "react";
import { Check, LoaderCircle, RotateCcw, X } from "lucide-react";
import { useServerAction } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import type { PublicQuiz, QuizResult } from "@/lib/courses/quiz";
import { cn } from "@/lib/utils";
import { submitQuizAction } from "@/server/actions/learning";

export function QuizPlayer({
  lectureId,
  quiz,
  canSubmit,
  best,
}: {
  lectureId: string;
  quiz: PublicQuiz;
  /** False for free previews: visitors can read the questions but not submit. */
  canSubmit: boolean;
  best: { correct: number; total: number } | null;
}) {
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const { run, pending } = useServerAction(submitQuizAction, {
    onSuccess: (data) => {
      if (data) setResult(data.result);
    },
  });

  const allAnswered = quiz.questions.every((q) => (answers[q.id]?.length ?? 0) > 0);

  function choose(questionId: string, optionId: string, multiple: boolean) {
    if (result) return;
    setAnswers((prev) => {
      const current = prev[questionId] ?? [];
      const next = multiple
        ? current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId]
        : [optionId];
      return { ...prev, [questionId]: next };
    });
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      {result ? (
        <Alert
          tone={result.correct === result.total ? "success" : "info"}
          title={`You scored ${result.correct} out of ${result.total}`}
        >
          {result.correct === result.total
            ? "Every answer was right. Nicely done."
            : "Review the explanations below, then try again whenever you like."}
        </Alert>
      ) : best ? (
        <p className="text-sm text-muted">
          Your best score so far: <strong className="text-fg">{best.correct}</strong> out of {best.total}.
        </p>
      ) : null}

      <ol className="flex flex-col gap-6">
        {quiz.questions.map((q, index) => {
          const graded = result?.questions[q.id];
          const chosen = answers[q.id] ?? [];
          return (
            <li key={q.id}>
              <fieldset className="rounded-2xl border border-line bg-surface p-5">
                <legend className="float-left mb-3 w-full leading-relaxed font-bold">
                  <span className="mr-2 text-subtle">{index + 1}.</span>
                  {q.prompt}
                  {q.multiple ? <span className="ml-2 text-xs font-normal text-subtle">Select all that apply</span> : null}
                </legend>
                <div className="clear-both flex flex-col gap-2">
                  {q.options.map((option) => {
                    const isChosen = chosen.includes(option.id);
                    const isCorrect = graded?.correct.includes(option.id);
                    return (
                      <label
                        key={option.id}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed transition-colors",
                          !graded && "cursor-pointer hover:border-fg/40",
                          !graded && (isChosen ? "border-focus bg-brand-soft" : "border-line-strong"),
                          graded && isCorrect && "border-success/50 bg-success-soft",
                          graded && !isCorrect && isChosen && "border-danger/50 bg-danger-soft",
                          graded && !isCorrect && !isChosen && "border-line opacity-70",
                        )}
                      >
                        <input
                          type={q.multiple ? "checkbox" : "radio"}
                          name={`question-${q.id}`}
                          checked={isChosen}
                          disabled={!!graded}
                          onChange={() => choose(q.id, option.id, q.multiple)}
                          className="mt-1 size-4 shrink-0 accent-[var(--brand)]"
                        />
                        <span className="min-w-0 flex-1">{option.text}</span>
                        {graded && isCorrect ? <Check className="mt-0.5 size-4 shrink-0 text-success" aria-label="Correct answer" /> : null}
                        {graded && !isCorrect && isChosen ? (
                          <X className="mt-0.5 size-4 shrink-0 text-danger" aria-label="Your answer, incorrect" />
                        ) : null}
                      </label>
                    );
                  })}
                </div>
                {graded ? (
                  <p className={cn("mt-3 text-sm font-bold", graded.isCorrect ? "text-success" : "text-danger")}>
                    {graded.isCorrect ? "Correct" : "Not quite"}
                    {graded.explanation ? <span className="font-normal text-fg"> — {graded.explanation}</span> : null}
                  </p>
                ) : null}
              </fieldset>
            </li>
          );
        })}
      </ol>

      {!canSubmit ? (
        <Alert tone="info">Enroll in the course to submit this quiz and see the answers.</Alert>
      ) : result ? (
        <Button
          variant="outline"
          className="self-start"
          onClick={() => {
            setResult(null);
            setAnswers({});
          }}
        >
          <RotateCcw aria-hidden /> Try again
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" disabled={!allAnswered || pending} aria-busy={pending} onClick={() => run(lectureId, answers)}>
            {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
            Submit answers
          </Button>
          {!allAnswered ? <p className="text-sm text-muted">Answer every question to submit.</p> : null}
        </div>
      )}
    </div>
  );
}
