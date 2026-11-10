"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { ActionError, actionUser, formValues, ok, parse, run, type ActionResult, type FormState } from "@/lib/action";
import type { SessionUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/auth/rate-limit";
import { setLectureCompletion, type CompletionOutcome } from "@/lib/courses/progress";
import { gradeQuiz, readQuiz, type QuizResult } from "@/lib/courses/quiz";
import { refreshCourseRating } from "@/lib/courses/stats";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { learnUrl } from "@/lib/urls";
import { idSchema, text } from "@/lib/validation";

/** What a user may do in a course: learn it (enrolled) and/or manage it (instructor, admin). */
async function courseRole(user: SessionUser, courseId: string) {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, slug: true, title: true, instructorId: true },
  });
  if (!course) throw new ActionError("That course doesn't exist.");
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
    select: { revokedAt: true },
  });
  const isEnrolled = !!enrollment && enrollment.revokedAt === null;
  const canManage = user.role === "ADMIN" || course.instructorId === user.id;
  if (!isEnrolled && !canManage) throw new ActionError("You need to be enrolled in this course to do that.");
  return { course, isEnrolled, canManage };
}

async function learnableLecture(user: SessionUser, lectureId: string) {
  const lecture = await db.lecture.findUnique({
    where: { id: parse(idSchema, lectureId) },
    select: { id: true, courseId: true, type: true, quiz: true, title: true },
  });
  if (!lecture) throw new ActionError("That lecture doesn't exist.");
  return { lecture, ...(await courseRole(user, lecture.courseId)) };
}

function limitWrites(user: SessionUser): void {
  const limit = rateLimit(`post:${user.id}`, 30, 10 * 60 * 1000);
  if (!limit.ok) throw new ActionError("You're posting very quickly. Please wait a few minutes.");
}

// ───────────────────────── Progress ─────────────────────────

export async function setLectureCompleteAction(
  lectureId: string,
  completed: boolean,
): Promise<ActionResult<CompletionOutcome>> {
  return run(async () => {
    const user = await actionUser();
    const { lecture } = await learnableLecture(user, lectureId);
    const outcome = await setLectureCompletion(user.id, lecture, completed === true);
    refresh();
    return ok(undefined, outcome);
  });
}

const answersSchema = z.record(z.string().max(40), z.array(z.string().max(40)).max(8));

export async function submitQuizAction(
  lectureId: string,
  answers: Record<string, string[]>,
): Promise<ActionResult<{ result: QuizResult; outcome: CompletionOutcome }>> {
  return run(async () => {
    const user = await actionUser();
    const { lecture } = await learnableLecture(user, lectureId);
    const quiz = lecture.type === "QUIZ" ? readQuiz(lecture.quiz) : null;
    if (!quiz) throw new ActionError("This lecture has no quiz.");

    const given = parse(answersSchema, answers);
    const result = gradeQuiz(quiz, given);
    await db.quizAttempt.create({
      data: { userId: user.id, lectureId: lecture.id, correct: result.correct, total: result.total, answers: given },
    });
    // Finishing a quiz completes the lecture whatever the score; learners can retry freely.
    const outcome = await setLectureCompletion(user.id, lecture, true);
    refresh();
    return ok(undefined, { result, outcome });
  });
}

// ───────────────────────── Reviews ─────────────────────────

const reviewSchema = z.object({
  courseId: idSchema,
  rating: z.coerce.number().int().min(1, "Choose a rating from 1 to 5 stars.").max(5),
  comment: text("Your review", 0, 2000),
});

export async function saveReviewAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(async () => {
    const user = await actionUser();
    const input = parse(reviewSchema, formValues(formData));
    const { course, isEnrolled } = await courseRole(user, input.courseId);
    if (!isEnrolled) throw new ActionError("Only enrolled students can review a course.");
    limitWrites(user);

    const key = { userId_courseId: { userId: user.id, courseId: course.id } };
    const existing = await db.review.findUnique({ where: key, select: { id: true } });
    await db.review.upsert({
      where: key,
      create: { userId: user.id, courseId: course.id, rating: input.rating, comment: input.comment },
      update: { rating: input.rating, comment: input.comment },
    });
    await refreshCourseRating(course.id);
    if (!existing) {
      await notify({
        userId: course.instructorId,
        title: `New ${input.rating}-star review`,
        body: `${user.name} reviewed ${course.title}`,
        href: "/instructor/reviews",
      });
    }
    refresh();
    return ok(existing ? "Your review was updated." : "Thanks for your review!");
  });
}

export async function deleteReviewAction(courseId: string): Promise<ActionResult> {
  return run(async () => {
    const user = await actionUser();
    const id = parse(idSchema, courseId);
    await db.review.deleteMany({ where: { userId: user.id, courseId: id } });
    await refreshCourseRating(id);
    refresh();
    return ok("Your review was removed.");
  });
}

const replySchema = z.object({ reviewId: idSchema, reply: text("Your reply", 0, 2000) });

/** The course instructor's public reply to a review. An empty reply removes it. */
export async function replyToReviewAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(async () => {
    const user = await actionUser();
    const input = parse(replySchema, formValues(formData));
    const review = await db.review.findUnique({
      where: { id: input.reviewId },
      select: { id: true, userId: true, course: { select: { id: true, slug: true, title: true, instructorId: true } } },
    });
    if (!review || (user.role !== "ADMIN" && review.course.instructorId !== user.id)) {
      throw new ActionError("That review doesn't exist or isn't on one of your courses.");
    }
    await db.review.update({
      where: { id: review.id },
      data: { reply: input.reply, repliedAt: input.reply ? new Date() : null },
    });
    if (input.reply) {
      await notify({
        userId: review.userId,
        title: "The instructor replied to your review",
        body: review.course.title,
        href: `/courses/${review.course.slug}#reviews`,
      });
    }
    refresh();
    return ok(input.reply ? "Reply posted." : "Reply removed.");
  });
}

