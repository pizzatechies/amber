"use client";

import { useState } from "react";
import { CircleCheck, Trash2 } from "lucide-react";
import { ActionForm, FieldError, SubmitButton, useServerAction } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import {
  answerQuestionAction,
  askQuestionAction,
  deleteAnswerAction,
  deleteQuestionAction,
  setQuestionResolvedAction,
} from "@/server/actions/learning";

export function AskQuestionForm({ courseId, lectureId }: { courseId: string; lectureId?: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        Ask a question
      </Button>
    );
  }
  return (
    <ActionForm
      action={askQuestionAction}
      onSuccess={() => setOpen(false)}
      className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5"
    >
      <input type="hidden" name="courseId" value={courseId} />
      {lectureId ? <input type="hidden" name="lectureId" value={lectureId} /> : null}
      <Field label="Your question">
        <Input name="title" required minLength={5} maxLength={160} placeholder="Summarise it in one sentence" autoFocus />
        <FieldError name="title" />
      </Field>
      <Field label="Details" optional hint="Markdown is supported.">
        <Textarea name="body" rows={4} maxLength={4000} placeholder="What have you tried? Where are you stuck?" />
        <FieldError name="body" />
      </Field>
      <div className="flex gap-2">
        <SubmitButton>Post question</SubmitButton>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </ActionForm>
  );
}

export function AnswerForm({ questionId }: { questionId: string }) {
  return (
    <ActionForm action={answerQuestionAction} resetOnSuccess className="flex flex-col gap-2">
      <input type="hidden" name="questionId" value={questionId} />
      <Textarea name="body" rows={3} required maxLength={4000} aria-label="Your answer" placeholder="Write an answer…" />
      <FieldError name="body" />
      <SubmitButton size="sm" className="self-start">
        Post answer
      </SubmitButton>
    </ActionForm>
  );
}

export function QuestionActions({
  questionId,
  isResolved,
  canModerate,
}: {
  questionId: string;
  isResolved: boolean;
  /** The asker, the course instructor or an admin. */
  canModerate: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const resolve = useServerAction(setQuestionResolvedAction, { quiet: true });
  if (!canModerate) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={resolve.pending} onClick={() => resolve.run(questionId, !isResolved)}>
        <CircleCheck aria-hidden /> {isResolved ? "Reopen" : "Mark as resolved"}
      </Button>
      <Button size="sm" variant="ghost" className="text-muted" onClick={() => setConfirming(true)}>
        <Trash2 aria-hidden /> Delete
      </Button>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Delete this question?"
        confirmLabel="Delete question"
        action={() => deleteQuestionAction(questionId)}
      >
        The question and all of its answers will be removed.
      </ConfirmDialog>
    </div>
  );
}

export function DeleteAnswerButton({ answerId }: { answerId: string }) {
  const { run, pending } = useServerAction(deleteAnswerAction);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => run(answerId)}
      aria-label="Delete answer"
      className="rounded p-1 text-subtle hover:bg-surface-3 hover:text-danger disabled:opacity-50"
    >
      <Trash2 className="size-4" />
    </button>
  );
}
