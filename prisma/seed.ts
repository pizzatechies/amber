/**
 * Database seed.
 *
 *   npm run db:seed        Essentials only: categories, default settings and,
 *                          when ADMIN_EMAIL / ADMIN_PASSWORD are set, an admin
 *                          account. Safe to run on every deploy.
 *   npm run db:seed:demo   Essentials plus demo instructors, students, courses,
 *                          sales and reviews for trying the platform out.
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { hashPassword } from "@/lib/auth/password";
import { refreshCourseContentStats, refreshCourseRating, refreshEnrollmentCount } from "@/lib/courses/stats";
import { newCertificateCode } from "@/lib/courses/progress";
import type { Quiz } from "@/lib/courses/quiz";
import { readingTimeSec } from "@/lib/courses/video";
import { db } from "@/lib/db";
import { shareOf } from "@/lib/money";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { site } from "@/lib/site";
import { storage } from "@/lib/storage";
import { slugify } from "@/lib/utils";
import { demoCourses, demoPeople, reviewComments, type DemoCourse } from "./seed-data";

const DAY = 24 * 60 * 60 * 1000;
export const DEMO_PASSWORD = "amber-demo-1234";

const CATEGORIES = [
  ["Development", "Programming, web, mobile and software engineering."],
  ["Data Science", "Analysis, SQL, statistics and machine learning."],
  ["Design", "Visual, product and interaction design."],
  ["Business", "Entrepreneurship, finance, management and strategy."],
  ["Marketing", "Reaching customers and growing an audience."],
  ["Photography & Video", "Shooting, editing and visual storytelling."],
  ["Music", "Instruments, production and theory."],
  ["Health & Fitness", "Training, nutrition and wellbeing."],
  ["Languages", "Learning to speak, read and write new languages."],
  ["Personal Development", "Communication, productivity and career skills."],
] as const;

async function seedEssentials() {
  for (const [i, [name, description]] of CATEGORIES.entries()) {
    await db.category.upsert({
      where: { slug: slugify(name) },
      create: { name, slug: slugify(name), description, position: i },
      update: {},
    });
  }
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.setting.upsert({ where: { key }, create: { key, value }, update: {} });
  }

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    const existing = await db.user.findUnique({ where: { email }, select: { id: true, role: true } });
    if (!existing) {
      await db.user.create({
        data: { email, name: "Administrator", role: "ADMIN", passwordHash: await hashPassword(password) },
      });
      console.log(`✔ Created admin account ${email}`);
    } else if (existing.role !== "ADMIN") {
      await db.user.update({ where: { id: existing.id }, data: { role: "ADMIN" } });
      console.log(`✔ Promoted ${email} to admin`);
    }
  }
  console.log("✔ Categories and settings are in place");
}

// Small deterministic PRNG so the demo data is the same on every run.
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CLIPS = { a: 30, b: 45, c: 60 } as const;
type Clip = keyof typeof CLIPS;

async function storeFile(ownerId: string, kind: "VIDEO" | "FILE", filename: string, mimeType: string, data: Buffer, durationSec = 0) {
  const ext = filename.slice(filename.lastIndexOf(".") + 1);
  const storageKey = `${kind.toLowerCase()}/${randomUUID()}.${ext}`;
  await storage().put(storageKey, data, mimeType);
  return db.asset.create({
    data: {
      ownerId,
      kind,
      status: "READY",
      storageKey,
      filename,
      mimeType,
      sizeBytes: BigInt(data.length),
      uploadedBytes: BigInt(data.length),
      durationSec,
    },
    select: { id: true },
  });
}

async function workbookPdf(title: string, points: string[]): Promise<Buffer> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawRectangle({ x: 0, y: 742, width: 595, height: 100, color: rgb(0.95, 0.64, 0.11) });
  page.drawText("Course workbook", { x: 48, y: 800, size: 12, font: bold, color: rgb(0.11, 0.1, 0.09) });
  page.drawText(title.slice(0, 60), { x: 48, y: 768, size: 20, font: bold, color: rgb(0.11, 0.1, 0.09) });
  let y = 690;
  page.drawText("Use this page to check off what you can now do:", { x: 48, y, size: 12, font: regular });
  for (const point of points) {
    y -= 34;
    page.drawRectangle({ x: 48, y: y - 2, width: 12, height: 12, borderColor: rgb(0.3, 0.3, 0.3), borderWidth: 1 });
    page.drawText(point.slice(0, 80), { x: 72, y, size: 11, font: regular });
  }
  return Buffer.from(await pdf.save());
}

async function createCourse(
  c: DemoCourse,
  ids: { instructorId: string; categoryId: string },
  clips: Record<Clip, Buffer>,
  now: number,
) {
  const status = c.status ?? "PUBLISHED";
  const publishedAt = status === "PUBLISHED" ? new Date(now - (c.publishedDaysAgo ?? 30) * DAY) : null;
  const course = await db.course.create({
    data: {
      slug: slugify(c.title),
      title: c.title,
      subtitle: c.subtitle,
      description: c.description,
      level: c.level,
      language: "English",
      categoryId: ids.categoryId,
      instructorId: ids.instructorId,
      priceCents: Math.round(c.price * 100),
      outcomes: c.outcomes,
      requirements: c.requirements,
      audience: c.audience,
      status,
      submittedAt: status === "IN_REVIEW" ? new Date(now - 2 * DAY) : publishedAt,
      publishedAt,
      createdAt: new Date(now - ((c.publishedDaysAgo ?? 30) + 10) * DAY),
    },
    select: { id: true },
  });

  const clipOrder: Clip[] = ["a", "b", "c"];
  let videoIndex = 0;
  let firstVideo = true;

  for (const [si, s] of c.sections.entries()) {
    const section = await db.section.create({
      data: { courseId: course.id, title: s.title, position: si },
      select: { id: true },
    });

    for (const [li, l] of s.lectures.entries()) {
      const base = { courseId: course.id, sectionId: section.id, title: l.title, position: li };

      if (l.kind === "article") {
        await db.lecture.create({
          data: { ...base, type: "ARTICLE", content: l.body, durationSec: readingTimeSec(l.body), isReady: true },
        });
      } else if (l.kind === "quiz") {
        const quiz: Quiz = {
          questions: l.questions.map((q, qi) => ({
            id: `q${qi + 1}`,
            prompt: q.prompt,
            options: q.options.map((text, oi) => ({ id: `o${oi + 1}`, text })),
            correct: q.correct.map((i) => `o${i + 1}`),
            explanation: q.explanation ?? "",
          })),
        };
        await db.lecture.create({ data: { ...base, type: "QUIZ", quiz, isReady: true } });
      } else if (l.kind === "document") {
        const pdf = await workbookPdf(c.title, c.outcomes);
        const asset = await storeFile(ids.instructorId, "FILE", "course-workbook.pdf", "application/pdf", pdf);
        await db.lecture.create({ data: { ...base, type: "DOCUMENT", mediaAssetId: asset.id, isReady: true } });
      } else if (l.kind === "empty-video") {
        // A lecture the instructor has not uploaded a video for yet.
        await db.lecture.create({ data: { ...base, type: "VIDEO" } });
      } else {
        const clip = clipOrder[videoIndex++ % clipOrder.length]!;
        const asset = await storeFile(
          ids.instructorId,
          "VIDEO",
          `${slugify(l.title) || "lecture"}.mp4`,
          "video/mp4",
          clips[clip],
          CLIPS[clip],
        );
        const lecture = await db.lecture.create({
          data: {
            ...base,
            type: "VIDEO",
            mediaAssetId: asset.id,
            durationSec: CLIPS[clip],
            // The first video of every course is a free preview.
            isPreview: firstVideo || !!l.preview,
            isReady: true,
            content: l.notes ?? "",
          },
          select: { id: true },
        });
        if (firstVideo) {
          const notes = Buffer.from(
            `# ${c.title}\n\nKey points from "${l.title}":\n\n${c.outcomes.map((o) => `- ${o}`).join("\n")}\n`,
          );
          const res = await storeFile(ids.instructorId, "FILE", "lecture-notes.md", "text/markdown; charset=utf-8", notes);
          await db.lectureResource.create({
            data: { lectureId: lecture.id, title: "Lecture notes", assetId: res.id, position: 0 },
          });
        }
        firstVideo = false;
      }
    }
  }

  await refreshCourseContentStats(course.id);
  return course.id;
}

async function seedDemo() {
  if (await db.user.findUnique({ where: { email: demoPeople.instructors[0]!.email }, select: { id: true } })) {
    console.log("• Demo data is already present, leaving it untouched");
    return;
  }

  const now = Date.now();
  const rand = prng(20261110);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)]!;

  // Hash once and reuse: every demo account shares the same password.
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const admin = await db.user.upsert({
    where: { email: demoPeople.admin.email },
    create: { ...demoPeople.admin, role: "ADMIN", passwordHash },
    update: {},
    select: { id: true },
  });

  const instructors = new Map<string, string>();
  for (const p of demoPeople.instructors) {
    const user = await db.user.create({
      data: { ...p, role: "INSTRUCTOR", passwordHash, createdAt: new Date(now - 200 * DAY) },
      select: { id: true },
    });
    instructors.set(p.email, user.id);
  }

  const students: Array<{ id: string; name: string }> = [];
  for (const [i, p] of demoPeople.students.entries()) {
    students.push(
      await db.user.create({
        data: { ...p, passwordHash, createdAt: new Date(now - (120 - i * 7) * DAY) },
        select: { id: true, name: true },
      }),
    );
  }

  const categories = new Map((await db.category.findMany()).map((c) => [c.name, c.id]));
  const clipDir = path.join(process.cwd(), "prisma", "seed-assets");
  const clips: Record<Clip, Buffer> = {
    a: await readFile(path.join(clipDir, "sample-a.mp4")),
    b: await readFile(path.join(clipDir, "sample-b.mp4")),
    c: await readFile(path.join(clipDir, "sample-c.mp4")),
  };

  type Created = { id: string; def: DemoCourse; instructorId: string };
  const created: Created[] = [];
  for (const def of demoCourses) {
    const instructorId = instructors.get(def.instructor)!;
    const id = await createCourse(def, { instructorId, categoryId: categories.get(def.category)! }, clips, now);
    created.push({ id, def, instructorId });
    console.log(`  + ${def.title}`);
  }
  const published = created.filter((c) => (c.def.status ?? "PUBLISHED") === "PUBLISHED");
  const sharePercent = DEFAULT_SETTINGS.instructorSharePercent;

  // Enrolments, sales, progress and reviews.
  for (const [si, student] of students.entries()) {
    const shuffled = [...published].sort(() => rand() - 0.5);
    const mine = shuffled.slice(0, 3 + Math.floor(rand() * 4));

    for (const course of mine) {
      const daysAgo = 2 + Math.floor(rand() * Math.max(3, (course.def.publishedDaysAgo ?? 30) - 3));
      const when = new Date(now - daysAgo * DAY);
      const priceCents = Math.round(course.def.price * 100);

      if (priceCents > 0) {
        await db.order.create({
          data: {
            userId: student.id,
            status: "PAID",
            currency: site.currency,
            subtotalCents: priceCents,
            totalCents: priceCents,
            provider: "sandbox",
            providerRef: `demo-${randomUUID()}`,
            createdAt: when,
            paidAt: when,
            items: {
              create: {
                courseId: course.id,
                instructorId: course.instructorId,
                title: course.def.title,
                listPriceCents: priceCents,
                priceCents,
                instructorShareCents: shareOf(priceCents, sharePercent),
              },
            },
          },
        });
      }

      const lectures = await db.lecture.findMany({
        where: { courseId: course.id, isReady: true },
        orderBy: [{ section: { position: "asc" } }, { position: "asc" }],
        select: { id: true },
      });
      // The first student finishes everything they start, so certificates have demo data too.
      const doneCount = si === 0 ? lectures.length : Math.floor(rand() * (lectures.length + 1));
      const done = lectures.slice(0, doneCount);
      const finished = doneCount === lectures.length && lectures.length > 0;

      await db.enrollment.create({
        data: {
          userId: student.id,
          courseId: course.id,
          source: priceCents > 0 ? "PURCHASE" : "FREE",
          createdAt: when,
          lastAccessedAt: new Date(when.getTime() + Math.floor(rand() * daysAgo) * DAY),
          lastLectureId: done.at(-1)?.id ?? lectures[0]?.id ?? null,
          completedAt: finished ? new Date(when.getTime() + DAY) : null,
        },
      });
      if (done.length > 0) {
        await db.lectureProgress.createMany({
          data: done.map((l) => ({ userId: student.id, lectureId: l.id, courseId: course.id, completedAt: when })),
        });
      }
      if (finished) {
        const instructor = demoPeople.instructors.find((p) => p.email === course.def.instructor)!;
        await db.certificate.create({
          data: {
            code: newCertificateCode(),
            userId: student.id,
            courseId: course.id,
            recipientName: student.name,
            courseTitle: course.def.title,
            instructorName: instructor.name,
            issuedAt: new Date(when.getTime() + DAY),
          },
        });
      }

      if (doneCount > 0 && rand() < 0.8) {
        const rating = pick([5, 5, 5, 4, 4, 4, 3] as const);
        await db.review.create({
          data: {
            userId: student.id,
            courseId: course.id,
            rating,
            comment: pick(reviewComments[rating]),
            createdAt: new Date(when.getTime() + 2 * DAY),
          },
        });
      }
    }
  }

  for (const course of published) {
    await refreshEnrollmentCount(course.id);
    await refreshCourseRating(course.id);
  }

  // A little activity on the first course: a coupon, an announcement, Q&A and a reply to a review.
  const featured = published[0]!;
  await db.coupon.create({ data: { courseId: featured.id, code: "WELCOME20", percentOff: 20 } });
  await db.announcement.create({
    data: {
      courseId: featured.id,
      authorId: featured.instructorId,
      title: "New practice project added",
      body: "I've added a short practice project at the end of section two. Try it before moving on — it pulls together everything so far.",
      createdAt: new Date(now - 5 * DAY),
    },
  });
  const firstLecture = await db.lecture.findFirst({
    where: { courseId: featured.id, isReady: true },
    orderBy: [{ section: { position: "asc" } }, { position: "asc" }],
    select: { id: true },
  });
  const enrolled = await db.enrollment.findMany({ where: { courseId: featured.id }, select: { userId: true }, take: 2 });
  if (enrolled[0]) {
    const question = await db.question.create({
      data: {
        courseId: featured.id,
        lectureId: firstLecture?.id,
        userId: enrolled[0].userId,
        title: "Do I need to install anything before starting?",
        body: "I'm on an older laptop and want to make sure I can follow along.",
        isResolved: true,
        createdAt: new Date(now - 9 * DAY),
      },
    });
    await db.answer.create({
      data: {
        questionId: question.id,
        userId: featured.instructorId,
        body: "No — a modern browser and any text editor are enough. Everything in the course runs locally and nothing needs a powerful machine.",
        createdAt: new Date(now - 8 * DAY),
      },
    });
  }
  if (enrolled[1]) {
    await db.question.create({
      data: {
        courseId: featured.id,
        userId: enrolled[1].userId,
        title: "Is there a recommended order for the practice exercises?",
        body: "Should I do them as they appear, or finish the videos first?",
        createdAt: new Date(now - 1 * DAY),
      },
    });
  }
  const review = await db.review.findFirst({ where: { courseId: featured.id }, orderBy: { createdAt: "desc" } });
  if (review) {
    await db.review.update({
      where: { id: review.id },
      data: { reply: "Thank you — glad it was useful. Good luck with your first project!", repliedAt: new Date(now - DAY) },
    });
  }

  const pending = created.find((c) => c.def.status === "IN_REVIEW");
  if (pending) {
    await db.notification.create({
      data: {
        userId: admin.id,
        title: "A course is waiting for review",
        body: pending.def.title,
        href: `/admin/courses/${pending.id}`,
      },
    });
  }

  console.log(`✔ Demo data created: ${created.length} courses, ${students.length} students`);
  console.log(`\n  Demo accounts (password for all: ${DEMO_PASSWORD})`);
  console.log(`    Admin       ${demoPeople.admin.email}`);
  console.log(`    Instructor  ${demoPeople.instructors[0]!.email}`);
  console.log(`    Student     ${demoPeople.students[0]!.email}\n`);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  await seedEssentials();
  if (process.argv.includes("--demo")) await seedDemo();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
