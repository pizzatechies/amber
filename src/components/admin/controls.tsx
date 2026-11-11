"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { ActionForm, FieldError, SubmitButton, useServerAction } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import {
  adminUnpublishCourseAction,
  deleteCategoryAction,
  moveCategoryAction,
  refundOrderAction,
  reviewCourseAction,
  saveCategoryAction,
  saveSettingsAction,
  setUserRoleAction,
  setUserStatusAction,
} from "@/server/actions/admin";

export function ReviewDecisionForm({ courseId }: { courseId: string }) {
  return (
    <ActionForm action={reviewCourseAction} className="flex flex-col gap-4">
      <input type="hidden" name="courseId" value={courseId} />
      <Field label="Note to the instructor" hint="Required when requesting changes. Sent by email and shown in their studio.">
        <Textarea name="note" rows={4} maxLength={2000} placeholder="What needs to change before this can be published?" />
        <FieldError name="note" />
      </Field>
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="decision" value="approve">
          Approve and publish
        </SubmitButton>
        <SubmitButton name="decision" value="reject" variant="danger-outline">
          Request changes
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function UnpublishButton({ courseId }: { courseId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="danger-outline" onClick={() => setOpen(true)}>
        Unpublish course
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Unpublish this course?"
        confirmLabel="Unpublish"
        action={() => adminUnpublishCourseAction(courseId)}
      >
        It leaves the catalogue and the instructor is notified. Enrolled students keep their access.
      </ConfirmDialog>
    </>
  );
}

export function UserControls({
  userId,
  role,
  status,
  isSelf,
}: {
  userId: string;
  role: "STUDENT" | "INSTRUCTOR" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED";
  isSelf: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const setRole = useServerAction(setUserRoleAction);
  const setStatus = useServerAction(setUserStatusAction);
  if (isSelf) return <span className="text-xs text-subtle">This is you</span>;
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Select
        value={role}
        aria-label="Role"
        disabled={setRole.pending}
        onChange={(e) => setRole.run(userId, e.target.value as typeof role)}
        className="h-8 w-auto! text-xs"
      >
        <option value="STUDENT">Student</option>
        <option value="INSTRUCTOR">Instructor</option>
        <option value="ADMIN">Admin</option>
      </Select>
      {status === "ACTIVE" ? (
        <Button size="sm" variant="danger-outline" onClick={() => setConfirming(true)}>
          Suspend
        </Button>
      ) : (
        <Button size="sm" variant="outline" disabled={setStatus.pending} onClick={() => setStatus.run(userId, "ACTIVE")}>
          Reactivate
        </Button>
      )}
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Suspend this account?"
        confirmLabel="Suspend"
        action={() => setUserStatusAction(userId, "SUSPENDED")}
      >
        They will be signed out immediately and won&apos;t be able to log in until reactivated.
      </ConfirmDialog>
    </div>
  );
}

export function CategoryForm({ category, onDone }: { category?: { id: string; name: string; description: string }; onDone?: () => void }) {
  return (
    <ActionForm action={saveCategoryAction} resetOnSuccess={!category} onSuccess={onDone} className="grid gap-3 sm:grid-cols-[14rem_1fr_auto] sm:items-start">
      {category ? <input type="hidden" name="id" value={category.id} /> : null}
      <Field label="Name">
        <Input name="name" defaultValue={category?.name} required minLength={2} maxLength={60} />
        <FieldError name="name" />
      </Field>
      <Field label="Description" optional>
        <Input name="description" defaultValue={category?.description} maxLength={300} />
        <FieldError name="description" />
      </Field>
      <SubmitButton className="sm:mt-[1.625rem]">{category ? "Save" : "Add category"}</SubmitButton>
    </ActionForm>
  );
}

export function CategoryRow({
  category,
  first,
  last,
}: {
  category: { id: string; name: string; description: string; courseCount: number };
  first: boolean;
  last: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const move = useServerAction(moveCategoryAction, { quiet: true });
  const icon = "rounded-lg p-1.5 text-muted hover:bg-surface-3 hover:text-fg disabled:opacity-30";

  if (editing) {
    return (
      <li className="p-4">
        <CategoryForm category={category} onDone={() => setEditing(false)} />
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </li>
    );
  }
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{category.name}</p>
        <p className="truncate text-xs text-subtle">
          {category.courseCount} course{category.courseCount === 1 ? "" : "s"}
          {category.description ? ` · ${category.description}` : ""}
        </p>
      </div>
      <button type="button" className={icon} aria-label={`Move ${category.name} up`} disabled={first || move.pending} onClick={() => move.run(category.id, "up")}>
        <ArrowUp className="size-4" />
      </button>
      <button type="button" className={icon} aria-label={`Move ${category.name} down`} disabled={last || move.pending} onClick={() => move.run(category.id, "down")}>
        <ArrowDown className="size-4" />
      </button>
      <button type="button" className={icon} aria-label={`Edit ${category.name}`} onClick={() => setEditing(true)}>
        <Pencil className="size-4" />
      </button>
      <button type="button" className={icon} aria-label={`Delete ${category.name}`} onClick={() => setConfirming(true)}>
        <Trash2 className="size-4" />
      </button>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Delete “${category.name}”?`}
        confirmLabel="Delete category"
        action={() => deleteCategoryAction(category.id)}
      >
        Categories that still contain courses can&apos;t be deleted.
      </ConfirmDialog>
    </li>
  );
}

export function RefundButton({ orderId, number, total }: { orderId: string; number: number; total: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="danger-outline" onClick={() => setOpen(true)}>
        Refund
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Refund order #${number}?`}
        confirmLabel={`Refund ${total}`}
        action={() => refundOrderAction(orderId)}
      >
        The full amount is returned through the payment provider and the buyer loses access to the courses in this order.
      </ConfirmDialog>
    </>
  );
}

export function SettingsForm({ settings }: { settings: { requireCourseReview: boolean; instructorSharePercent: number } }) {
  return (
    <ActionForm action={saveSettingsAction} className="flex max-w-xl flex-col gap-6">
      <Checkbox
        name="requireCourseReview"
        defaultChecked={settings.requireCourseReview}
        label={
          <>
            <span className="font-semibold">Review courses before they go live</span>
            <span className="block text-xs text-muted">
              When on, an administrator must approve each course. When off, instructors publish instantly.
            </span>
          </>
        }
      />
      <Field label="Instructor revenue share (%)" hint="The part of each sale that belongs to the instructor. Applies to future sales only.">
        <Input name="instructorSharePercent" type="number" min={0} max={100} defaultValue={settings.instructorSharePercent} required className="max-w-32" />
        <FieldError name="instructorSharePercent" />
      </Field>
      <SubmitButton className="self-start">Save settings</SubmitButton>
    </ActionForm>
  );
}
