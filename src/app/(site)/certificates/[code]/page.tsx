import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { LogoMark } from "@/components/site/logo";
import { Skeleton } from "@/components/ui/misc";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { site } from "@/lib/site";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Certificate of completion", robots: { index: false } };

export default function CertificatePage(props: PageProps<"/certificates/[code]">) {
  return (
    <div className="container-page py-10 print:p-0">
      <Suspense fallback={<Skeleton className="mx-auto aspect-[1.414] w-full max-w-4xl" />}>
        <Certificate params={props.params} />
      </Suspense>
    </div>
  );
}

async function Certificate({ params }: Pick<PageProps<"/certificates/[code]">, "params">) {
  const { code } = await params;
  const certificate = await db.certificate.findUnique({
    where: { code: code.toUpperCase() },
    select: { code: true, recipientName: true, courseTitle: true, instructorName: true, issuedAt: true },
  });
  if (!certificate) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <p className="flex items-center gap-2 text-sm text-muted">
          <ShieldCheck className="size-5 text-success" aria-hidden />
          <span>
            This is a valid certificate issued by {site.name} to <strong className="text-fg">{certificate.recipientName}</strong>.
          </span>
        </p>
        <PrintButton />
      </div>

      {/* The certificate itself. Fixed light colours so it prints the same in any theme. */}
      <article
        className="certificate relative overflow-hidden rounded-2xl border border-[#d9cdb8] bg-[#fffdf8] p-3 text-[#1d1a16] shadow-card print:rounded-none print:border-0 print:shadow-none"
        style={{ aspectRatio: "1.414 / 1" }}
      >
        <div className="flex h-full flex-col items-center justify-between rounded-xl border-2 border-[#f2a31b] px-6 py-8 text-center sm:px-14 sm:py-12">
          <header className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <LogoMark size={32} />
              <span className="font-display text-2xl font-semibold">{site.name}</span>
            </div>
            <h1 className="text-xs font-bold tracking-[0.3em] text-[#a35600] uppercase sm:text-sm">Certificate of completion</h1>
          </header>

          <div className="flex flex-col items-center">
            <p className="text-sm text-[#5f574c]">This certifies that</p>
            <p className="mt-2 font-display text-3xl leading-tight font-semibold sm:text-5xl">{certificate.recipientName}</p>
            <p className="mt-4 text-sm text-[#5f574c]">has successfully completed the course</p>
            <p className="mt-2 max-w-2xl font-display text-xl leading-snug font-semibold sm:text-3xl">{certificate.courseTitle}</p>
          </div>

          <footer className="grid w-full grid-cols-3 items-end gap-4 text-xs sm:text-sm">
            <div className="text-left">
              <p className="font-bold">{certificate.instructorName}</p>
              <p className="mt-1 border-t border-[#d9cdb8] pt-1 text-[#5f574c]">Instructor</p>
            </div>
            <div>
              <p className="font-mono text-[0.7rem] tracking-wider sm:text-xs">{certificate.code}</p>
              <p className="mt-1 text-[#5f574c]">Certificate ID</p>
            </div>
            <div className="text-right">
              <p className="font-bold">{formatDate(certificate.issuedAt)}</p>
              <p className="mt-1 border-t border-[#d9cdb8] pt-1 text-[#5f574c]">Date issued</p>
            </div>
          </footer>
        </div>
      </article>

      <p className="mt-4 text-center text-xs text-subtle print:hidden">
        Anyone with this page&apos;s link can confirm the certificate is genuine.
      </p>
    </div>
  );
}
