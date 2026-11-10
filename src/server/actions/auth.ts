"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { ActionError, actionUser, formValues, ok, parse, run, type FormState } from "@/lib/action";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { clientIp, rateLimit } from "@/lib/auth/rate-limit";
import { createSession, destroyOtherSessions, destroySession, hashToken, newToken } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { mails, sendMail } from "@/lib/mail";
import { safeNextPath } from "@/lib/utils";
import { emailSchema, nameSchema, passwordSchema } from "@/lib/validation";

const MINUTE = 60 * 1000;

function tooMany(retryAfterSec: number): never {
  const minutes = Math.ceil(retryAfterSec / 60);
  throw new ActionError(`Too many attempts. Please wait ${minutes} minute${minutes === 1 ? "" : "s"} and try again.`);
}

// Verifying against a throwaway hash when the email is unknown keeps response
// times the same, so sign-in can't be used to discover which emails exist.
let dummyHash: Promise<string> | undefined;
function getDummyHash(): Promise<string> {
  return (dummyHash ??= hashPassword("not-a-real-password"));
}

const signUpSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  next: z.string().optional(),
});

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(async () => {
    const input = parse(signUpSchema, formValues(formData));

    const limit = rateLimit(`signup:${await clientIp()}`, 10, 60 * MINUTE);
    if (!limit.ok) tooMany(limit.retryAfterSec);

    const existing = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) {
      throw new ActionError("An account with this email already exists. Try signing in instead.", {
        email: ["This email is already registered."],
      });
    }

    const user = await db.user.create({
      data: { name: input.name, email: input.email, passwordHash: await hashPassword(input.password) },
      select: { id: true },
    });
    await createSession(user.id);
    redirect(safeNextPath(input.next));
  });
}

const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(1000),
  next: z.string().optional(),
});

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(async () => {
    const input = parse(signInSchema, formValues(formData));

    const ip = await clientIp();
    const byIp = rateLimit(`signin:ip:${ip}`, 30, 15 * MINUTE);
    if (!byIp.ok) tooMany(byIp.retryAfterSec);
    const byAccount = rateLimit(`signin:acct:${input.email}`, 8, 15 * MINUTE);
    if (!byAccount.ok) tooMany(byAccount.retryAfterSec);

    const user = await db.user.findUnique({
      where: { email: input.email },
      select: { id: true, passwordHash: true, status: true },
    });
    const valid = await verifyPassword(input.password, user?.passwordHash ?? (await getDummyHash()));
    if (!user || !valid) throw new ActionError("Incorrect email or password.");
    if (user.status !== "ACTIVE") {
      throw new ActionError("This account has been suspended. Contact support if you think this is a mistake.");
    }

    await createSession(user.id);
    redirect(safeNextPath(input.next));
  });
}

/**
 * The client follows this with a full page load (see UserMenu) rather than a
 * client-side redirect, so no preserved page keeps showing the old session.
 */
export async function signOutAction(): Promise<void> {
  await destroySession();
}

const forgotSchema = z.object({ email: emailSchema });

export async function requestPasswordResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(async () => {
    const { email } = parse(forgotSchema, formValues(formData));

    const limit = rateLimit(`reset:${await clientIp()}`, 5, 60 * MINUTE);
    if (!limit.ok) tooMany(limit.retryAfterSec);

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, status: true },
    });
    if (user && user.status === "ACTIVE") {
      const token = newToken();
      await db.passwordResetToken.create({
        data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60 * MINUTE) },
      });
      await sendMail(mails.passwordReset(user.email, user.name, appUrl(`/reset-password/${token}`)));
    }
    // Same answer whether or not the account exists.
    return ok("If an account exists for that email, a reset link is on its way.");
  });
}

const resetSchema = z.object({ token: z.string().min(10).max(200), password: passwordSchema });

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(async () => {
    const input = parse(resetSchema, formValues(formData));

    const record = await db.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(input.token) },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw new ActionError("This reset link is invalid or has expired. Request a new one.");
    }

    const passwordHash = await hashPassword(input.password);
    await db.$transaction([
      db.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      // A reset signs the account out everywhere.
      db.session.deleteMany({ where: { userId: record.userId } }),
    ]);

    await createSession(record.userId);
    redirect("/");
  });
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password.").max(1000),
  newPassword: passwordSchema,
});

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(async () => {
    const user = await actionUser();
    const input = parse(changePasswordSchema, formValues(formData));

    const limit = rateLimit(`pwchange:${user.id}`, 10, 15 * MINUTE);
    if (!limit.ok) tooMany(limit.retryAfterSec);

    const record = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
    if (!(await verifyPassword(input.currentPassword, record.passwordHash))) {
      throw new ActionError("Your current password is incorrect.", {
        currentPassword: ["That doesn't match your current password."],
      });
    }

    await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(input.newPassword) } });
    await destroyOtherSessions(user.id);
    return ok("Password updated. Other devices have been signed out.");
  });
}
