// What a course needs before it can be published. Pure, so the studio can
// show the list and the submit action can enforce exactly the same rules.

export type ChecklistInput = {
  title: string;
  subtitle: string;
  description: string;
  categoryId: string | null;
  outcomes: string[];
  readyLectureCount: number;
};

export type ChecklistItem = {
  id: string;
  label: string;
  detail: string;
  done: boolean;
  /** Studio tab where this can be fixed. */
  tab: "details" | "goals" | "curriculum";
};

export const MIN_DESCRIPTION_LENGTH = 100;
export const MIN_OUTCOMES = 2;

export function publishChecklist(course: ChecklistInput): ChecklistItem[] {
  return [
    {
      id: "title",
      label: "Title and subtitle",
      detail: "A clear title, plus a one-line subtitle that says what the course delivers.",
      done: course.title.trim().length >= 5 && course.subtitle.trim().length >= 10,
      tab: "details",
    },
    {
      id: "description",
      label: "Description",
      detail: `At least ${MIN_DESCRIPTION_LENGTH} characters explaining what the course covers.`,
      done: course.description.trim().length >= MIN_DESCRIPTION_LENGTH,
      tab: "details",
    },
    {
      id: "category",
      label: "Category",
      detail: "Pick the category learners would expect to find it in.",
      done: !!course.categoryId,
      tab: "details",
    },
    {
      id: "outcomes",
      label: "Learning outcomes",
      detail: `At least ${MIN_OUTCOMES} things students will be able to do afterwards.`,
      done: course.outcomes.filter((o) => o.trim()).length >= MIN_OUTCOMES,
      tab: "goals",
    },
    {
      id: "content",
      label: "Course content",
      detail: "At least one lecture with content (a video, an article, a document or a quiz).",
      done: course.readyLectureCount >= 1,
      tab: "curriculum",
    },
  ];
}

export function isPublishable(course: ChecklistInput): boolean {
  return publishChecklist(course).every((item) => item.done);
}
