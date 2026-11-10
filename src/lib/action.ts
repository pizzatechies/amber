import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { getCurrentUser, isAdmin, isInstructor, type SessionUser } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/action-types";

export type { ActionResult, FormState } from "@/lib/action-types";

/** An expected failure with a message that is safe to show to the user. */
export class ActionError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ActionError";
  }
}

export function ok(message?: string): ActionResult;
export function ok<T>(message: string | undefined, data: T): ActionResult<T>;
export function ok<T>(message?: string, data?: T): ActionResult<T> {
  return { ok: true, message, data };
}

function zodFieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/**
 * Wraps the body of a Server Action so it always resolves to an ActionResult:
 * expected failures become `{ ok: false }`, unexpected ones are logged and
 * reported generically, and Next.js control flow (redirect, notFound) passes through.
 */
export async function run<T = undefined>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof ActionError) {
      return { ok: false, error: err.message, fieldErrors: err.fieldErrors };
    }
    if (err instanceof z.ZodError) {
      return { ok: false, error: "Please check the highlighted fields.", fieldErrors: zodFieldErrors(err) };
    }
    console.error("[action] unexpected error:", err);
    return { ok: false, error: "Something went wrong on our side. Please try again." };
  }
}

/** Validate input with a zod schema; a failure is reported as field errors. */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  return schema.parse(data);
}

/** Plain string values from a form submission (files are ignored). */
export function formValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) out[key] = value;
  }
  return out;
}

/** All string values for a repeated form field. */
export function formList(formData: FormData, name: string): string[] {
  return formData.getAll(name).filter((v): v is string => typeof v === "string");
}

// ── Authorisation inside actions (never trust the UI to have gated the call) ──

export async function actionUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new ActionError("Please sign in to continue.");
  return user;
}

export async function actionInstructor(): Promise<SessionUser> {
  const user = await actionUser();
  if (!isInstructor(user)) throw new ActionError("You need an instructor account to do that.");
  return user;
}

export async function actionAdmin(): Promise<SessionUser> {
  const user = await actionUser();
  if (!isAdmin(user)) throw new ActionError("You don't have permission to do that.");
  return user;
}
