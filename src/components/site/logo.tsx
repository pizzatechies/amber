import Link from "next/link";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";
import { LOGO_ARROW, LOGO_STEPS, LOGO_STROKE } from "./logo-mark";

/** The brand mark ("Rising Steps"): a staircase climbing to an arrow on an amber tile. */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  const line = {
    fill: "none",
    stroke: "var(--brand-ink)",
    strokeWidth: LOGO_STROKE,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className={className}>
      <rect width="32" height="32" rx="9" fill="var(--brand)" />
      <path d={LOGO_STEPS} {...line} />
      <path d={LOGO_ARROW} {...line} />
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
