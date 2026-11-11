import { Suspense } from "react";
import type { Metadata } from "next";
import { FormSkeleton } from "@/components/site/auth-card";
import { ActionForm, FieldError, SubmitButton } from "@/components/ui/action-form";
import { LinkButton } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Card, PageHeader } from "@/components/ui/misc";
import { requireInstructor } from "@/lib/auth/session";
import { createCourseAction } from "@/server/actions/studio";

export const metadata: Metadata = { title: "New course" };

export default function NewCoursePage() {
  return (
    <>
      <PageHeader title="New course" description="Start with a working title. You can change it at any time before publishing." />
      <Card className="mt-8 max-w-xl p-6">
        <Suspense fallback={<FormSkeleton fields={1} />}>
          <NewCourseForm />
        </Suspense>
      </Card>
    </>
  );
}

async function NewCourseForm() {
  await requireInstructor("/instructor/courses/new");
  return (
    <ActionForm action={createCourseAction} className="flex flex-col gap-5">
      <Field label="Course title" hint="For example: “Watercolour Painting for Beginners”.">
        <Input name="title" required minLength={5} maxLength={120} autoFocus />
        <FieldError name="title" />
      </Field>
      <div className="flex gap-2">
        <SubmitButton pendingLabel="Creating…">Create course</SubmitButton>
        <LinkButton href="/instructor/courses" variant="ghost">
          Cancel
        </LinkButton>
      </div>
    </ActionForm>
  );
}
