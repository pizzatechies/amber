import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard, FormSkeleton } from "@/components/site/auth-card";
import { ActionForm, FieldError, SubmitButton } from "@/components/ui/action-form";
import { Field, Input } from "@/components/ui/form";
import { getCurrentUser } from "@/lib/auth/session";
import { firstParam, safeNextPath } from "@/lib/utils";
import { signInAction } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <AuthCard
      title="Welcome back"
      subtitle="Log in to pick up where you left off."
      footer={
        <>
          New here?{" "}
          <Link href="/signup" className="font-semibold text-brand-text hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <Suspense fallback={<FormSkeleton />}>
        <LoginForm searchParams={props.searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function LoginForm({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const next = safeNextPath(firstParam((await searchParams).next));
  if (await getCurrentUser()) redirect(next);

  return (
    <ActionForm action={signInAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
        <FieldError name="email" />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
        <FieldError name="password" />
      </Field>
      <SubmitButton size="lg" className="mt-2 w-full" pendingLabel="Logging in…">
        Log in
      </SubmitButton>
      <Link href="/forgot-password" className="text-center text-sm font-semibold text-brand-text hover:underline">
        Forgot your password?
      </Link>
    </ActionForm>
  );
}
