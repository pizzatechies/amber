import Link from "next/link";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Info, Star, TriangleAlert } from "lucide-react";
import { cn, hashString, initials } from "@/lib/utils";
import { mediaUrl } from "@/lib/urls";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-line bg-surface", className)} {...props} />;
}

const badgeTones = {
  neutral: "bg-surface-2 text-muted",
  brand: "bg-brand-soft text-brand-text",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  warn: "bg-warn-soft text-warn",
} as const;

export type BadgeTone = keyof typeof badgeTones;

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap [&_svg]:size-3",
        badgeTones[tone],
        className,
      )}
      {...props}
    />
  );
}

const avatarHues = [28, 160, 205, 265, 340, 95];

export function Avatar({
  name,
  assetId,
  size = 40,
  className,
}: {
  name: string;
  assetId?: string | null;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.38)) };
  const src = mediaUrl(assetId);
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- uploads are pre-sized in the browser
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        style={style}
        className={cn("shrink-0 rounded-full bg-surface-2 object-cover", className)}
      />
    );
  }
  const hue = avatarHues[hashString(name) % avatarHues.length];
  return (
    <span
      aria-hidden
      style={{ ...style, background: `oklch(0.9 0.06 ${hue})`, color: `oklch(0.35 0.09 ${hue})` }}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-bold select-none", className)}
    >
      {initials(name)}
    </span>
  );
}

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden style={style} className={cn("animate-shimmer rounded-lg bg-surface-3/70", className)} />;
}

export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-14 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand-text [&_svg]:size-6">
          {icon}
        </div>
      ) : null}
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      {children ? <div className="mt-2 max-w-md text-sm leading-relaxed text-muted">{children}</div> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

const alertTones = {
  info: { box: "border-info/25 bg-info-soft text-info", Icon: Info },
  success: { box: "border-success/25 bg-success-soft text-success", Icon: CheckCircle2 },
  warn: { box: "border-warn/25 bg-warn-soft text-warn", Icon: TriangleAlert },
  danger: { box: "border-danger/25 bg-danger-soft text-danger", Icon: AlertCircle },
} as const;

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof alertTones;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const { box, Icon } = alertTones[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-xl border px-4 py-3 text-sm", box, className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 leading-relaxed">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn("text-fg", title && "mt-0.5")}>{children}</div> : null}
      </div>
    </div>
  );
}

export function ProgressBar({ value, label, className }: { value: number; label?: string; className?: string }) {
  const pct = Math.round(Math.min(100, Math.max(0, value)));
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? "Progress"}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)}
    >
      <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Read-only star rating; fractional values are drawn as a partial fill. */
export function Stars({ value, size = 16, className }: { value: number; size?: number; className?: string }) {
  const pct = Math.min(100, Math.max(0, (value / 5) * 100));
  const row = (cls: string) => (
    <span className={cn("flex", cls)}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} width={size} height={size} className="shrink-0" fill="currentColor" strokeWidth={0} />
      ))}
    </span>
  );
  return (
    <span
      role="img"
      aria-label={`Rated ${value.toFixed(1)} out of 5`}
      className={cn("relative inline-block align-middle", className)}
      style={{ width: size * 5, height: size }}
    >
      {row("absolute inset-0 text-surface-3")}
      <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pct}%` }}>
        {row("text-brand")}
      </span>
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-semibold">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Numbered pagination that preserves the current query string. */
export function Pagination({
  page,
  pageCount,
  basePath,
  params,
  pageParam = "page",
  hash,
}: {
  page: number;
  pageCount: number;
  basePath: string;
  params?: Record<string, string | undefined>;
  /** Name of the query parameter that carries the page number. */
  pageParam?: string;
  /** Element id to scroll to after navigating. */
  hash?: string;
}) {
  if (pageCount <= 1) return null;

  const href = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params ?? {})) if (v) qs.set(k, v);
    if (p > 1) qs.set(pageParam, String(p));
    const s = qs.toString();
    return (s ? `${basePath}?${s}` : basePath) + (hash ? `#${hash}` : "");
  };

  const pages = new Set<number>([1, pageCount, page - 1, page, page + 1]);
  const list = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);

  const item = "inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-semibold";
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-1">
      {page > 1 ? (
        <Link href={href(page - 1)} className={cn(item, "hover:bg-surface-2")} aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </Link>
      ) : null}
      {list.map((p, i) => (
        <span key={p} className="flex items-center gap-1">
          {i > 0 && p - list[i - 1]! > 1 ? <span className="px-1 text-subtle">…</span> : null}
          {p === page ? (
            <span aria-current="page" className={cn(item, "bg-fg text-bg")}>
              {p}
            </span>
          ) : (
            <Link href={href(p)} className={cn(item, "hover:bg-surface-2")}>
              {p}
            </Link>
          )}
        </span>
      ))}
      {page < pageCount ? (
        <Link href={href(page + 1)} className={cn(item, "hover:bg-surface-2")} aria-label="Next page">
          <ChevronRight className="size-4" />
        </Link>
      ) : null}
    </nav>
  );
}
