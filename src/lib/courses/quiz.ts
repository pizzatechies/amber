import { z } from "zod";

// A quiz is stored as JSON on its lecture (Lecture.quiz).

export const quizSchema = z.object({
  questions: z
    .array(
      z
        .object({
          id: z.string().min(1).max(40),
          prompt: z.string().trim().min(1, "Every question needs a prompt.").max(1000),
          options: z
            .array(
              z.object({
                id: z.string().min(1).max(40),
                text: z.string().trim().min(1, "Answer options can't be empty.").max(500),
              }),
            )
            .min(2, "Every question needs at least two answer options.")
            .max(8, "A question can have at most eight answer options."),
          /** Ids of the correct option(s). More than one makes it a multi-select question. */
          correct: z.array(z.string()).min(1, "Mark at least one correct answer for every question."),
          explanation: z.string().trim().max(2000).default(""),
        })
        .superRefine((q, ctx) => {
          const ids = new Set(q.options.map((o) => o.id));
          if (ids.size !== q.options.length) {
            ctx.addIssue({ code: "custom", message: "Answer options must be unique." });
          }
          if (q.correct.some((id) => !ids.has(id)) || new Set(q.correct).size !== q.correct.length) {
            ctx.addIssue({ code: "custom", message: "A correct answer doesn't match any option." });
          }
        }),
    )
    .max(50, "A quiz can have at most 50 questions."),
});

export type Quiz = z.infer<typeof quizSchema>;
export type QuizQuestion = Quiz["questions"][number];

/** Read a stored quiz defensively; anything malformed counts as "no quiz". */
export function readQuiz(value: unknown): Quiz | null {
  const parsed = quizSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export type PublicQuiz = {
  questions: Array<{ id: string; prompt: string; multiple: boolean; options: Array<{ id: string; text: string }> }>;
};

/** The quiz as shown to a learner before answering: no answers, no explanations. */
export function toPublicQuiz(quiz: Quiz): PublicQuiz {
  return {
    questions: quiz.questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      multiple: q.correct.length > 1,
      options: q.options.map((o) => ({ id: o.id, text: o.text })),
    })),
  };
}

export type QuizAnswers = Record<string, string[]>;

export type QuizResult = {
  correct: number;
  total: number;
  questions: Record<string, { isCorrect: boolean; correct: string[]; explanation: string }>;
};

/** A question is correct only when the chosen set equals the correct set exactly. */
export function gradeQuiz(quiz: Quiz, answers: QuizAnswers): QuizResult {
  const questions: QuizResult["questions"] = {};
  let correct = 0;
  for (const q of quiz.questions) {
    const chosen = new Set(answers[q.id] ?? []);
    const isCorrect = chosen.size === q.correct.length && q.correct.every((id) => chosen.has(id));
    if (isCorrect) correct++;
    questions[q.id] = { isCorrect, correct: q.correct, explanation: q.explanation };
  }
  return { correct, total: quiz.questions.length, questions };
}
