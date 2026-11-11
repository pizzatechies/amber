"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { ActionError, actionAdmin, formValues, ok, parse, run, type ActionResult, type FormState } from "@/lib/action";
import { refundOrder } from "@/lib/commerce/orders";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { mails, sendMail } from "@/lib/mail";
import { notify } from "@/lib/notify";
import { saveSettings } from "@/lib/settings";
import { courseUrl, studioUrl } from "@/lib/urls";
import { slugify } from "@/lib/utils";
import { idSchema, text } from "@/lib/validation";

// ───────────────────────── Course moderation ─────────────────────────

const reviewSchema = z.object({
  courseId: idSchema,
  decision: z.enum(["approve", "reject"]),
  note: text("Note", 0, 2000),
});

export async function reviewCourseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(async () => {
    await actionAdmin();
    const input = parse(reviewSchema, formValues(formData));
    const course = await db.course.findUnique({
      where: { id: input.courseId },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        publishedAt: true,
        instructor: { select: { id: true, name: true, email: true } },
      },
    });
    if (!course) throw new ActionError("That course no longer exists.");
    if (course.status !== "IN_REVIEW") throw new ActionError("This course is not waiting for review.");

    const approved = input.decision === "approve";
    if (!approved && !input.note) {
      throw new ActionError("Explain what needs to change.", { note: ["Add a note so the instructor knows what to fix."] });
    }

    await db.course.update({
      where: { id: course.id },
      data: approved
        ? { status: "PUBLISHED", publishedAt: course.publishedAt ?? new Date(), reviewNote: "" }
        : { status: "REJECTED", reviewNote: input.note },
    });
    await notify({
      userId: course.instructor.id,
      title: approved ? "Your course is live" : "Changes requested for your course",
      body: course.title,
      href: approved ? courseUrl(course.slug) : studioUrl(course.id),
    });
    await sendMail(
      mails.courseReviewed(course.instructor.email, course.instructor.name, {
        title: course.title,
        approved,
        note: input.note,
        link: appUrl(approved ? courseUrl(course.slug) : studioUrl(course.id)),
      }),
    );
    refresh();
    return ok(approved ? "Course approved and published." : "Sent back to the instructor.");
  });
}

/** Take a live course out of the catalogue (for example after a complaint). */
export async function adminUnpublishCourseAction(courseId: string): Promise<ActionResult> {
  return run(async () => {
    await actionAdmin();
    const course = await db.course.findUnique({
      where: { id: parse(idSchema, courseId) },
      select: { id: true, title: true, status: true, instructorId: true },
    });
    if (!course || course.status !== "PUBLISHED") throw new ActionError("This course isn't published.");
    await db.course.update({ where: { id: course.id }, data: { status: "UNPUBLISHED" } });
    await notify({
      userId: course.instructorId,
      title: "Your course was unpublished by an administrator",
      body: course.title,
      href: studioUrl(course.id),
    });
    refresh();
    return ok("Course unpublished.");
  });
}

// ───────────────────────── Users ─────────────────────────

export async function setUserRoleAction(userId: string, role: "STUDENT" | "INSTRUCTOR" | "ADMIN"): Promise<ActionResult> {
  return run(async () => {
    const admin = await actionAdmin();
    const id = parse(idSchema, userId);
    const next = parse(z.enum(["STUDENT", "INSTRUCTOR", "ADMIN"]), role);
    if (id === admin.id) throw new ActionError("You can't change your own role.");
    const target = await db.user.findUnique({ where: { id }, select: { role: true } });
    if (!target) throw new ActionError("That user no longer exists.");
    if (next === "STUDENT" && (await db.course.count({ where: { instructorId: id } })) > 0) {
      throw new ActionError("This user owns courses, so they need to stay an instructor.");
    }
    await db.user.update({ where: { id }, data: { role: next } });
    refresh();
    return ok("Role updated.");
  });
}

