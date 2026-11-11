"use server";

import { randomBytes } from "node:crypto";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  ActionError,
  actionInstructor,
  formList,
  formValues,
  ok,
  parse,
  run,
  type ActionResult,
  type FormState,
} from "@/lib/action";
import { claimableAsset, deleteAssets } from "@/lib/assets";
import { COUPON_CODE_PATTERN, normalizeCouponCode } from "@/lib/commerce/pricing";
import { manageableCourse } from "@/lib/courses/access";
import { isPublishable } from "@/lib/courses/checklist";
import { quizSchema } from "@/lib/courses/quiz";
import { lectureIsReady, refreshCourseContentStats } from "@/lib/courses/stats";
import { embedUrl, readingTimeSec } from "@/lib/courses/video";
import { db } from "@/lib/db";
import { parseAmount } from "@/lib/money";
import { notify } from "@/lib/notify";
import { getSettings } from "@/lib/settings";
import { LANGUAGES } from "@/lib/site";
import { courseUrl, studioUrl } from "@/lib/urls";
import { slugify } from "@/lib/utils";
import { idSchema, text } from "@/lib/validation";
import type { SessionUser } from "@/lib/auth/session";
import type { LectureType } from "@/generated/prisma/enums";

const MAX_SECTIONS = 100;
const MAX_LECTURES = 500;

// ───────────────────────── Helpers ─────────────────────────

