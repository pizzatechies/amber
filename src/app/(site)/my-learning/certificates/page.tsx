import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Award } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "My certificates" };

export default function CertificatesPage() {
  return (
    <div className="container-page py-10">
      <h1 className="font-display text-3xl font-semibold sm:text-4xl">My certificates</h1>
      <Suspense fallback={<Skeleton className="mt-8 h-48 w-full" />}>
        <Certificates />
      </Suspense>
    </div>
  );
}

async function Certificates() {
  const user = await requireUser("/my-learning/certificates");
  const certificates = await db.certificate.findMany({
    where: { userId: user.id },
    orderBy: { issuedAt: "desc" },
    select: { id: true, code: true, courseTitle: true, instructorName: true, issuedAt: true },
  });

  if (certificates.length === 0) {
    return (
      <EmptyState
        className="mt-8"
        icon={<Award />}
        title="No certificates yet"
        action={<LinkButton href="/my-learning">Go to my learning</LinkButton>}
      >
        Finish every lecture in a course to earn its certificate of completion.
      </EmptyState>
    );
  }

  return (
    <ul className="mt-8 grid gap-4 md:grid-cols-2">
      {certificates.map((c) => (
        <li key={c.id}>
          <Link
            href={`/certificates/${c.code}`}
            className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-5 transition-shadow hover:shadow-card"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-text">
              <Award className="size-6" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block leading-snug font-bold">{c.courseTitle}</span>
              <span className="mt-0.5 block text-sm text-muted">
                {c.instructorName} · Issued {formatDate(c.issuedAt)}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
