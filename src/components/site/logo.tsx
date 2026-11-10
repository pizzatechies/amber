import Link from "next/link";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

/** The brand mark: a rounded amber tile with a rising "spark". */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className={className}>
      <rect width="32" height="32" rx="9" fill="var(--brand)" />
      <path
        d="M16 6.5c.6 4.6 2.6 7 7.5 8.2-4.9 1.2-6.9 3.6-7.5 8.8-.6-5.2-2.6-7.6-7.5-8.8 4.9-1.200 6.9-3.600 7.500-8.200Z"
        fill="var(--brand-ink)"
      />
      <circle cx="23.2" cy="23.6" r="1.7" fill="var(--brand-ink)" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("flex shrink-0 items-center gap-2 rounded-lg", className)}
      aria-label={`${site.name} home`}
    >
      <LogoMark />
      <span className="font-display text-[1.35rem] leading-none font-semibold">{site.name}</span>
    </Link>
  );
}
