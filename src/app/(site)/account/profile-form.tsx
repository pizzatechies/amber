"use client";

import { useState } from "react";
import { ActionForm, FieldError, SubmitButton } from "@/components/ui/action-form";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Avatar } from "@/components/ui/misc";
import { ImageUploader } from "@/components/ui/uploader";
import { updateProfileAction } from "@/server/actions/account";

export function ProfileForm({
  profile,
}: {
  profile: { name: string; email: string; headline: string; bio: string; websiteUrl: string; avatarAssetId: string | null };
}) {
  const [avatar, setAvatar] = useState(profile.avatarAssetId);
  return (
    <ActionForm action={updateProfileAction} className="flex max-w-2xl flex-col gap-6">
      <input type="hidden" name="avatarAssetId" value={avatar ?? ""} />
      <div>
        <p className="mb-2 text-sm font-semibold">Profile photo</p>
        <ImageUploader
          purpose="avatar"
          value={avatar}
          onChange={setAvatar}
          width={320}
          height={320}
          round
          label="Upload a photo"
          placeholder={<Avatar name={profile.name} size={80} />}
        />
      </div>
      <Field label="Full name">
        <Input name="name" defaultValue={profile.name} required maxLength={80} autoComplete="name" />
        <FieldError name="name" />
      </Field>
      <Field label="Email" hint="Your email is used to sign in and can't be changed here.">
        <Input value={profile.email} disabled readOnly />
      </Field>
      <Field label="Headline" optional hint="A short line shown under your name, such as your job title.">
        <Input name="headline" defaultValue={profile.headline} maxLength={120} />
        <FieldError name="headline" />
      </Field>
      <Field label="About you" optional hint="Shown on your public instructor profile.">
        <Textarea name="bio" defaultValue={profile.bio} rows={6} maxLength={2000} />
        <FieldError name="bio" />
      </Field>
      <Field label="Website" optional>
        <Input name="websiteUrl" type="url" defaultValue={profile.websiteUrl} placeholder="https://" maxLength={300} />
        <FieldError name="websiteUrl" />
      </Field>
      <SubmitButton className="self-start" pendingLabel="Saving…">
        Save profile
      </SubmitButton>
    </ActionForm>
  );
}
