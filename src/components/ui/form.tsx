import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-lg border border-line-strong bg-surface text-sm text-fg placeholder:text-subtle transition-colors hover:border-fg/40 focus:border-focus focus:outline-2 focus:outline-offset-0 focus:outline-focus/30 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, "h-10 px-3", className)} {...props} />;
}

export function Textarea({ className, rows = 4, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows} className={cn(control, "px-3 py-2 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(control, "h-10 px-3 pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-semibold text-fg", className)} {...props} />;
}

/**
 * Label + control + optional hint. The control is nested inside the <label>,
 * so the two are associated without an id. That matters here: Next.js keeps
 * recently visited pages in the DOM (hidden), so ids such as "email" would
 * exist twice and a `for="email"` label could point at the hidden copy.
 * Put a <FieldError name="..."/> after the control for validation messages.
 */
export function Field({
  label,
  hint,
  optional,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label className="flex flex-col gap-1.5">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-fg">{label}</span>
          {optional ? <span className="text-xs font-normal text-subtle">Optional</span> : null}
        </span>
        {children}
      </label>
      {hint ? <p className="text-xs leading-relaxed text-muted">{hint}</p> : null}
    </div>
  );
}

export function Checkbox({
  label,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5 text-sm", className)}>
      <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]" {...props} />
      <span>{label}</span>
    </label>
  );
}