// ───────────────────────── Questions and answers ─────────────────────────

const questionSchema = z.object({
  courseId: idSchema,
  lectureId: z.string().max(64).optional(),
  title: text("Your question", 5, 160),
  body: text("Details", 0, 4000),
});

export async function askQuestionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(async () => {
    const user = await actionUser();
    const input = parse(questionSchema, formValues(formData));
    const { course } = await courseRole(user, input.courseId);
    limitWrites(user);

    const lecture = input.lectureId
      ? await db.lecture.findFirst({ where: { id: input.lectureId, courseId: course.id }, select: { id: true } })
      : null;
    await db.question.create({
      data: { courseId: course.id, lectureId: lecture?.id, userId: user.id, title: input.title, body: input.body },
    });
    if (course.instructorId !== user.id) {
      await notify({
        userId: course.instructorId,
        title: "New question in your course",
        body: input.title,
        href: "/instructor/questions",
      });
    }
    refresh();
    return ok("Your question was posted.");
  });
}

const answerSchema = z.object({ questionId: idSchema, body: text("Your answer", 1, 4000) });

export async function answerQuestionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(async () => {
    const user = await actionUser();
    const input = parse(answerSchema, formValues(formData));
    const question = await db.question.findUnique({
      where: { id: input.questionId },
      select: { id: true, userId: true, title: true, courseId: true, lectureId: true },
    });
    if (!question) throw new ActionError("That question doesn't exist.");
    const { course } = await courseRole(user, question.courseId);
    limitWrites(user);

    await db.answer.create({ data: { questionId: question.id, userId: user.id, body: input.body } });
    await db.question.update({ where: { id: question.id }, data: { updatedAt: new Date() } });

    const recipients = new Set([question.userId, course.instructorId]);
    recipients.delete(user.id);
    await notify(
      [...recipients].map((userId) => ({
        userId,
        title: userId === question.userId ? "Your question has a new answer" : "New answer in your course",
        body: question.title,
        href:
          userId === course.instructorId
            ? "/instructor/questions"
            : `${learnUrl(course.slug, question.lectureId ?? undefined)}?tab=qa`,
      })),
    );
    refresh();
    return ok("Your answer was posted.");
  });
}

export async function setQuestionResolvedAction(questionId: string, resolved: boolean): Promise<ActionResult> {
  return run(async () => {
    const user = await actionUser();
    const question = await db.question.findUnique({
      where: { id: parse(idSchema, questionId) },
      select: { id: true, userId: true, course: { select: { instructorId: true } } },
    });
    const allowed =
      question && (question.userId === user.id || question.course.instructorId === user.id || user.role === "ADMIN");
    if (!allowed) throw new ActionError("Only the asker or the instructor can do that.");
    await db.question.update({ where: { id: question.id }, data: { isResolved: resolved === true } });
    refresh();
    return ok();
  });
}

export async function deleteQuestionAction(questionId: string): Promise<ActionResult> {
  return run(async () => {
    const user = await actionUser();
    const question = await db.question.findUnique({
      where: { id: parse(idSchema, questionId) },
      select: { id: true, userId: true, course: { select: { instructorId: true } } },
    });
    const allowed =
      question && (question.userId === user.id || question.course.instructorId === user.id || user.role === "ADMIN");
    if (!allowed) throw new ActionError("You can't delete that question.");
    await db.question.delete({ where: { id: question.id } });
    refresh();
    return ok("Question deleted.");
  });
}

export async function deleteAnswerAction(answerId: string): Promise<ActionResult> {
  return run(async () => {
    const user = await actionUser();
    const answer = await db.answer.findUnique({
      where: { id: parse(idSchema, answerId) },
      select: { id: true, userId: true, question: { select: { course: { select: { instructorId: true } } } } },
    });
    const allowed =
      answer && (answer.userId === user.id || answer.question.course.instructorId === user.id || user.role === "ADMIN");
    if (!allowed) throw new ActionError("You can't delete that answer.");
    await db.answer.delete({ where: { id: answer.id } });
    refresh();
    return ok("Answer deleted.");
  });
}

// ───────────────────────── Notes ─────────────────────────

const noteSchema = z.object({
  lectureId: idSchema,
  positionSec: z.coerce.number().int().min(0).max(60 * 60 * 24).catch(0),
  body: text("Your note", 1, 4000),
});

export async function saveNoteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(async () => {
    const user = await actionUser();
    const input = parse(noteSchema, formValues(formData));
    const { lecture } = await learnableLecture(user, input.lectureId);
    const count = await db.note.count({ where: { userId: user.id, courseId: lecture.courseId } });
    if (count >= 500) throw new ActionError("You've reached the limit of 500 notes for this course.");

    await db.note.create({
      data: {
        userId: user.id,
        courseId: lecture.courseId,
        lectureId: lecture.id,
        positionSec: lecture.type === "VIDEO" ? input.positionSec : 0,
        body: input.body,
      },
    });
    refresh();
    return ok("Note saved.");
  });
}

export async function deleteNoteAction(noteId: string): Promise<ActionResult> {
  return run(async () => {
    const user = await actionUser();
    await db.note.deleteMany({ where: { id: parse(idSchema, noteId), userId: user.id } });
    refresh();
    return ok();
  });
}

// ───────────────────────── Notifications ─────────────────────────

export async function markNotificationsReadAction(): Promise<ActionResult> {
  return run(async () => {
    const user = await actionUser();
    const updated = await db.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    if (updated.count > 0) refresh();
    return ok();
  });
}
