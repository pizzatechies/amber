"use client";

import {
  createContext,
  startTransition,
  use,
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
} from "react";
import { LoaderCircle } from "lucide-react";
import type { ActionResult, FormAction, FormState } from "@/lib/action-types";
import { Button } from "./button";
import { Alert } from "./misc";
import { toast } from "./toast";
import { cn } from "@/lib/utils";

type Ctx = { state: FormState; pending: boolean };
const FormContext = createContext<Ctx>({ state: null, pending: false });

/**
 * A <form> wired to a Server Action that returns a FormState.
 * Shows the action's error at the top, exposes field errors to <FieldError>,
 * and keeps what the user typed when validation fails (React would otherwise
 * reset an uncontrolled form after every action).
 */
export function ActionForm({
  action,
  children,
  className,
  onSuccess,
  resetOnSuccess,
  toastSuccess = true,
  ...props
}: Omit<ComponentProps<"form">, "action" | "onSubmit"> & {
  action: FormAction;
  onSuccess?: (result: Extract<ActionResult<unknown>, { ok: true }>) => void;
  resetOnSuccess?: boolean;
  /** Toast the action's success message. On by default. */
  toastSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  });

  // Field errors that no <FieldError> in the form is showing; listed at the top instead.
  const [unclaimed, setUnclaimed] = useState<string[]>([]);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      if (state.message && toastSuccess) toast.success(state.message);
      if (resetOnSuccess) formRef.current?.reset();
      onSuccessRef.current?.(state);
      return;
    }
    const shown = new Set(
      Array.from(formRef.current?.querySelectorAll<HTMLElement>("[data-field-error]") ?? []).map(
        (el) => el.dataset.fieldError,
      ),
    );
    setUnclaimed(
      Object.entries(state.fieldErrors ?? {})
        .filter(([name]) => !shown.has(name))
        .flatMap(([, messages]) => messages.slice(0, 1)),
    );
    formRef.current?.querySelector<HTMLElement>("[role=alert]")?.scrollIntoView({ block: "nearest" });
  }, [state, resetOnSuccess, toastSuccess]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    // Submit ourselves so React does not reset the fields afterwards.
    event.preventDefault();
    const data = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
    startTransition(() => formAction(data));
  }

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className={className} {...props}>
      <FormContext value={{ state, pending }}>
        {state && !state.ok ? (
          <Alert tone="danger" className="mb-4">
            {state.error}
            {unclaimed.length > 0 ? (
              <ul className="mt-1 list-disc pl-4">
                {unclaimed.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            ) : null}
          </Alert>
        ) : null}
        {children}
      </FormContext>
    </form>
  );
}

/** Validation message for one field of the enclosing <ActionForm>. */
export function FieldError({ name, className }: { name: string; className?: string }) {
  const { state } = use(FormContext);
  const errors = state && !state.ok ? state.fieldErrors?.[name] : undefined;
  if (!errors?.length) return null;
  return (
    <p role="alert" data-field-error={name} className={cn("text-xs font-medium text-danger", className)}>
      {errors[0]}
    </p>
  );
}

export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: Omit<ComponentProps<typeof Button>, "type"> & { pendingLabel?: ReactNode }) {
  const { pending } = use(FormContext);
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}

/**
 * Call a Server Action from an event handler with pending state and
 * automatic error/success toasts.
 */
export function useServerAction<Args extends unknown[], T>(
  action: (...args: Args) => Promise<ActionResult<T>>,
  opts: { onSuccess?: (data: T | undefined) => void; quiet?: boolean } = {},
) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });

  const run = useCallback(
    (...args: Args) => {
      start(async () => {
        setError(null);
        let result: ActionResult<T>;
        try {
          result = await action(...args);
        } catch {
          result = { ok: false, error: "Could not reach the server. Check your connection and try again." };
        }
        if (result.ok) {
          if (result.message && !optsRef.current.quiet) toast.success(result.message);
          optsRef.current.onSuccess?.(result.data);
        } else {
          setError(result.error);
          toast.error(result.error);
        }
      });
    },
    [action],
  );

  return { run, pending, error };
}

/** A button that runs a Server Action when clicked. */
export function ActionButton<T>({
  action,
  onSuccess,
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick" | "type"> & {
  action: () => Promise<ActionResult<T>>;
  onSuccess?: (data: T | undefined) => void;
}) {
  const { run, pending } = useServerAction(action, { onSuccess });
  return (
    <Button {...props} disabled={pending || props.disabled} aria-busy={pending} onClick={() => run()}>
      {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
      {children}
    </Button>
  );
}
