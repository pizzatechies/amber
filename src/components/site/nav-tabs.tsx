"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: ReactNode; count?: number; exact?: boolean };

function isActive(pathname: string, item: NavItem, items: NavItem[]): boolean {
  if (pathname === item.href) return true;
  if (item.exact) return false;
  if (!pathname.startsWith(item.href + "/")) return false;
  // Prefer the most specific match: "/a" shouldn't light up when "/a/b" is also a tab and matches.
  return !items.some((other) => other.href.length > item.href.length && (pathname === other.href || pathname.startsWith(other.href + "/")));
}

/** Horizontal link tabs that highlight the current route. */
export function NavTabs({ items, label, className }: { items: NavItem[]; label: string; className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className={cn("flex gap-1 overflow-x-auto border-b border-line", className)}>
      {items.map((item) => {
        const active = isActive(pathname, item, items);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-bold whitespace-nowrap",
              active ? "border-fg text-fg" : "border-transparent text-muted hover:text-fg",
            )}
          >
            {item.label}
            {item.count ? (
              <span className="rounded-full bg-brand px-1.5 text-xs font-bold text-brand-ink">{item.count}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** Vertical link list for sidebars. */
export function NavList({ items, label, className }: { items: Array<NavItem & { icon?: ReactNode }>; label: string; className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className={cn("flex flex-col gap-0.5", className)}>
      {items.map((item) => {
        const active = isActive(pathname, item, items);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold [&_svg]:size-4 [&_svg]:shrink-0",
              active ? "bg-brand-soft text-brand-text" : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            {item.icon}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.count ? (
              <span className="rounded-full bg-brand px-1.5 text-xs font-bold text-brand-ink">{item.count}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
