import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { CourseLevel, LectureType } from "@/generated/prisma/enums";
import { firstParam, pageParam } from "@/lib/utils";
import { readQuiz } from "./quiz";

// ───────────────────────── Course cards and catalog search ─────────────────────────

export const courseCardSelect = {
  id: true,
  slug: true,
  title: true,
  subtitle: true,
  priceCents: true,
  ratingAvg: true,
  ratingCount: true,
  enrollmentCount: true,
  durationSec: true,
  lectureCount: true,
  level: true,
  thumbnailAssetId: true,
  publishedAt: true,
  instructor: { select: { id: true, name: true } },
  category: { select: { name: true, slug: true } },
} satisfies Prisma.CourseSelect;

export type CourseCardData = Prisma.CourseGetPayload<{ select: typeof courseCardSelect }>;

export const SORT_OPTIONS = {
  popular: "Most popular",
  rating: "Highest rated",
  newest: "Newest",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
} as const;
export type SortKey = keyof typeof SORT_OPTIONS;

const LEVEL_VALUES: CourseLevel[] = ["ALL_LEVELS", "BEGINNER", "INTERMEDIATE", "ADVANCED"];

export type CatalogFilters = {
  q: string;
  category: string;
  level: CourseLevel | "";
  price: "free" | "paid" | "";
  rating: number;
  sort: SortKey;
  page: number;
};

/** Normalise raw URL search params into safe catalog filters. */
export function parseCatalogParams(sp: Record<string, string | string[] | undefined>): CatalogFilters {
  const level = firstParam(sp.level)?.toUpperCase() ?? "";
  const price = firstParam(sp.price) ?? "";
  const rating = Number(firstParam(sp.rating));
  const sort = firstParam(sp.sort) ?? "";
  return {
    q: (firstParam(sp.q) ?? "").trim().slice(0, 100),
    category: (firstParam(sp.category) ?? "").slice(0, 80),
    level: (LEVEL_VALUES as string[]).includes(level) ? (level as CourseLevel) : "",
    price: price === "free" || price === "paid" ? price : "",
    rating: [3, 3.5, 4, 4.5].includes(rating) ? rating : 0,
    sort: sort in SORT_OPTIONS ? (sort as SortKey) : "popular",
    page: pageParam(sp.page),
  };
}

function orderBy(sort: SortKey): Prisma.CourseOrderByWithRelationInput[] {
  switch (sort) {
    case "rating":
      return [{ ratingAvg: "desc" }, { ratingCount: "desc" }, { id: "asc" }];
    case "newest":
      return [{ publishedAt: "desc" }, { id: "asc" }];
    case "price-asc":
      return [{ priceCents: "asc" }, { enrollmentCount: "desc" }, { id: "asc" }];
    case "price-desc":
      return [{ priceCents: "desc" }, { enrollmentCount: "desc" }, { id: "asc" }];
    default:
      return [{ enrollmentCount: "desc" }, { ratingAvg: "desc" }, { id: "asc" }];
  }
}

export function catalogWhere(f: Pick<CatalogFilters, "q" | "category" | "level" | "price" | "rating">): Prisma.CourseWhereInput {
  const terms = f.q.split(/\s+/).filter(Boolean).slice(0, 6);
  return {
    status: "PUBLISHED",
    ...(f.category ? { category: { slug: f.category } } : {}),
    ...(f.level ? { level: f.level } : {}),
    ...(f.price === "free" ? { priceCents: 0 } : f.price === "paid" ? { priceCents: { gt: 0 } } : {}),
    ...(f.rating ? { ratingAvg: { gte: f.rating } } : {}),
    // Every word must match somewhere: title, subtitle, description, instructor or category.
    AND: terms.map((term) => ({
      OR: [
        { title: { contains: term, mode: "insensitive" as const } },
        { subtitle: { contains: term, mode: "insensitive" as const } },
        { description: { contains: term, mode: "insensitive" as const } },
        { instructor: { name: { contains: term, mode: "insensitive" as const } } },
        { category: { name: { contains: term, mode: "insensitive" as const } } },
      ],
    })),
  };
}

export const CATALOG_PAGE_SIZE = 12;

export async function searchCourses(filters: CatalogFilters) {
  const where = catalogWhere(filters);
  const [total, courses] = await Promise.all([
    db.course.count({ where }),
    db.course.findMany({
      where,
      select: courseCardSelect,
      orderBy: orderBy(filters.sort),
      skip: (filters.page - 1) * CATALOG_PAGE_SIZE,
      take: CATALOG_PAGE_SIZE,
    }),
  ]);
  return { courses, total, pageCount: Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE)) };
}

export async function listCourses(sort: SortKey, take: number, where: Prisma.CourseWhereInput = {}) {
  return db.course.findMany({
    where: { status: "PUBLISHED", ...where },
    select: courseCardSelect,
    orderBy: orderBy(sort),
    take,
  });
}

/** Categories with the number of published courses in each. */
export const getCategories = cache(async () => {
  const rows = await db.category.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      _count: { select: { courses: { where: { status: "PUBLISHED" } } } },
    },
  });
  return rows.map(({ _count, ...c }) => ({ ...c, courseCount: _count.courses }));
});

// ───────────────────────── Curriculum ─────────────────────────

export type CurriculumLecture = {
  id: string;
  title: string;
  type: LectureType;
  durationSec: number;
  isPreview: boolean;
  isReady: boolean;
  questionCount: number;
};

export type CurriculumSection = {
  id: string;
  title: string;
  lectures: CurriculumLecture[];
};

/**
 * A course outline in display order. With `readyOnly`, lectures without
 * content and sections left empty by that are dropped (the student view).
 */
export async function getCurriculum(courseId: string, opts: { readyOnly: boolean }): Promise<CurriculumSection[]> {
  const sections = await db.section.findMany({
    where: { courseId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      lectures: {
        where: opts.readyOnly ? { isReady: true } : undefined,
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: { id: true, title: true, type: true, durationSec: true, isPreview: true, isReady: true, quiz: true },
      },
    },
  });
  return sections
    .map((s) => ({
      id: s.id,
      title: s.title,
      lectures: s.lectures.map(({ quiz, ...l }) => ({
        ...l,
        questionCount: l.type === "QUIZ" ? (readQuiz(quiz)?.questions.length ?? 0) : 0,
      })),
    }))
    .filter((s) => !opts.readyOnly || s.lectures.length > 0);
}

/** All lectures of an outline, flattened in learning order. */
export function flattenCurriculum(sections: CurriculumSection[]): CurriculumLecture[] {
  return sections.flatMap((s) => s.lectures);
}