export async function setUserStatusAction(userId: string, status: "ACTIVE" | "SUSPENDED"): Promise<ActionResult> {
  return run(async () => {
    const admin = await actionAdmin();
    const id = parse(idSchema, userId);
    const next = parse(z.enum(["ACTIVE", "SUSPENDED"]), status);
    if (id === admin.id) throw new ActionError("You can't suspend your own account.");
    await db.user.update({ where: { id }, data: { status: next } });
    // A suspended user is signed out everywhere at once.
    if (next === "SUSPENDED") await db.session.deleteMany({ where: { userId: id } });
    refresh();
    return ok(next === "SUSPENDED" ? "Account suspended." : "Account reactivated.");
  });
}

// ───────────────────────── Categories ─────────────────────────

const categorySchema = z.object({
  id: z.string().max(64).optional(),
  name: text("Name", 2, 60),
  description: text("Description", 0, 300),
});

export async function saveCategoryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(async () => {
    await actionAdmin();
    const input = parse(categorySchema, formValues(formData));
    const clash = await db.category.findFirst({
      where: { name: { equals: input.name, mode: "insensitive" }, ...(input.id ? { NOT: { id: input.id } } : {}) },
      select: { id: true },
    });
    if (clash) throw new ActionError("A category with that name already exists.", { name: ["That name is taken."] });

    if (input.id) {
      await db.category.update({ where: { id: input.id }, data: { name: input.name, description: input.description } });
    } else {
      let slug = slugify(input.name) || "category";
      if (await db.category.findUnique({ where: { slug }, select: { id: true } })) slug = `${slug}-${Date.now().toString(36)}`;
      const position = await db.category.count();
      await db.category.create({ data: { name: input.name, description: input.description, slug, position } });
    }
    refresh();
    return ok(input.id ? "Category saved." : "Category added.");
  });
}

export async function deleteCategoryAction(categoryId: string): Promise<ActionResult> {
  return run(async () => {
    await actionAdmin();
    const id = parse(idSchema, categoryId);
    const inUse = await db.course.count({ where: { categoryId: id } });
    if (inUse > 0) {
      throw new ActionError(`${inUse} course${inUse === 1 ? " uses" : "s use"} this category. Move them to another category first.`);
    }
    await db.category.delete({ where: { id } });
    refresh();
    return ok("Category deleted.");
  });
}

export async function moveCategoryAction(categoryId: string, direction: "up" | "down"): Promise<ActionResult> {
  return run(async () => {
    await actionAdmin();
    const all = await db.category.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }], select: { id: true } });
    const ids = all.map((c) => c.id);
    const from = ids.indexOf(parse(idSchema, categoryId));
    const to = direction === "up" ? from - 1 : from + 1;
    if (from < 0 || to < 0 || to >= ids.length) return ok();
    [ids[from], ids[to]] = [ids[to]!, ids[from]!];
    await db.$transaction(ids.map((id, position) => db.category.update({ where: { id }, data: { position } })));
    refresh();
    return ok();
  });
}

// ───────────────────────── Orders and settings ─────────────────────────

export async function refundOrderAction(orderId: string): Promise<ActionResult> {
  return run(async () => {
    await actionAdmin();
    await refundOrder(parse(idSchema, orderId));
    refresh();
    return ok("Order refunded and access removed.");
  });
}

const settingsFormSchema = z.object({
  requireCourseReview: z.string().optional(),
  instructorSharePercent: z.coerce.number().int("Enter a whole number.").min(0, "Enter 0 to 100.").max(100, "Enter 0 to 100."),
});

export async function saveSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(async () => {
    await actionAdmin();
    const input = parse(settingsFormSchema, formValues(formData));
    await saveSettings({
      requireCourseReview: input.requireCourseReview === "on",
      instructorSharePercent: input.instructorSharePercent,
    });
    refresh();
    return ok("Settings saved.");
  });
}
