import { Suspense } from "react";
import type { Metadata } from "next";
import { FormSkeleton } from "@/components/site/auth-card";
import { ActionForm, FieldError, SubmitButton } from "@/components/ui/action-form";
import { Field, Input } from "@/components/ui/form";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password";
import { requireUser } from "@/lib/auth/session";
import { changePasswordAction } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Change password" };

export default function SecurityPage() {
  return (
    <div className="max-w-md">
      <Suspense fallback={<FormSkeleton fields={2} />}>
        <PasswordForm />
      </Suspense>
    </div>
  );
}

async function PasswordForm() {
  await requireUser("/account/security");
  return (
    <ActionForm action={changePasswordAction} resetOnSuccess resetOnHide className="flex flex-col gap-4">
      <Field label="Current password">
        <Input name="currentPassword" type="password" autoComplete="current-password" required />
        <FieldError name="currentPassword" />
      </Field>
      <Field label="New password" hint={`At least ${PASSWORD_MIN_LENGTH} characters. Changing it signs you out on other devices.`}>
        <Input name="newPassword" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN_LENGTH} />
        <FieldError name="newPassword" />
      </Field>
      <SubmitButton className="mt-2 self-start" pendingLabel="Updating…">
        Update password
      </SubmitButton>
    </ActionForm>
  );
}
