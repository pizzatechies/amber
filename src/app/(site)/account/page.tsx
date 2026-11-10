import { Suspense } from "react";
import type { Metadata } from "next";
import { FormSkeleton } from "@/components/site/auth-card";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Your profile" };

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl"><FormSkeleton fields={4} /></div>}>
      <Profile />
    </Suspense>
  );
}

async function Profile() {
  const user = await requireUser("/account");
  const profile = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { name: true, email: true, headline: true, bio: true, websiteUrl: true, avatarAssetId: true },
  });
  return <ProfileForm profile={profile} />;
}
