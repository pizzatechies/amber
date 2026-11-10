"use client";

import { useState } from "react";
import { ActionForm, FieldError, SubmitButton } from "@/components/ui/action-form";
import { Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { requestPasswordResetAction } from "@/server/actions/auth";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState<string | null>(null);

  if (sent) {
    return (
      <Alert tone="success" title="Check your inbox">
        {sent}
      </Alert>
    );
  }

  return (
    <ActionForm
      action={requestPasswordResetAction}
      toastSuccess={false}
      onSuccess={(r) => setSent(r.message ?? "If an account exists for that email, a reset link is on its way.")}
      className="flex flex-col gap-4"
    >
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required />
        <FieldError name="email" />
      </Field>
      <SubmitButton size="lg" className="mt-2 w-full" pendingLabel="Sending…">
        Send reset link
      </SubmitButton>
    </ActionForm>
  );
}
