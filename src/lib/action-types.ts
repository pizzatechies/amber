// Shared between Server Actions and the client components that call them.

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** State for forms driven by `useActionState`. */
export type FormState = ActionResult<unknown> | null;

export type FormAction = (prev: FormState, formData: FormData) => Promise<FormState>;
