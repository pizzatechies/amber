import { Suspense } from "react";
import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/controls";
import { FormSkeleton } from "@/components/site/auth-card";
import { PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Settings" };

export default function AdminSettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Rules that apply across the whole platform." />
      <div className="mt-8">
        <Suspense fallback={<div className="max-w-xl"><FormSkeleton fields={2} /></div>}>
          <Settings />
        </Suspense>
      </div>
    </>
  );
}

async function Settings() {
  await requireAdmin("/admin/settings");
  const settings = await getSettings();
  return (
    <>
      <SettingsForm settings={settings} />
      <p className="mt-10 max-w-xl rounded-xl bg-surface-2 p-4 text-sm leading-relaxed text-muted">
        The site name (<strong className="text-fg">{site.name}</strong>), currency (<strong className="text-fg">{site.currency}</strong>),
        file storage, payment provider and email are configured with environment variables. See the README.
      </p>
    </>
  );
}
