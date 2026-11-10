import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";

export const SESSION_COOKIE = "amber_session";
const SESSION_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarAssetId: string | null;
};

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

function cookieOptions(maxAgeSec: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Secure whenever the site itself is served over HTTPS.
    secure: (process.env.APP_URL ?? "").startsWith("https://"),
    path: "/",
    maxAge: maxAgeSec,
  };
}

/** Start a session for the user and set the cookie. Call from a Server Action or Route Handler. */
export async function createSession(userId: string): Promise<void> {
  const token = newToken();
  const userAgent = ((await headers()).get("user-agent") ?? "").slice(0, 300);
  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      userAgent,
      expiresAt: new Date(Date.now() + SESSION_DAYS * DAY_MS),
    },
  });
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions(SESSION_DAYS * 24 * 60 * 60));
}

/** End the current session and clear the cookie. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.delete(SESSION_COOKIE);
}

/** Sign the user out everywhere except (optionally) the current browser. */
export async function destroyOtherSessions(userId: string): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  await db.session.deleteMany({
    where: { userId, ...(token ? { NOT: { tokenHash: hashToken(token) } } : {}) },
  });
}

/**
 * The signed-in user, or null. Reads the request cookie, so under Cache
 * Components it must be awaited inside a <Suspense> boundary.
 * Deduplicated per request with React.cache.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      lastSeenAt: true,
      user: { select: { id: true, name: true, email: true, role: true, status: true, avatarAssetId: true } },
    },
  });
  if (!session) return null;

  await connection();
  const now = Date.now();
  if (session.expiresAt.getTime() <= now || session.user.status !== "ACTIVE") return null;

  if (now - session.lastSeenAt.getTime() > 60 * 60 * 1000) {
    // Best-effort activity stamp; never block or fail the request on it.
    db.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date(now) } })
      .catch(() => undefined);
  }

  const { id, name, email, role, avatarAssetId } = session.user;
  return { id, name, email, role, avatarAssetId };
});

export function isAdmin(user: Pick<SessionUser, "role"> | null | undefined): boolean {
  return user?.role === "ADMIN";
}

/** Admins can do everything an instructor can. */
export function isInstructor(user: Pick<SessionUser, "role"> | null | undefined): boolean {
  return user?.role === "INSTRUCTOR" || user?.role === "ADMIN";
}

function loginUrl(next?: string): string {
  return next ? `/login?next=${encodeURIComponent(next)}` : "/login";
}

/** For pages: the signed-in user, or a redirect to the login page. */
export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(loginUrl(next));
  return user;
}

/** For pages: an instructor (or admin). Students are sent to the "teach" page. */
export async function requireInstructor(next?: string): Promise<SessionUser> {
  const user = await requireUser(next);
  if (!isInstructor(user)) redirect("/teach");
  return user;
}

/** For pages: an admin. Everyone else is sent home. */
export async function requireAdmin(next?: string): Promise<SessionUser> {
  const user = await requireUser(next);
  if (!isAdmin(user)) redirect("/");
  return user;
}
