"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/form";
import type { Quiz, QuizQuestion } from "@/lib/courses/quiz";

const newId = () => Math.random().toString(36).slice(2, 10);

export function emptyQuestion(): QuizQuestion {
  const a = newId();
  return { id: newId(), prompt: "", options: [{ id: a, text: "" }, { id: newId(), text: "" }], correct: [a], explanation: "" };
}

/** Edits a quiz in memory; the parent saves it with the lecture. */
export function QuizEditor({ quiz, onChange }: { quiz: Quiz; onChange: (quiz: Quiz) => void }) {
  const update = (id: string, patch: Partial<QuizQuestion>) =>
    onChange({ questions: quiz.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) });

  return (
    <div className="flex flex-col gap-4">
      {quiz.questions.length === 0 ? <p className="text-sm text-muted">This quiz has no questions yet.</p> : null}
      {quiz.questions.map((q, index) => (
        <fieldset key={q.id} className="rounded-xl border border-line bg-surface-2 p-4">
          <legend className="float-left mb-3 flex w-full items-center justify-between">
            <span className="text-sm font-bold">Question {index + 1}</span>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted"
              onClick={() => onChange({ questions: quiz.questions.filter((x) => x.id !== q.id) })}
            >
              <Trash2 aria-hidden /> Remove
            </Button>
          </legend>
          <div className="clear-both flex flex-col gap-3">
            <Textarea
              rows={2}
              value={q.prompt}
              maxLength={1000}
              aria-label={`Question ${index + 1} text`}
              placeholder="Ask the question"
              onChange={(e) => update(q.id, { prompt: e.target.value })}
            />
            <div>
              <p className="mb-2 text-xs text-muted">Answer options. Tick every correct answer.</p>
              <ul className="flex flex-col gap-2">
                {q.options.map((option, oi) => (
                  <li key={option.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={q.correct.includes(option.id)}
                      aria-label={`Option ${oi + 1} is correct`}
                      onChange={(e) =>
                        update(q.id, {
                          correct: e.target.checked ? [...q.correct, option.id] : q.correct.filter((id) => id !== option.id),
                        })
                      }
                      className="size-4 shrink-0 accent-[var(--success)]"
                    />
                    <Input
                      value={option.text}
                      maxLength={500}
                      aria-label={`Question ${index + 1} option ${oi + 1}`}
                      placeholder={`Option ${oi + 1}`}
                      onChange={(e) =>
                        update(q.id, { options: q.options.map((o) => (o.id === option.id ? { ...o, text: e.target.value } : o)) })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove option ${oi + 1}`}
                      disabled={q.options.length <= 2}
                      onClick={() =>
                        update(q.id, {
                          options: q.options.filter((o) => o.id !== option.id),
                          correct: q.correct.filter((id) => id !== option.id),
                        })
                      }
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
              {q.options.length < 8 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => update(q.id, { options: [...q.options, { id: newId(), text: "" }] })}
                >
                  <Plus aria-hidden /> Add option
                </Button>
              ) : null}
            </div>
            <Input
              value={q.explanation}
              maxLength={2000}
              aria-label={`Question ${index + 1} explanation`}
              placeholder="Explanation shown after answering (optional)"
              onChange={(e) => update(q.id, { explanation: e.target.value })}
            />
          </div>
        </fieldset>
      ))}
      {quiz.questions.length < 50 ? (
        <Button variant="outline" className="self-start" onClick={() => onChange({ questions: [...quiz.questions, emptyQuestion()] })}>
          <Plus aria-hidden /> Add question
        </Button>
      ) : null}
    </div>
  );
}
