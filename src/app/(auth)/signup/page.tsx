import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard, FormSkeleton } from "@/components/site/auth-card";
import { ActionForm, FieldError, SubmitButton } from "@/components/ui/action-form";
import { Field, Input } from "@/components/ui/form";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password";
import { getCurrentUser } from "@/lib/auth/session";
import { site } from "@/lib/site";
import { firstParam, safeNextPath } from "@/lib/utils";
import { signUpAction } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage(props: PageProps<"/signup">) {
  return (
    <AuthCard
      title={`Join ${site.name}`}
      subtitle="One account for learning and teaching."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-brand-text hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <Suspense fallback={<FormSkeleton fields={3} />}>
        <SignupForm searchParams={props.searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function SignupForm({ searchParams }: Pick<PageProps<"/signup">, "searchParams">) {
  const next = safeNextPath(firstParam((await searchParams).next));
  if (await getCurrentUser()) redirect(next);

  return (
    <ActionForm action={signUpAction} resetOnHide className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Full name">
        <Input name="name" autoComplete="name" required maxLength={80} />
        <FieldError name="name" />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required />
        <FieldError name="email" />
      </Field>
      <Field label="Password" hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}>
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
        />
        <FieldError name="password" />
      </Field>
      <SubmitButton size="lg" className="mt-2 w-full" pendingLabel="Creating your account…">
        Create account
      </SubmitButton>
    </ActionForm>
  );
}
