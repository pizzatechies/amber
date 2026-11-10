import "server-only";
import { connection } from "next/server";

/**
 * The current time, for use while rendering.
 *
 * Under Cache Components a bare `Date.now()` in a Server Component is an
 * error, because the result could be frozen into a prerendered shell.
 * Awaiting `connection()` first states that this render belongs to a live
 * request. (Server Actions and Route Handlers can call Date.now() directly.)
 */
export async function requestTime(): Promise<number> {
  await connection();
  return Date.now();
}
