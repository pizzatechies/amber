"use client";

import { useSyncExternalStore } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastItem = { id: number; kind: "success" | "error"; message: string };

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function push(kind: ToastItem["kind"], message: string) {
  const id = nextId++;
  items = [...items.slice(-3), { id, kind, message }];
  emit();
  window.setTimeout(() => dismiss(id), kind === "error" ? 7000 : 4000);
}

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

/** Show a transient message from any client component. */
export const toast = {
  success: (message: string) => push("success", message),
  error: (message: string) => push("error", message),
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const empty: ToastItem[] = [];

/** Rendered once in the root layout. */
export function Toaster() {
  const list = useSyncExternalStore(
    subscribe,
    () => items,
    () => empty,
  );
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end"
    >
      {list.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className={cn(
            "pointer-events-auto flex w-full max-w-sm animate-rise items-start gap-3 rounded-xl border bg-surface px-4 py-3 text-sm shadow-pop",
            t.kind === "error" ? "border-danger/40" : "border-line",
          )}
        >
          {t.kind === "error" ? (
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
          ) : (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          )}
          <p className="min-w-0 flex-1 leading-relaxed">{t.message}</p>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="-m-1 rounded p-1 text-subtle hover:text-fg"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
