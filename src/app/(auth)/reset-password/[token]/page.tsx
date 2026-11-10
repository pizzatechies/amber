import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, FormSkeleton } from "@/components/site/auth-card";
import { ActionForm, FieldError, SubmitButton } from "@/components/ui/action-form";
import { Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password";
import { hashToken } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { requestTime } from "@/lib/request";
import { resetPasswordAction } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default function ResetPasswordPage(props: PageProps<"/reset-password/[token]">) {
  return (
    <AuthCard title="Choose a new password">
      <Suspense fallback={<FormSkeleton fields={1} />}>
        <ResetForm params={props.params} />
      </Suspense>
    </AuthCard>
  );
}

async function ResetForm({ params }: Pick<PageProps<"/reset-password/[token]">, "params">) {
  const { token } = await params;
  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { expiresAt: true, usedAt: true },
  });
  const valid = !!record && !record.usedAt && record.expiresAt.getTime() > (await requestTime());

  if (!valid) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="danger" title="This link is no longer valid">
          Reset links work once and expire after an hour.
        </Alert>
        <Link href="/forgot-password" className="text-sm font-semibold text-brand-text hover:underline">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <ActionForm action={resetPasswordAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <Field label="New password" htmlFor="password" hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
        />
        <FieldError name="password" />
      </Field>
      <SubmitButton size="lg" className="mt-2 w-full" pendingLabel="Saving…">
        Save password and log in
      </SubmitButton>
    </ActionForm>
  );
}