async function uniqueSlug(title: string, exceptCourseId?: string): Promise<string> {
  const base = slugify(title) || "course";
  for (let attempt = 0; attempt < 6; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${randomBytes(2).toString("hex")}`;
    const taken = await db.course.findUnique({ where: { slug }, select: { id: true } });
    if (!taken || taken.id === exceptCourseId) return slug;
  }
  return `${base}-${randomBytes(5).toString("hex")}`;
}

/** Load a section or lecture and check the user may edit the course it belongs to. */
async function editableSection(user: SessionUser, sectionId: string) {
  const section = await db.section.findUnique({
    where: { id: parse(idSchema, sectionId) },
    select: { id: true, courseId: true, position: true },
  });
  if (!section) throw new ActionError("That section no longer exists.");
  await manageableCourse(user, section.courseId);
  return section;
}

async function editableLecture(user: SessionUser, lectureId: string) {
  const lecture = await db.lecture.findUnique({
    where: { id: parse(idSchema, lectureId) },
    select: {
      id: true,
      courseId: true,
      sectionId: true,
      position: true,
      type: true,
      title: true,
      mediaAssetId: true,
      videoUrl: true,
      content: true,
      quiz: true,
      durationSec: true,
    },
  });
  if (!lecture) throw new ActionError("That lecture no longer exists.");
  await manageableCourse(user, lecture.courseId);
  return lecture;
}

/** Re-number siblings 0..n-1 in the given order. */
async function reorder(model: "section" | "lecture", ids: string[]): Promise<void> {
  await db.$transaction(
    ids.map((id, position) =>
      model === "section"
        ? db.section.update({ where: { id }, data: { position } })
        : db.lecture.update({ where: { id }, data: { position } }),
    ),
  );
}

// ───────────────────────── Course ─────────────────────────

const createSchema = z.object({ title: text("Course title", 5, 120) });

export async function createCourseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(async () => {
    const user = await actionInstructor();
    const { title } = parse(createSchema, formValues(formData));
    const count = await db.course.count({ where: { instructorId: user.id } });
    if (count >= 200) throw new ActionError("You've reached the limit of 200 courses.");

    const course = await db.course.create({
      data: { title, slug: await uniqueSlug(title), instructorId: user.id },
      select: { id: true },
    });
    redirect(studioUrl(course.id, "details"));
  });
}

const detailsSchema = z.object({
  courseId: idSchema,
  title: text("Title", 5, 120),
  subtitle: text("Subtitle", 0, 200),
  description: text("Description", 0, 20_000),
  categoryId: z.string().max(64),
  level: z.enum(["ALL_LEVELS", "BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  language: z.enum(LANGUAGES),
  thumbnailAssetId: z.string().max(64),
  promoAssetId: z.string().max(64),
});

export async function updateCourseDetailsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(async () => {
    const user = await actionInstructor();
    const input = parse(detailsSchema, formValues(formData));
    const course = await manageableCourse(user, input.courseId);
    const current = await db.course.findUniqueOrThrow({
      where: { id: course.id },
      select: { thumbnailAssetId: true, promoAssetId: true, publishedAt: true, title: true, instructorId: true },
    });

    if (input.categoryId && !(await db.category.findUnique({ where: { id: input.categoryId }, select: { id: true } }))) {
      throw new ActionError("That category no longer exists.", { categoryId: ["Choose a category from the list."] });
    }

    // Newly uploaded files must belong to the course owner and not be in use elsewhere.
    const thumbnailAssetId = input.thumbnailAssetId || null;
    const promoAssetId = input.promoAssetId || null;
    if (thumbnailAssetId && thumbnailAssetId !== current.thumbnailAssetId) {
      if (!(await claimableAsset(thumbnailAssetId, user.id, "IMAGE"))) {
        throw new ActionError("The image upload didn't finish. Please upload it again.");
      }
    }
    if (promoAssetId && promoAssetId !== current.promoAssetId) {
      if (!(await claimableAsset(promoAssetId, user.id, "VIDEO"))) {
        throw new ActionError("The promo video upload didn't finish. Please upload it again.");
      }
    }

    // The public URL follows the title until the course has been published once.
    const slug = !current.publishedAt && input.title !== current.title ? await uniqueSlug(input.title, course.id) : undefined;

    await db.course.update({
      where: { id: course.id },
      data: {
        title: input.title,
        subtitle: input.subtitle,
        description: input.description,
        categoryId: input.categoryId || null,
        level: input.level,
        language: input.language,
        thumbnailAssetId,
        promoAssetId,
        ...(slug ? { slug } : {}),
      },
    });
    await deleteAssets([
      current.thumbnailAssetId !== thumbnailAssetId ? current.thumbnailAssetId : null,
      current.promoAssetId !== promoAssetId ? current.promoAssetId : null,
    ]);
    refresh();
    return ok("Course details saved.");
  });
}

const listItem = z.string().trim().max(200);
const goalsSchema = z.object({
  courseId: idSchema,
  outcomes: z.array(listItem).max(20),
  requirements: z.array(listItem).max(20),
  audience: z.array(listItem).max(20),
});

export async function updateCourseGoalsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(async () => {
    const user = await actionInstructor();
    const input = parse(goalsSchema, {
      courseId: formData.get("courseId"),
      outcomes: formList(formData, "outcomes"),
      requirements: formList(formData, "requirements"),
      audience: formList(formData, "audience"),
    });
    const course = await manageableCourse(user, input.courseId);
    const clean = (items: string[]) => [...new Set(items.filter(Boolean))];
    await db.course.update({
      where: { id: course.id },
      data: {
        outcomes: clean(input.outcomes),
        requirements: clean(input.requirements),
        audience: clean(input.audience),
      },
    });
    refresh();
    return ok("Saved.");
  });
}

const MAX_PRICE_MAJOR = 100_000;
const pricingSchema = z.object({ courseId: idSchema, mode: z.enum(["free", "paid"]), price: z.string().max(20) });

export async function updateCoursePricingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(async () => {
    const user = await actionInstructor();
    const input = parse(pricingSchema, { price: "", ...formValues(formData) });
    const course = await manageableCourse(user, input.courseId);

    let priceCents = 0;
    if (input.mode === "paid") {
      const parsed = parseAmount(input.price);
      const oneUnit = parseAmount("1") ?? 100;
      if (parsed === null || parsed < oneUnit || parsed > MAX_PRICE_MAJOR * oneUnit) {
        throw new ActionError("Enter a valid price.", {
          price: [`Enter an amount between 1 and ${MAX_PRICE_MAJOR.toLocaleString("en")}, or make the course free.`],
        });
      }
      priceCents = parsed;
    }
    await db.course.update({ where: { id: course.id }, data: { priceCents } });
    refresh();
    return ok(priceCents === 0 ? "This course is now free." : "Price saved.");
  });
}

/** Submit a draft for review, or publish it straight away when review is not required. */
export async function submitCourseAction(courseId: string): Promise<ActionResult> {
  return run(async () => {
    const user = await actionInstructor();
    const course = await manageableCourse(user, courseId);
    if (course.status === "PUBLISHED") throw new ActionError("This course is already published.");
    if (course.status === "IN_REVIEW") throw new ActionError("This course is already waiting for review.");

    const full = await db.course.findUniqueOrThrow({
      where: { id: course.id },
      select: {
        title: true,
        subtitle: true,
        description: true,
        categoryId: true,
        outcomes: true,
        publishedAt: true,
        _count: { select: { lectures: { where: { isReady: true } } } },
      },
    });
    if (!isPublishable({ ...full, readyLectureCount: full._count.lectures })) {
      throw new ActionError("This course isn't ready yet. Finish the checklist first.");
    }

    const { requireCourseReview } = await getSettings();
    // Admins don't need to approve their own courses.
    const needsReview = requireCourseReview && user.role !== "ADMIN";
    const now = new Date();

    if (needsReview) {
      await db.course.update({ where: { id: course.id }, data: { status: "IN_REVIEW", submittedAt: now } });
      const admins = await db.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true } });
      await notify(
        admins.map((a) => ({
          userId: a.id,
          title: "A course is waiting for review",
          body: course.title,
          href: `/admin/courses/${course.id}`,
        })),
      );
      refresh();
      return ok("Submitted for review. We'll notify you when it has been checked.");
    }

    await db.course.update({
      where: { id: course.id },
      data: { status: "PUBLISHED", submittedAt: now, publishedAt: full.publishedAt ?? now, reviewNote: "" },
    });
    refresh();
    return ok("Your course is live.");
  });
}

export async function withdrawSubmissionAction(courseId: string): Promise<ActionResult> {
  return run(async () => {
    const user = await actionInstructor();
    const course = await manageableCourse(user, courseId);
    if (course.status !== "IN_REVIEW") throw new ActionError("This course isn't waiting for review.");
    await db.course.update({ where: { id: course.id }, data: { status: "DRAFT" } });
    refresh();
    return ok("Submission withdrawn. The course is a draft again.");
  });
}

export async function unpublishCourseAction(courseId: string): Promise<ActionResult> {
  return run(async () => {
    const user = await actionInstructor();
    const course = await manageableCourse(user, courseId);
    if (course.status !== "PUBLISHED") throw new ActionError("This course isn't published.");
    await db.course.update({ where: { id: course.id }, data: { status: "UNPUBLISHED" } });
    refresh();
    return ok("The course is no longer listed. Enrolled students keep their access.");
  });
}

export async function deleteCourseAction(courseId: string): Promise<ActionResult> {
  return run(async () => {
    const user = await actionInstructor();
    const course = await manageableCourse(user, courseId);
    const [enrollments, sales] = await Promise.all([
      db.enrollment.count({ where: { courseId: course.id } }),
      db.orderItem.count({ where: { courseId: course.id } }),
    ]);
    if (enrollments > 0 || sales > 0) {
      throw new ActionError("A course with students can't be deleted, because they keep access to it. Unpublish it instead.");
    }

    const assets = await db.asset.findMany({
      where: {
        OR: [
          { thumbnailOf: { id: course.id } },
          { promoOf: { id: course.id } },
          { lecture: { courseId: course.id } },
          { resource: { lecture: { courseId: course.id } } },
        ],
      },
      select: { id: true },
    });
    await db.course.delete({ where: { id: course.id } });
    await deleteAssets(assets.map((a) => a.id));
    redirect("/instructor/courses");
  });
}

// ───────────────────────── Sections ─────────────────────────

const titleSchema = text("Title", 1, 160);

export async function createSectionAction(courseId: string, title: string): Promise<ActionResult> {
  return run(async () => {
    const user = await actionInstructor();
    const course = await manageableCourse(user, courseId);
    const count = await db.section.count({ where: { courseId: course.id } });
    if (count >= MAX_SECTIONS) throw new ActionError(`A course can have at most ${MAX_SECTIONS} sections.`);
    await db.section.create({ data: { courseId: course.id, title: parse(titleSchema, title), position: count } });
    refresh();
    return ok();
  });
}

export async function renameSectionAction(sectionId: string, title: string): Promise<ActionResult> {
  return run(async () => {
    const user = await actionInstructor();
    const section = await editableSection(user, sectionId);
    await db.section.update({ where: { id: section.id }, data: { title: parse(titleSchema, title) } });
    refresh();
    return ok();
  });
}

export async function deleteSectionAction(sectionId: string): Promise<ActionResult> {
  return run(async () => {
    const user = await actionInstructor();
    const section = await editableSection(user, sectionId);
    const assets = await db.asset.findMany({
      where: { OR: [{ lecture: { sectionId: section.id } }, { resource: { lecture: { sectionId: section.id } } }] },
      select: { id: true },
    });
    await db.section.delete({ where: { id: section.id } });
    await deleteAssets(assets.map((a) => a.id));
    const rest = await db.section.findMany({
      where: { courseId: section.courseId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    await reorder("section", rest.map((s) => s.id));
    await refreshCourseContentStats(section.courseId);
    refresh();
    return ok("Section deleted.");
  });
}

export async function moveSectionAction(sectionId: string, direction: "up" | "down"): Promise<ActionResult> {
  return run(async () => {
    const user = await actionInstructor();
    const section = await editableSection(user, sectionId);
    const all = await db.section.findMany({
      where: { courseId: section.courseId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    const ids = all.map((s) => s.id);
    const from = ids.indexOf(section.id);
    const to = direction === "up" ? from - 1 : from + 1;
    if (to < 0 || to >= ids.length) return ok();
    [ids[from], ids[to]] = [ids[to]!, ids[from]!];
    await reorder("section", ids);
    refresh();
    return ok();
  });
}

// ───────────────────────── Lectures ─────────────────────────

const lectureTypeSchema = z.enum(["VIDEO", "ARTICLE", "DOCUMENT", "QUIZ"]);

export async function createLectureAction(
  sectionId: string,
  type: LectureType,
  title: string,
): Promise<ActionResult<{ lectureId: string }>> {
  return run(async () => {
    const user = await actionInstructor();
    const section = await editableSection(user, sectionId);
    const total = await db.lecture.count({ where: { courseId: section.courseId } });
    if (total >= MAX_LECTURES) throw new ActionError(`A course can have at most ${MAX_LECTURES} lectures.`);
    const position = await db.lecture.count({ where: { sectionId: section.id } });
    const lecture = await db.lecture.create({
      data: {
        courseId: section.courseId,
        sectionId: section.id,
        type: parse(lectureTypeSchema, type),
        title: parse(titleSchema, title),
        position,
      },
      select: { id: true },
    });
    refresh();
    return ok(undefined, { lectureId: lecture.id });
  });
}

const lectureSchema = z.object({
  lectureId: idSchema,
  title: titleSchema,
  isPreview: z.boolean(),
  /** Article body, or notes shown under a video/document. Markdown. */
  content: z.string().max(100_000),
  /** YouTube/Vimeo link, as an alternative to an uploaded video. */
  videoUrl: z.string().trim().max(500),
  quiz: quizSchema.nullable(),
});

export type LectureInput = z.input<typeof lectureSchema>;

export async function saveLectureAction(input: LectureInput): Promise<ActionResult> {
  return run(async () => {
    const user = await actionInstructor();
    const data = parse(lectureSchema, input);
    const lecture = await editableLecture(user, data.lectureId);

    if (lecture.type === "VIDEO" && data.videoUrl && !embedUrl(data.videoUrl)) {
      throw new ActionError("That doesn't look like a YouTube or Vimeo video link.", {
        videoUrl: ["Paste the address of a YouTube or Vimeo video page."],
      });
    }

    const next = {
      title: data.title,
      isPreview: data.isPreview,
      content: data.content,
      videoUrl: lecture.type === "VIDEO" ? data.videoUrl : "",
      quiz: lecture.type === "QUIZ" ? data.quiz : null,
    };
    const durationSec =
      lecture.type === "ARTICLE"
        ? readingTimeSec(next.content)
        : lecture.type === "VIDEO"
          ? lecture.mediaAssetId
            ? lecture.durationSec
            : 0
          : 0;

    await db.lecture.update({
      where: { id: lecture.id },
      data: {
        ...next,
        quiz: next.quiz ?? undefined,
        durationSec,
        isReady: lectureIsReady({ type: lecture.type, mediaAssetId: lecture.mediaAssetId, ...next }),
      },
    });
    await refreshCourseContentStats(lecture.courseId);
    refresh();
    return ok("Lecture saved.");
  });
}

/** Attach an uploaded video/document to a lecture, replacing any previous one. Pass null to remove it. */
export async function setLectureMediaAction(lectureId: string, assetId: string | null): Promise<ActionResult> {
  return run(async () => {
    const user = await actionInstructor();
    const lecture = await editableLecture(user, lectureId);
    if (lecture.type !== "VIDEO" && lecture.type !== "DOCUMENT") {
      throw new ActionError("This kind of lecture doesn't take a file.");
    }

    let durationSec = 0;
    if (assetId) {
      const asset = await claimableAsset(parse(idSchema, assetId), user.id, lecture.type === "VIDEO" ? "VIDEO" : "FILE");
      if (!asset) throw new ActionError("That upload didn't finish. Please upload the file again.");
      durationSec = asset.durationSec;
    }

    const previous = lecture.mediaAssetId;
    await db.lecture.update({
      where: { id: lecture.id },
      data: {
        mediaAssetId: assetId,
        durationSec,
        isReady: lectureIsReady({
          type: lecture.type,
          mediaAssetId: assetId,
          videoUrl: lecture.videoUrl,
          content: lecture.content,
          quiz: lecture.quiz,
        }),
      },
    });
    if (previous && previous !== assetId) await deleteAssets([previous]);
    await refreshCourseContentStats(lecture.courseId);
    refresh();
    return ok(assetId ? "File attached." : "File removed.");
  });
}

export async function deleteLectureAction(lectureId: string): Promise<ActionResult> {
  return run(async () => {
    const user = await actionInstructor();
    const lecture = await editableLecture(user, lectureId);
    const resources = await db.lectureResource.findMany({
      where: { lectureId: lecture.id, assetId: { not: null } },
      select: { assetId: true },
    });
    await db.lecture.delete({ where: { id: lecture.id } });
    await deleteAssets([lecture.mediaAssetId, ...resources.map((r) => r.assetId)]);
    const rest = await db.lecture.findMany({
      where: { sectionId: lecture.sectionId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    await reorder("lecture", rest.map((l) => l.id));
    await refreshCourseContentStats(lecture.courseId);
    refresh();
    return ok("Lecture deleted.");
  });
}

/**
 * Move a lecture one step. At the top or bottom of its section it hops into
 * the neighbouring section, so a lecture can be walked anywhere in the course.
 */
export async function moveLectureAction(lectureId: string, direction: "up" | "down"): Promise<ActionResult> {
  return run(async () => {
    const user = await actionInstructor();
    const lecture = await editableLecture(user, lectureId);
    const siblings = await db.lecture.findMany({
      where: { sectionId: lecture.sectionId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    const ids = siblings.map((l) => l.id);
    const from = ids.indexOf(lecture.id);
    const to = direction === "up" ? from - 1 : from + 1;

    if (to >= 0 && to < ids.length) {
      [ids[from], ids[to]] = [ids[to]!, ids[from]!];
      await reorder("lecture", ids);
    } else {
      const sections = await db.section.findMany({
        where: { courseId: lecture.courseId },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });
      const index = sections.findIndex((s) => s.id === lecture.sectionId);
      const target = sections[direction === "up" ? index - 1 : index + 1];
      if (!target) return ok();

      const targetLectures = await db.lecture.findMany({
        where: { sectionId: target.id },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });
      const targetIds = targetLectures.map((l) => l.id);
      // Moving up lands at the end of the previous section; moving down at the start of the next.
      if (direction === "up") targetIds.push(lecture.id);
      else targetIds.unshift(lecture.id);

      await db.lecture.update({ where: { id: lecture.id }, data: { sectionId: target.id } });
      await reorder("lecture", targetIds);
      await reorder("lecture", ids.filter((id) => id !== lecture.id));
    }
    refresh();
    return ok();
  });
}

// ───────────────────────── Lecture resources ─────────────────────────

const resourceSchema = z.object({
  lectureId: idSchema,
  title: text("Resource name", 1, 120),
  assetId: z.string().max(64).optional(),
  url: z.string().trim().max(500).optional(),
});

export async function addLectureResourceAction(input: z.input<typeof resourceSchema>): Promise<ActionResult> {
  return run(async () => {
    const user = await actionInstructor();
    const data = parse(resourceSchema, input);
    const lecture = await editableLecture(user, data.lectureId);
    const position = await db.lectureResource.count({ where: { lectureId: lecture.id } });
    if (position >= 20) throw new ActionError("A lecture can have at most 20 resources.");

    if (data.assetId) {
      if (!(await claimableAsset(data.assetId, user.id, "FILE"))) {
        throw new ActionError("That upload didn't finish. Please upload the file again.");
      }
      await db.lectureResource.create({
        data: { lectureId: lecture.id, title: data.title, assetId: data.assetId, position },
      });
    } else {
      if (!data.url || !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(data.url)) {
        throw new ActionError("Enter a full link starting with https://", { url: ["Enter a full link starting with https://"] });
      }
      await db.lectureResource.create({ data: { lectureId: lecture.id, title: data.title, url: data.url, position } });
    }
    refresh();
    return ok("Resource added.");
  });
}

export async function removeLectureResourceAction(resourceId: string): Promise<ActionResult> {
  return run(async () => {
    const user = await actionInstructor();
    const resource = await db.lectureResource.findUnique({
      where: { id: parse(idSchema, resourceId) },
      select: { id: true, assetId: true, lecture: { select: { courseId: true } } },
    });
    if (!resource) return ok();
    await manageableCourse(user, resource.lecture.courseId);
    await db.lectureResource.delete({ where: { id: resource.id } });
    await deleteAssets([resource.assetId]);
    refresh();
    return ok("Resource removed.");
  });
}

// ───────────────────────── Coupons ─────────────────────────

const couponSchema = z.object({
  courseId: idSchema,
  code: z.string().transform(normalizeCouponCode).pipe(
    z.string().regex(COUPON_CODE_PATTERN, "Use 3–30 letters, numbers, dashes or underscores."),
  ),
  percentOff: z.coerce.number().int("Enter a whole number.").min(1, "Enter a discount from 1 to 100.").max(100, "Enter a discount from 1 to 100."),
  maxRedemptions: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number().int().min(1, "Enter 1 or more, or leave it blank for no limit.").max(1_000_000).nullable()),
  expiresAt: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : new Date(`${v}T23:59:59.999Z`)))
    .pipe(z.date("Enter a valid date.").nullable()),
});

export async function createCouponAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(async () => {
    const user = await actionInstructor();
    const input = parse(couponSchema, { maxRedemptions: "", expiresAt: "", ...formValues(formData) });
    const course = await manageableCourse(user, input.courseId);

    if (input.expiresAt && input.expiresAt.getTime() <= Date.now()) {
      throw new ActionError("The expiry date must be in the future.", { expiresAt: ["Choose a date in the future."] });
    }
    const count = await db.coupon.count({ where: { courseId: course.id } });
    if (count >= 100) throw new ActionError("A course can have at most 100 coupons.");
    const existing = await db.coupon.findUnique({
      where: { courseId_code: { courseId: course.id, code: input.code } },
      select: { id: true },
    });
    if (existing) {
      throw new ActionError("This course already has a coupon with that code.", { code: ["That code is already in use."] });
    }

    await db.coupon.create({
      data: {
        courseId: course.id,
        code: input.code,
        percentOff: input.percentOff,
        maxRedemptions: input.maxRedemptions,
        expiresAt: input.expiresAt,
      },
    });
    refresh();
    return ok(`Coupon ${input.code} created.`);
  });
}

async function editableCoupon(user: SessionUser, couponId: string) {
  const coupon = await db.coupon.findUnique({
    where: { id: parse(idSchema, couponId) },
    select: { id: true, courseId: true, redemptionCount: true },
  });
  if (!coupon) throw new ActionError("That coupon no longer exists.");
  await manageableCourse(user, coupon.courseId);
  return coupon;
}

export async function setCouponActiveAction(couponId: string, isActive: boolean): Promise<ActionResult> {
  return run(async () => {
    const user = await actionInstructor();
    const coupon = await editableCoupon(user, couponId);
    await db.coupon.update({ where: { id: coupon.id }, data: { isActive: isActive === true } });
    refresh();
    return ok(isActive ? "Coupon enabled." : "Coupon disabled.");
  });
}

export async function deleteCouponAction(couponId: string): Promise<ActionResult> {
  return run(async () => {
    const user = await actionInstructor();
    const coupon = await editableCoupon(user, couponId);
    await db.coupon.delete({ where: { id: coupon.id } });
    refresh();
    return ok("Coupon deleted.");
  });
}

// ───────────────────────── Announcements ─────────────────────────

const announcementSchema = z.object({
  courseId: idSchema,
  title: text("Title", 3, 160),
  body: text("Message", 1, 10_000),
});

export async function postAnnouncementAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(async () => {
    const user = await actionInstructor();
    const input = parse(announcementSchema, formValues(formData));
    const course = await manageableCourse(user, input.courseId);

    await db.announcement.create({
      data: { courseId: course.id, authorId: user.id, title: input.title, body: input.body },
    });
    const students = await db.enrollment.findMany({
      where: { courseId: course.id, revokedAt: null },
      select: { userId: true },
      take: 10_000,
    });
    await notify(
      students.map((s) => ({
        userId: s.userId,
        title: `New announcement in ${course.title}`,
        body: input.title,
        href: `/learn/${course.slug}?tab=announcements`,
      })),
    );
    refresh();
    return ok(`Announcement posted to ${students.length} student${students.length === 1 ? "" : "s"}.`);
  });
}

export async function deleteAnnouncementAction(announcementId: string): Promise<ActionResult> {
  return run(async () => {
    const user = await actionInstructor();
    const announcement = await db.announcement.findUnique({
      where: { id: parse(idSchema, announcementId) },
      select: { id: true, courseId: true },
    });
    if (!announcement) return ok();
    await manageableCourse(user, announcement.courseId);
    await db.announcement.delete({ where: { id: announcement.id } });
    refresh();
    return ok("Announcement deleted.");
  });
}

/** Public link to a course with a coupon applied, for the instructor to share. */
export async function couponLinkAction(couponId: string): Promise<ActionResult<{ path: string }>> {
  return run(async () => {
    const user = await actionInstructor();
    const coupon = await db.coupon.findUnique({
      where: { id: parse(idSchema, couponId) },
      select: { code: true, course: { select: { id: true, slug: true } } },
    });
    if (!coupon) throw new ActionError("That coupon no longer exists.");
    await manageableCourse(user, coupon.course.id);
    return ok(undefined, { path: `${courseUrl(coupon.course.slug)}?coupon=${coupon.code}` });
  });
}
