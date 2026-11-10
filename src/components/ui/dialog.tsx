"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { LoaderCircle, X } from "lucide-react";
import type { ActionResult } from "@/lib/action-types";
import { cn } from "@/lib/utils";
import { Button, type ButtonVariant } from "./button";
import { useServerAction } from "./action-form";

/**
 * Modal built on the native <dialog>, which provides focus trapping,
 * Escape-to-close and the backdrop for free.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // Pages stay mounted (hidden) after navigating away; don't come back to an open dialog.
  useLayoutEffect(() => {
    const el = ref.current;
    return () => {
      if (el?.open) el.close();
    };
  }, []);

  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" } as const;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the <dialog> element itself.
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface p-0 text-fg shadow-pop open:animate-rise",
        widths[size],
      )}
    >
      {open ? (
        <div className="flex max-h-[min(90dvh,56rem)] flex-col">
          <header className="flex items-start gap-4 border-b border-line px-6 py-4">
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl font-semibold">{title}</h2>
              {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-m-1.5 rounded-lg p-1.5 text-subtle hover:bg-surface-2 hover:text-fg"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </header>
          {children ? <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div> : null}
          {footer ? (
            <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">{footer}</footer>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}

/** Ask for confirmation, then run a Server Action. */
export function ConfirmDialog<T>({
  open,
  onClose,
  title,
  children,
  confirmLabel = "Confirm",
  confirmVariant = "danger",
  action,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  confirmLabel?: string;
  confirmVariant?: ButtonVariant;
  action: () => Promise<ActionResult<T>>;
  onSuccess?: (data: T | undefined) => void;
}) {
  const { run, pending } = useServerAction(action, {
    onSuccess: (data) => {
      onClose();
      onSuccess?.(data);
    },
  });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant={confirmVariant} onClick={() => run()} disabled={pending} aria-busy={pending}>
            {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children ? <div className="text-sm leading-relaxed text-muted">{children}</div> : null}
    </Dialog>
  );
}
