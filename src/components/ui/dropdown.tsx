"use client";

import {
  createContext,
  use,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const CloseContext = createContext<() => void>(() => {});

/**
 * Accessible menu button: opens on click, closes on outside click, Escape
 * or selection, and supports arrow-key navigation between items.
 */
export function Dropdown({
  trigger,
  label,
  children,
  align = "end",
  triggerClassName,
  menuClassName,
}: {
  trigger: ReactNode;
  /** Accessible name for the trigger when its content is only an icon. */
  label?: string;
  children: ReactNode;
  align?: "start" | "end";
  triggerClassName?: string;
  menuClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  // Pages stay mounted (hidden) after navigating away; don't come back to an open menu.
  useLayoutEffect(() => () => setOpen(false), []);

  const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  function close(refocus = true) {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      close();
      return;
    }
    if (!open || (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End")) return;
    e.preventDefault();
    const list = items();
    if (list.length === 0) return;
    const current = list.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? list.length - 1
          : e.key === "ArrowDown"
            ? (current + 1) % list.length
            : (current - 1 + list.length) % list.length;
    list[next]?.focus();
  }

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          className={cn(
            "absolute top-full z-50 mt-2 min-w-56 animate-rise rounded-xl border border-line bg-surface p-1.5 shadow-pop",
            align === "end" ? "right-0" : "left-0",
            menuClassName,
          )}
        >
          <CloseContext value={() => close(false)}>{children}</CloseContext>
        </div>
      ) : null}
    </div>
  );
}

const itemClass =
  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-fg hover:bg-surface-2 focus-visible:bg-surface-2 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted";

export function DropdownLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  const close = use(CloseContext);
  return (
    <Link href={href} role="menuitem" onClick={close} className={cn(itemClass, className)}>
      {children}
    </Link>
  );
}

export function DropdownButton({
  onSelect,
  children,
  className,
  disabled,
}: {
  onSelect: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const close = use(CloseContext);
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        close();
        onSelect();
      }}
      className={cn(itemClass, "disabled:opacity-50", className)}
    >
      {children}
    </button>
  );
}

export function DropdownSeparator() {
  return <div role="separator" className="my-1.5 h-px bg-line" />;
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return <div className="px-3 py-2 text-sm">{children}</div>;
}
