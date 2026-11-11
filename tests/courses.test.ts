import { describe, expect, it } from "vitest";
import { isPublishable, publishChecklist, type ChecklistInput } from "@/lib/courses/checklist";
import { percentOf } from "@/lib/courses/progress-math";
import { gradeQuiz, quizSchema, readQuiz, toPublicQuiz, type Quiz } from "@/lib/courses/quiz";
import { embedUrl, readingTimeSec } from "@/lib/courses/video";

const quiz: Quiz = {
  questions: [
    { id: "q1", prompt: "2 + 2?", options: [{ id: "a", text: "3" }, { id: "b", text: "4" }], correct: ["b"], explanation: "Basic sums." },
    {
      id: "q2",
      prompt: "Pick the even numbers",
      options: [{ id: "a", text: "2" }, { id: "b", text: "3" }, { id: "c", text: "4" }],
      correct: ["a", "c"],
      explanation: "",
    },
  ],
};

describe("quiz", () => {
  it("grades single and multiple choice questions", () => {
    const result = gradeQuiz(quiz, { q1: ["b"], q2: ["c", "a"] });
    expect(result.correct).toBe(2);
    expect(result.total).toBe(2);
    expect(result.questions.q1).toEqual({ isCorrect: true, correct: ["b"], explanation: "Basic sums." });
  });

  it("needs the exact set for multiple choice", () => {
    expect(gradeQuiz(quiz, { q1: ["b"], q2: ["a"] }).correct).toBe(1);
    expect(gradeQuiz(quiz, { q1: ["b"], q2: ["a", "b", "c"] }).correct).toBe(1);
    expect(gradeQuiz(quiz, {}).correct).toBe(0);
  });

  it("hides answers from learners", () => {
    const view = toPublicQuiz(quiz);
    expect(JSON.stringify(view)).not.toContain("correct");
    expect(JSON.stringify(view)).not.toContain("Basic sums");
    expect(view.questions.map((q) => q.multiple)).toEqual([false, true]);
  });

  it("rejects malformed quizzes", () => {
    expect(readQuiz(null)).toBeNull();
    expect(readQuiz({ questions: "nope" })).toBeNull();
    const noCorrect = { questions: [{ ...quiz.questions[0]!, correct: [] }] };
    expect(quizSchema.safeParse(noCorrect).success).toBe(false);
    const unknownCorrect = { questions: [{ ...quiz.questions[0]!, correct: ["zzz"] }] };
    expect(quizSchema.safeParse(unknownCorrect).success).toBe(false);
    const oneOption = { questions: [{ ...quiz.questions[0]!, options: [{ id: "b", text: "4" }] }] };
    expect(quizSchema.safeParse(oneOption).success).toBe(false);
  });
});

describe("external videos", () => {
  it("converts YouTube and Vimeo links to embeds", () => {
    expect(embedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0");
    expect(embedUrl("https://youtu.be/dQw4w9WgXcQ?t=10")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0");
    expect(embedUrl("https://vimeo.com/123456789")).toBe("https://player.vimeo.com/video/123456789");
  });

  it("refuses anything else", () => {
    expect(embedUrl("https://evil.example/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(embedUrl("javascript:alert(1)")).toBeNull();
    expect(embedUrl("not a url")).toBeNull();
    expect(embedUrl("https://www.youtube.com/watch?v=short")).toBeNull();
  });

  it("estimates reading time", () => {
    expect(readingTimeSec("")).toBe(0);
    expect(readingTimeSec("a few words")).toBe(60);
    expect(readingTimeSec("word ".repeat(450))).toBe(180);
  });
});

describe("publishing checklist", () => {
  const ready: ChecklistInput = {
    title: "Sourdough Basics",
    subtitle: "Bake a reliable loaf at home.",
    description: "x".repeat(120),
    categoryId: "cat",
    outcomes: ["Make a starter", "Bake a loaf"],
    readyLectureCount: 1,
  };

  it("passes a complete course", () => {
    expect(isPublishable(ready)).toBe(true);
  });

  it("flags each missing piece", () => {
    const missing = (over: Partial<ChecklistInput>) =>
      publishChecklist({ ...ready, ...over }).filter((i) => !i.done).map((i) => i.id);
    expect(missing({ subtitle: "" })).toEqual(["title"]);
    expect(missing({ description: "too short" })).toEqual(["description"]);
    expect(missing({ categoryId: null })).toEqual(["category"]);
    expect(missing({ outcomes: ["one", "  "] })).toEqual(["outcomes"]);
    expect(missing({ readyLectureCount: 0 })).toEqual(["content"]);
  });
});

describe("progress", () => {
  it("computes a whole-number percentage", () => {
    expect(percentOf(0, 0)).toBe(0);
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(2, 3)).toBe(66);
    expect(percentOf(3, 3)).toBe(100);
    expect(percentOf(5, 3)).toBe(100);
  });
});
