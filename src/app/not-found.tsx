import type { Metadata } from "next";
import { LogoMark } from "@/components/site/logo";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <LogoMark size={48} />
      <p className="mt-6 text-sm font-bold tracking-wide text-brand-text uppercase">404</p>
      <h1 className="mt-2 font-display text-4xl font-semibold">We couldn&apos;t find that page</h1>
      <p className="mt-3 max-w-md text-muted">It may have been moved or unpublished, or the link might be mistyped.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <LinkButton href="/courses">Browse courses</LinkButton>
        <LinkButton href="/" variant="outline">
          Go home
        </LinkButton>
      </div>
    </main>
  );
}
