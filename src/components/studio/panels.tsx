"use client";

import { useState } from "react";
import { Check, Copy, Trash2 } from "lucide-react";
import { ActionForm, FieldError, SubmitButton, useServerAction } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import { replyToReviewAction } from "@/server/actions/learning";
import {
  createCouponAction,
  deleteAnnouncementAction,
  deleteCouponAction,
  deleteCourseAction,
  postAnnouncementAction,
  setCouponActiveAction,
  submitCourseAction,
  unpublishCourseAction,
  withdrawSubmissionAction,
} from "@/server/actions/studio";
import { MarkdownEditor } from "./markdown-editor";

export function PublishActions({
  courseId,
  status,
  ready,
  needsReview,
  canDelete,
}: {
  courseId: string;
  status: string;
  ready: boolean;
  needsReview: boolean;
  canDelete: boolean;
}) {
  const [confirm, setConfirm] = useState<"unpublish" | "delete" | null>(null);
  const submit = useServerAction(submitCourseAction);
  const withdraw = useServerAction(withdrawSubmissionAction);

  return (
    <div className="flex flex-wrap gap-2">
      {status === "IN_REVIEW" ? (
        <Button variant="outline" disabled={withdraw.pending} onClick={() => withdraw.run(courseId)}>
          Withdraw submission
        </Button>
      ) : status === "PUBLISHED" ? (
        <Button variant="outline" onClick={() => setConfirm("unpublish")}>
          Unpublish
        </Button>
      ) : (
        <Button size="lg" disabled={!ready || submit.pending} aria-busy={submit.pending} onClick={() => submit.run(courseId)}>
          {needsReview ? "Submit for review" : status === "UNPUBLISHED" ? "Publish again" : "Publish course"}
        </Button>
      )}
      {canDelete ? (
        <Button variant="danger-outline" onClick={() => setConfirm("delete")}>
          <Trash2 aria-hidden /> Delete course
        </Button>
      ) : null}

      <ConfirmDialog
        open={confirm === "unpublish"}
        onClose={() => setConfirm(null)}
        title="Unpublish this course?"
        confirmLabel="Unpublish"
        action={() => unpublishCourseAction(courseId)}
      >
        It will disappear from the catalogue and nobody new can enroll. Students who already have it keep their access.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        title="Delete this course?"
        confirmLabel="Delete course"
        action={() => deleteCourseAction(courseId)}
      >
        The course, its lectures and all uploaded files will be permanently removed. This can&apos;t be undone.
      </ConfirmDialog>
    </div>
  );
}

export function CouponForm({ courseId }: { courseId: string }) {
  return (
    <ActionForm action={createCouponAction} resetOnSuccess className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_8rem_9rem_10rem_auto] lg:items-start">
      <input type="hidden" name="courseId" value={courseId} />
      <Field label="Code">
        <Input name="code" required maxLength={30} placeholder="LAUNCH50" className="uppercase placeholder:normal-case" autoComplete="off" />
        <FieldError name="code" />
      </Field>
      <Field label="Discount %">
        <Input name="percentOff" type="number" min={1} max={100} required placeholder="50" />
        <FieldError name="percentOff" />
      </Field>
      <Field label="Usage limit" optional>
        <Input name="maxRedemptions" type="number" min={1} placeholder="No limit" />
        <FieldError name="maxRedemptions" />
      </Field>
      <Field label="Expires" optional>
        <Input name="expiresAt" type="date" />
        <FieldError name="expiresAt" />
      </Field>
      <SubmitButton className="lg:mt-[1.625rem]">Create coupon</SubmitButton>
    </ActionForm>
  );
}

export function CouponRowActions({ couponId, isActive, sharePath }: { couponId: string; isActive: boolean; sharePath: string }) {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const toggle = useServerAction(setCouponActiveAction);
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      <Button
        size="sm"
        variant="outline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(window.location.origin + sharePath);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          } catch {
            toast.error("Couldn't copy the link. You can share: " + sharePath);
          }
        }}
      >
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copied" : "Copy link"}
      </Button>
      <Button size="sm" variant="outline" disabled={toggle.pending} onClick={() => toggle.run(couponId, !isActive)}>
        {isActive ? "Disable" : "Enable"}
      </Button>
      <Button size="sm" variant="ghost" className="text-muted" aria-label="Delete coupon" onClick={() => setConfirming(true)}>
        <Trash2 aria-hidden />
      </Button>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Delete this coupon?"
        confirmLabel="Delete coupon"
        action={() => deleteCouponAction(couponId)}
      >
        The code will stop working immediately. Past purchases are not affected.
      </ConfirmDialog>
    </div>
  );
}

export function AnnouncementForm({ courseId }: { courseId: string }) {
  // Remount the editor after posting so its text clears.
  const [version, setVersion] = useState(0);
  return (
    <ActionForm action={postAnnouncementAction} resetOnSuccess onSuccess={() => setVersion((v) => v + 1)} className="flex flex-col gap-4">
      <input type="hidden" name="courseId" value={courseId} />
      <Field label="Title">
        <Input name="title" required minLength={3} maxLength={160} />
        <FieldError name="title" />
      </Field>
      <div>
        <p className="mb-1.5 text-sm font-semibold">Message</p>
        <MarkdownEditor key={version} name="body" label="Message" rows={6} maxLength={10000} />
        <FieldError name="body" className="mt-1.5" />
      </div>
      <SubmitButton className="self-start" pendingLabel="Posting…">
        Post announcement
      </SubmitButton>
    </ActionForm>
  );
}

export function DeleteAnnouncementButton({ id }: { id: string }) {
  const { run, pending } = useServerAction(deleteAnnouncementAction);
  return (
    <Button variant="ghost" size="sm" className="text-muted" disabled={pending} onClick={() => run(id)}>
      <Trash2 aria-hidden /> Delete
    </Button>
  );
}

export function ReviewReplyForm({ reviewId, reply }: { reviewId: string; reply: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {reply ? "Edit reply" : "Reply"}
      </Button>
    );
  }
  return (
    <ActionForm action={replyToReviewAction} onSuccess={() => setOpen(false)} className="flex flex-col gap-2">
      <input type="hidden" name="reviewId" value={reviewId} />
      <Textarea name="reply" rows={3} maxLength={2000} defaultValue={reply} aria-label="Your reply" placeholder="Write a public reply. Leave empty to remove it." />
      <FieldError name="reply" />
      <div className="flex gap-2">
        <SubmitButton size="sm">Save reply</SubmitButton>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </ActionForm>
  );
}
