"use client";

import { useState } from "react";
import { CircleCheck, Circle, LoaderCircle, Star, Trash2 } from "lucide-react";
import { ActionForm, FieldError, SubmitButton, useServerAction } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/form";
import { formatTimecode } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  deleteNoteAction,
  deleteReviewAction,
  saveNoteAction,
  saveReviewAction,
  setLectureCompleteAction,
} from "@/server/actions/learning";
import { playback } from "./playback-store";

export function CompleteButton({ lectureId, completed }: { lectureId: string; completed: boolean }) {
  const { run, pending } = useServerAction(setLectureCompleteAction, { quiet: true });
  return (
    <Button
      variant={completed ? "outline" : "primary"}
      disabled={pending}
      aria-pressed={completed}
      onClick={() => run(lectureId, !completed)}
    >
      {pending ? (
        <LoaderCircle className="animate-spin" aria-hidden />
      ) : completed ? (
        <CircleCheck className="text-success" aria-hidden />
      ) : (
        <Circle aria-hidden />
      )}
      {completed ? "Completed" : "Mark as complete"}
    </Button>
  );
}

/** Add a note to the current lecture, stamped with the video position when there is one. */
export function NoteForm({ lectureId, isVideo }: { lectureId: string; isVideo: boolean }) {
  const [position, setPosition] = useState(0);
  return (
    <ActionForm action={saveNoteAction} resetOnSuccess className="flex flex-col gap-3">
      <input type="hidden" name="lectureId" value={lectureId} />
      <input type="hidden" name="positionSec" value={position} />
      <Field label="New note" hint={isVideo ? "Saved with the current video time so you can jump back to it." : undefined}>
        <Textarea
          name="body"
          rows={3}
          required
          maxLength={4000}
          placeholder="Write something you want to remember…"
          // Capture the playback time when the learner starts typing.
          onFocus={() => setPosition(isVideo ? playback.position(lectureId) : 0)}
        />
        <FieldError name="body" />
      </Field>
      <SubmitButton className="self-start">Save note</SubmitButton>
    </ActionForm>
  );
}

export function NoteTimestamp({ positionSec, isCurrentLecture }: { positionSec: number; isCurrentLecture: boolean }) {
  const label = formatTimecode(positionSec);
  if (!isCurrentLecture) return <span className="rounded bg-surface-3 px-1.5 py-0.5 text-xs font-bold tabular-nums">{label}</span>;
  return (
    <button
      type="button"
      onClick={() => playback.seek(positionSec)}
      aria-label={`Jump to ${label}`}
      className="rounded bg-brand px-1.5 py-0.5 text-xs font-bold text-brand-ink tabular-nums hover:bg-brand-hover"
    >
      {label}
    </button>
  );
}

export function DeleteNoteButton({ noteId }: { noteId: string }) {
  const { run, pending } = useServerAction(deleteNoteAction, { quiet: true });
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => run(noteId)}
      aria-label="Delete note"
      className="rounded p-1 text-subtle hover:bg-surface-3 hover:text-danger disabled:opacity-50"
    >
      <Trash2 className="size-4" />
    </button>
  );
}

const RATING_LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

/** Leave or edit your own review of a course. */
export function ReviewForm({
  courseId,
  existing,
}: {
  courseId: string;
  existing: { rating: number; comment: string } | null;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const shown = hover || rating;

  return (
    <>
      <ActionForm action={saveReviewAction} className="flex flex-col gap-4">
        <input type="hidden" name="courseId" value={courseId} />
        <input type="hidden" name="rating" value={rating} />
        <fieldset>
          <legend className="text-sm font-semibold">Your rating</legend>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={rating === value}
                  aria-label={`${value} star${value === 1 ? "" : "s"}: ${RATING_LABELS[value]}`}
                  onMouseEnter={() => setHover(value)}
                  onFocus={() => setHover(value)}
                  onBlur={() => setHover(0)}
                  onClick={() => setRating(value)}
                  className="rounded p-0.5"
                >
                  <Star
                    className={cn("size-8 transition-colors", value <= shown ? "fill-brand text-brand" : "fill-surface-3 text-surface-3")}
                    strokeWidth={0}
                  />
                </button>
              ))}
            </div>
            <span className="text-sm text-muted" aria-hidden>
              {RATING_LABELS[shown]}
            </span>
          </div>
          <FieldError name="rating" className="mt-1.5" />
        </fieldset>
        <Field label="Your review" optional>
          <Textarea
            name="comment"
            rows={4}
            maxLength={2000}
            defaultValue={existing?.comment}
            placeholder="What did you like? What could be better?"
          />
          <FieldError name="comment" />
        </Field>
        <div className="flex flex-wrap gap-2">
          <SubmitButton disabled={rating === 0}>{existing ? "Update review" : "Post review"}</SubmitButton>
          {existing ? (
            <Button variant="danger-outline" onClick={() => setConfirming(true)}>
              Delete review
            </Button>
          ) : null}
        </div>
      </ActionForm>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Delete your review?"
        confirmLabel="Delete review"
        action={() => deleteReviewAction(courseId)}
        onSuccess={() => setRating(0)}
      >
        Your rating and comment will be removed from the course.
      </ConfirmDialog>
    </>
  );
}
