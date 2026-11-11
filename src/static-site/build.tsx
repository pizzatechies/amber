/**
 * Builds a read-only static showcase of the platform for GitHub Pages.
 *
 *   DATABASE_URL=... UPLOAD_DIR=... npm run build:static
 *
 * Reads published courses from a database seeded with `npm run db:seed:demo`
 * and writes plain HTML, CSS and the preview videos to ./demo. Everything that
 * needs a server (accounts, purchases, the course player) is pointed at the
 * full app instead.
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PrismaPg } from "@prisma/adapter-pg";
import { BarChart3, Check, ChevronDown, CircleHelp, Clock, ExternalLink, FileText, Globe, Lock, PlayCircle, ScrollText, Search, Users } from "lucide-react";
import { PrismaClient } from "@/generated/prisma/client";
import { CourseCover } from "@/components/course/cover";
import { Markdown } from "@/components/markdown";
import { buttonClass } from "@/components/ui/button";
import { Avatar, Badge, Stars } from "@/components/ui/misc";
import { readQuiz } from "@/lib/courses/quiz";
import { formatCount, formatDate, formatDuration, formatRating, formatTimecode } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import { LEVELS, site } from "@/lib/site";
import { cn, pluralize } from "@/lib/utils";

const OUT = path.resolve(process.env.STATIC_OUT ?? "demo");
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? "storage");
const REPO_URL = process.env.STATIC_REPO_URL ?? "https://github.com/pizzatechies/amber";
const RUN_URL = `${REPO_URL}#quick-start`;
const NEW_DAYS = 21;

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

// ───────────────────────── Data ─────────────────────────

async function loadData() {
  const courses = await db.course.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ enrollmentCount: "desc" }, { ratingAvg: "desc" }],
    select: {
      id: true, slug: true, title: true, subtitle: true, description: true, level: true, language: true,
      priceCents: true, outcomes: true, requirements: true, audience: true, ratingAvg: true, ratingCount: true,
      enrollmentCount: true, lectureCount: true, durationSec: true, publishedAt: true, updatedAt: true,
      category: { select: { name: true, slug: true } },
      instructor: { select: { id: true, name: true, headline: true, bio: true, websiteUrl: true } },
      sections: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          lectures: {
            where: { isReady: true },
            orderBy: [{ position: "asc" }, { createdAt: "asc" }],
            select: { id: true, title: true, type: true, durationSec: true, isPreview: true, quiz: true, media: { select: { storageKey: true, mimeType: true } } },
          },
        },
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        select: { id: true, rating: true, comment: true, reply: true, createdAt: true, user: { select: { name: true } } },
      },
    },
  });
  const categories = await db.category.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }], select: { name: true, slug: true } });
  return { courses, categories };
}

type Data = Awaited<ReturnType<typeof loadData>>;
type Course = Data["courses"][number];

// ───────────────────────── Paths ─────────────────────────

/** Links are relative, so the site works under any base path (e.g. /amber/demo/). */
type Ctx = { root: string };
const href = {
  home: (c: Ctx) => `${c.root}`,
  catalog: (c: Ctx, query = "") => `${c.root}courses/${query}`,
  course: (c: Ctx, slug: string) => `${c.root}courses/${slug}/`,
  instructor: (c: Ctx, id: string) => `${c.root}instructors/${id}/`,
  asset: (c: Ctx, file: string) => `${c.root}assets/${file}`,
  media: (c: Ctx, file: string) => `${c.root}media/${file}`,
};

// Preview videos are copied once per distinct file.
const mediaFiles = new Map<string, string>(); // storageKey -> published file name
async function publishVideo(storageKey: string): Promise<string> {
  const known = mediaFiles.get(storageKey);
  if (known) return known;
  const bytes = await readFile(path.join(UPLOAD_DIR, storageKey));
  const name = `${createHash("sha256").update(bytes).digest("hex").slice(0, 16)}${path.extname(storageKey) || ".mp4"}`;
  await mkdir(path.join(OUT, "media"), { recursive: true });
  await writeFile(path.join(OUT, "media", name), bytes);
  mediaFiles.set(storageKey, name);
  return name;
}

// ───────────────────────── Layout ─────────────────────────

function Document({ ctx, title, description, children, scripts = [] }: { ctx: Ctx; title: string; description?: string; children: ReactNode; scripts?: string[] }) {
  return (
    <html lang="en" className="h-full antialiased">
      {/* A standalone HTML document, not a Next.js page, so a plain <head> is correct here. */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <title>{title === site.name ? `${site.name} — ${site.tagline}` : `${title} · ${site.name}`}</title>
        <meta name="description" content={description ?? site.description} />
        <link rel="stylesheet" href={href.asset(ctx, "site.css")} />
        <link rel="icon" href={href.asset(ctx, "icon.svg")} type="image/svg+xml" />
      </head>
      <body className="flex min-h-full flex-col">
        <div className="bg-info-soft text-sm text-fg">
          <p className="container-page py-2.5 text-center">
            This is a <strong>static preview</strong> of {site.name}. Accounts, purchases and the course player need the full app.{" "}
            <a href={RUN_URL} className="font-bold text-info underline underline-offset-2">
              Run the full app
            </a>
          </p>
        </div>
        <Header ctx={ctx} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer ctx={ctx} />
        {scripts.map((s) => (
          <script key={s} src={href.asset(ctx, s)} defer />
        ))}
      </body>
    </html>
  );
}

function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--brand)" />
      <path d="M16 6.5c.6 4.6 2.6 7 7.5 8.2-4.9 1.2-6.9 3.6-7.5 8.8-.6-5.2-2.6-7.6-7.5-8.8 4.9-1.2 6.9-3.6 7.5-8.2Z" fill="var(--brand-ink)" />
      <circle cx="23.2" cy="23.6" r="1.7" fill="var(--brand-ink)" />
    </svg>
  );
}

function Header({ ctx }: { ctx: Ctx }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="container-page flex h-16 items-center gap-2 sm:gap-4">
        <a href={href.home(ctx)} className="flex shrink-0 items-center gap-2 rounded-lg" aria-label={`${site.name} home`}>
          <LogoMark />
          <span className="font-display text-[1.35rem] leading-none font-semibold">{site.name}</span>
        </a>
        <a href={href.catalog(ctx)} className="hidden rounded-lg px-2.5 py-2 text-sm font-semibold hover:bg-surface-2 md:inline-flex">
          Browse
        </a>
        <form action={href.catalog(ctx)} method="get" role="search" className="hidden max-w-xl flex-1 sm:block">
          <label className="relative block w-full">
            <span className="sr-only">Search courses</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" aria-hidden />
            <input
              type="search"
              name="q"
              placeholder="Search for anything"
              className="h-10 w-full rounded-full border border-line-strong bg-surface pr-4 pl-10 text-sm placeholder:text-subtle focus:border-focus"
            />
          </label>
        </form>
        <div className="ml-auto flex items-center gap-2">
          <a href={href.catalog(ctx)} aria-label="Search courses" className="inline-flex size-10 items-center justify-center rounded-full hover:bg-surface-2 sm:hidden">
            <Search className="size-5" aria-hidden />
          </a>
          <a href={RUN_URL} className={buttonClass({ size: "md" })}>
            Get the full app
          </a>
        </div>
      </div>
    </header>
  );
}

function Footer({ ctx }: { ctx: Ctx }) {
  return (
    <footer className="mt-20 border-t border-line bg-surface">
      <div className="container-page flex flex-col gap-4 py-10 sm:flex-row sm:items-center sm:justify-between">
        <a href={href.home(ctx)} className="flex items-center gap-2">
          <LogoMark />
          <span className="font-display text-xl font-semibold">{site.name}</span>
        </a>
        <p className="max-w-xl text-sm text-muted">
          A static snapshot of the demo catalogue. The courses, people and reviews are sample data.{" "}
          <a href={REPO_URL} className="font-semibold text-brand-text hover:underline">
            Source code
          </a>
        </p>
      </div>
    </footer>
  );
}

// ───────────────────────── Pieces ─────────────────────────

function RatingLine({ avg, count, className }: { avg: number; count: number; className?: string }) {
  if (count === 0) return <p className={cn("text-sm text-subtle", className)}>No ratings yet</p>;
  return (
    <p className={cn("flex items-center gap-1.5 text-sm", className)}>
      <span className="font-bold text-brand-text">{formatRating(avg)}</span>
      <Stars value={avg} size={14} />
      <span className="text-subtle">({formatCount(count)})</span>
    </p>
  );
}

function isNew(course: Course, now: number) {
  return !!course.publishedAt && now - course.publishedAt.getTime() < NEW_DAYS * 86_400_000;
}

function CourseCard({ ctx, course, now }: { ctx: Ctx; course: Course; now: number }) {
  const searchText = [course.title, course.subtitle, course.description, course.instructor.name, course.category?.name ?? ""]
    .join(" ")
    .toLowerCase();
  return (
    <article
      className="group relative flex flex-col"
      data-category={course.category?.slug ?? ""}
      data-level={course.level}
      data-price={course.priceCents}
      data-rating={course.ratingAvg}
      data-reviews={course.ratingCount}
      data-students={course.enrollmentCount}
      data-published={course.publishedAt?.getTime() ?? 0}
      data-text={searchText}
    >
      <div className="relative overflow-hidden rounded-xl border border-line transition-shadow group-hover:shadow-card">
        <CourseCover title={course.title} seed={course.id} />
        {isNew(course, now) ? (
          <Badge tone="brand" className="absolute top-2.5 left-2.5 shadow-sm">
            New
          </Badge>
        ) : null}
      </div>
      <h3 className="mt-3 line-clamp-2 leading-snug font-bold">
        <a href={href.course(ctx, course.slug)} className="after:absolute after:inset-0 group-hover:text-brand-text">
          {course.title}
        </a>
      </h3>
      <p className="mt-1 truncate text-sm text-muted">{course.instructor.name}</p>
      <RatingLine avg={course.ratingAvg} count={course.ratingCount} className="mt-1" />
      <p className="mt-1 text-xs text-subtle">
        {course.durationSec > 0 ? `${formatDuration(course.durationSec)} · ` : ""}
        {pluralize(course.lectureCount, "lecture")} · {LEVELS[course.level]}
      </p>
      <p className="mt-2 font-bold">{formatPrice(course.priceCents)}</p>
    </article>
  );
}

function Grid({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <div id={id} className={cn("grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", className)}>
      {children}
    </div>
  );
}

function SectionHeading({ title, link }: { title: string; link?: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <h2 className="font-display text-2xl font-semibold sm:text-3xl">{title}</h2>
      {link ? (
        <a href={link} className="shrink-0 text-sm font-bold text-brand-text hover:underline">
          See all →
        </a>
      ) : null}
    </div>
  );
}

// ───────────────────────── Pages ─────────────────────────

function HomePage({ ctx, data, now }: { ctx: Ctx; data: Data; now: number }) {
  const popular = data.courses.slice(0, 8);
  const topRated = [...data.courses].filter((c) => c.ratingCount > 0).sort((a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount).slice(0, 4);
  const newest = [...data.courses].sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)).slice(0, 4);
  const used = data.categories
    .map((cat) => ({ ...cat, count: data.courses.filter((c) => c.category?.slug === cat.slug).length }))
    .filter((c) => c.count > 0);

  return (
    <Document ctx={ctx} title={site.name}>
      <section className="border-b border-line bg-surface">
        <div className="container-page grid items-center gap-10 py-14 lg:grid-cols-[1.1fr_1fr] lg:py-20">
          <div>
            <p className="text-sm font-bold tracking-wide text-brand-text uppercase">Online courses</p>
            <h1 className="mt-3 font-display text-4xl leading-[1.08] font-semibold sm:text-5xl lg:text-6xl">{site.tagline}.</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
              Practical courses made by working professionals. Learn at your own pace, keep lifetime access, and earn a certificate when you
              finish.
            </p>
            <form action={href.catalog(ctx)} method="get" role="search" className="mt-8 flex max-w-xl gap-2">
              <label className="relative flex-1">
                <span className="sr-only">Search courses</span>
                <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-subtle" aria-hidden />
                <input
                  type="search"
                  name="q"
                  placeholder="What do you want to learn?"
                  className="h-12 w-full rounded-full border border-line-strong bg-bg pr-4 pl-12 placeholder:text-subtle focus:border-focus"
                />
              </label>
              <button type="submit" className={buttonClass({ size: "lg", className: "rounded-full" })}>
                Search
              </button>
            </form>
          </div>
          <div aria-hidden className="relative mx-auto hidden h-80 w-full max-w-md lg:block">
            <div className="absolute top-2 left-0 w-64 -rotate-6 overflow-hidden rounded-2xl border border-line shadow-pop">
              <CourseCover title="Design" seed="hero-design-3" />
            </div>
            <div className="absolute top-16 right-0 w-64 rotate-3 overflow-hidden rounded-2xl border border-line shadow-pop">
              <CourseCover title="Business" seed="hero-business-12" />
            </div>
            <div className="absolute bottom-0 left-16 w-72 -rotate-1 overflow-hidden rounded-2xl border border-line shadow-pop">
              <CourseCover title="Code" seed="hero-code-5" />
            </div>
          </div>
        </div>
      </section>

      <div className="container-page">
        <section className="pt-12">
          <SectionHeading title="Browse by category" />
          <ul className="flex flex-wrap gap-2.5">
            {used.map((c) => (
              <li key={c.slug}>
                <a
                  href={href.catalog(ctx, `?category=${c.slug}`)}
                  className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-4 py-2 text-sm font-semibold hover:bg-surface-2"
                >
                  {c.name}
                  <span className="text-xs font-normal text-subtle">{c.count}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
        <section className="pt-14">
          <SectionHeading title="Popular right now" link={href.catalog(ctx)} />
          <Grid>
            {popular.map((c) => (
              <CourseCard key={c.id} ctx={ctx} course={c} now={now} />
            ))}
          </Grid>
        </section>
        {topRated.length >= 4 ? (
          <section className="pt-14">
            <SectionHeading title="Highest rated" link={href.catalog(ctx, "?sort=rating")} />
            <Grid>
              {topRated.map((c) => (
                <CourseCard key={c.id} ctx={ctx} course={c} now={now} />
              ))}
            </Grid>
          </section>
        ) : null}
        <section className="pt-14">
          <SectionHeading title="New and noteworthy" link={href.catalog(ctx, "?sort=newest")} />
          <Grid>
            {newest.map((c) => (
              <CourseCard key={c.id} ctx={ctx} course={c} now={now} />
            ))}
          </Grid>
        </section>
      </div>

      <section className="container-page pt-20">
        <div className="relative overflow-hidden rounded-3xl bg-ink px-6 py-12 text-paper sm:px-12">
          <div className="relative z-10 max-w-xl">
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">Know something worth teaching?</h2>
            <p className="mt-3 leading-relaxed text-paper-muted">
              The full app includes an instructor studio for videos, articles, documents and quizzes, with pricing, coupons, students and
              earnings, plus an admin console for reviewing courses.
            </p>
            <a href={RUN_URL} className={buttonClass({ size: "lg", className: "mt-7" })}>
              See how to run it <ExternalLink aria-hidden />
            </a>
          </div>
          <svg aria-hidden viewBox="0 0 300 300" className="absolute -right-10 -bottom-24 hidden h-96 w-96 md:block">
            <circle cx="150" cy="150" r="150" fill="var(--brand)" />
            <circle cx="150" cy="150" r="92" fill="var(--ink)" />
            <circle cx="150" cy="150" r="40" fill="var(--brand)" />
          </svg>
        </div>
      </section>
    </Document>
  );
}

const selectClass = "h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm focus:border-focus";

function CatalogPage({ ctx, data, now }: { ctx: Ctx; data: Data; now: number }) {
  const used = data.categories.filter((cat) => data.courses.some((c) => c.category?.slug === cat.slug));
  return (
    <Document ctx={ctx} title="Browse courses" scripts={["catalog.js"]}>
      <div className="container-page py-10">
        <h1 id="catalog-heading" className="font-display text-3xl font-semibold sm:text-4xl">
          All courses
        </h1>
        <form id="catalog-filters" className="mt-6 grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-q" className="text-xs font-semibold text-muted">
              Search
            </label>
            <input id="filter-q" name="q" type="search" placeholder="Title, topic or instructor" className={selectClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-category" className="text-xs font-semibold text-muted">
              Category
            </label>
            <select id="filter-category" name="category" className={selectClass}>
              <option value="">All categories</option>
              {used.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-level" className="text-xs font-semibold text-muted">
              Level
            </label>
            <select id="filter-level" name="level" className={selectClass}>
              <option value="">Any level</option>
              {Object.entries(LEVELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-price" className="text-xs font-semibold text-muted">
              Price
            </label>
            <select id="filter-price" name="price" className={selectClass}>
              <option value="">Any price</option>
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-rating" className="text-xs font-semibold text-muted">
              Rating
            </label>
            <select id="filter-rating" name="rating" className={selectClass}>
              <option value="">Any rating</option>
              <option value="4.5">4.5 &amp; up</option>
              <option value="4">4.0 &amp; up</option>
              <option value="3.5">3.5 &amp; up</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-sort" className="text-xs font-semibold text-muted">
              Sort by
            </label>
            <select id="filter-sort" name="sort" className={selectClass}>
              <option value="popular">Most popular</option>
              <option value="rating">Highest rated</option>
              <option value="newest">Newest</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
            </select>
          </div>
        </form>
        <p className="mt-6 mb-6 text-sm text-muted" role="status">
          <span id="catalog-count">{pluralize(data.courses.length, "course")}</span>
          <button id="catalog-clear" type="button" className="ml-3 font-semibold text-brand-text hover:underline">
            Clear filters
          </button>
        </p>
        <Grid id="catalog-grid">
          {data.courses.map((c) => (
            <CourseCard key={c.id} ctx={ctx} course={c} now={now} />
          ))}
        </Grid>
        <div id="catalog-empty" hidden className="rounded-2xl border border-dashed border-line-strong px-6 py-14 text-center">
          <h2 className="font-display text-xl font-semibold">No courses match</h2>
          <p className="mt-2 text-sm text-muted">Try a different search term or remove some filters.</p>
        </div>
      </div>
    </Document>
  );
}

const LECTURE_ICONS = { VIDEO: PlayCircle, ARTICLE: ScrollText, DOCUMENT: FileText, QUIZ: CircleHelp } as const;

function lectureMeta(l: Course["sections"][number]["lectures"][number]): string {
  if (l.type === "QUIZ") return pluralize(readQuiz(l.quiz)?.questions.length ?? 0, "question");
  if (l.type === "DOCUMENT") return "Document";
  if (l.type === "ARTICLE") return l.durationSec > 0 ? `${Math.round(l.durationSec / 60)} min read` : "Article";
  return l.durationSec > 0 ? formatTimecode(l.durationSec) : "Video";
}

function CoursePage({ ctx, course, previewSrc, instructorStats }: { ctx: Ctx; course: Course; previewSrc: string | null; instructorStats: { courses: number; students: number; reviews: number } }) {
  const sections = course.sections.filter((s) => s.lectures.length > 0);
  const lectures = sections.flatMap((s) => s.lectures);
  const videoSeconds = lectures.filter((l) => l.type === "VIDEO").reduce((n, l) => n + l.durationSec, 0);
  const counts = (t: string) => lectures.filter((l) => l.type === t).length;
  const includes = [
    videoSeconds > 0 ? { Icon: Clock, text: `${formatDuration(videoSeconds)} of video` } : null,
    { Icon: PlayCircle, text: pluralize(course.lectureCount, "lecture") },
    counts("ARTICLE") ? { Icon: ScrollText, text: pluralize(counts("ARTICLE"), "article") } : null,
    counts("DOCUMENT") ? { Icon: FileText, text: pluralize(counts("DOCUMENT"), "document") } : null,
    counts("QUIZ") ? { Icon: CircleHelp, text: pluralize(counts("QUIZ"), "quiz", "quizzes") } : null,
    { Icon: Check, text: "Certificate of completion" },
  ].filter((x) => x !== null);
  const distribution = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    share: course.ratingCount ? Math.round((course.reviews.filter((r) => r.rating === stars).length / course.ratingCount) * 100) : 0,
  }));

  const card = (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
      {previewSrc ? (
        <div id="preview">
          <video src={previewSrc} controls preload="metadata" playsInline className="aspect-video w-full bg-black" />
          <p className="border-b border-line bg-surface-2 px-4 py-2 text-xs text-muted">Free preview lecture</p>
        </div>
      ) : (
        <CourseCover title={course.title} seed={course.id} />
      )}
      <div className="flex flex-col gap-5 p-6">
        <p className="font-display text-4xl font-semibold">{formatPrice(course.priceCents)}</p>
        <div className="flex flex-col gap-2.5">
          <a href={RUN_URL} className={buttonClass({ size: "lg" })}>
            {course.priceCents === 0 ? "Enroll for free" : "Add to cart"}
          </a>
          <p className="text-center text-xs text-subtle">Enrolling and checkout work in the full app, not in this static preview.</p>
        </div>
        <div>
          <h2 className="text-sm font-bold">This course includes</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {includes.map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-2.5">
                <Icon className="size-4 shrink-0 text-muted" aria-hidden />
                {text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );

  return (
    <Document ctx={ctx} title={course.title} description={course.subtitle}>
      <section className="border-b border-line bg-ink text-paper">
        <div className="container-page grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_23rem] lg:py-14">
          <div>
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-brand">
              <a href={href.catalog(ctx)} className="hover:underline">
                Courses
              </a>
              {course.category ? (
                <>
                  <span className="text-paper-muted">›</span>
                  <a href={href.catalog(ctx, `?category=${course.category.slug}`)} className="hover:underline">
                    {course.category.name}
                  </a>
                </>
              ) : null}
            </nav>
            <h1 className="mt-4 font-display text-3xl leading-tight font-semibold sm:text-4xl lg:text-[2.75rem]">{course.title}</h1>
            {course.subtitle ? <p className="mt-4 max-w-2xl text-lg leading-relaxed text-paper-muted">{course.subtitle}</p> : null}
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              {course.ratingCount > 0 ? (
                <a href="#reviews" className="flex items-center gap-1.5 hover:underline">
                  <span className="font-bold text-brand">{formatRating(course.ratingAvg)}</span>
                  <Stars value={course.ratingAvg} size={14} />
                  <span className="text-paper-muted">({formatCount(course.ratingCount)})</span>
                </a>
              ) : (
                <span className="text-paper-muted">No ratings yet</span>
              )}
              <span className="flex items-center gap-1.5 text-paper-muted">
                <Users className="size-4" aria-hidden /> {pluralize(course.enrollmentCount, "student")}
              </span>
            </div>
            <p className="mt-3 text-sm text-paper-muted">
              Created by{" "}
              <a href={href.instructor(ctx, course.instructor.id)} className="font-semibold text-brand hover:underline">
                {course.instructor.name}
              </a>
            </p>
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-paper-muted">
              <li className="flex items-center gap-1.5">
                <BarChart3 className="size-4" aria-hidden /> {LEVELS[course.level]}
              </li>
              <li className="flex items-center gap-1.5">
                <Globe className="size-4" aria-hidden /> {course.language}
              </li>
              <li className="flex items-center gap-1.5">
                <Clock className="size-4" aria-hidden /> Last updated {formatDate(course.updatedAt)}
              </li>
            </ul>
          </div>
        </div>
      </section>

      <div className="container-page grid gap-10 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <aside className="-mt-6 lg:order-last lg:-mt-72">
          <div className="lg:sticky lg:top-24">{card}</div>
        </aside>
        <div className="flex min-w-0 flex-col gap-12 pb-4 lg:pt-10">
          {course.outcomes.length > 0 ? (
            <section className="rounded-2xl border border-line bg-surface p-6">
              <h2 className="font-display text-2xl font-semibold">What you&apos;ll learn</h2>
              <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                {course.outcomes.map((o) => (
                  <li key={o} className="flex gap-2.5 text-sm leading-relaxed">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                    {o}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h2 className="font-display text-2xl font-semibold">Course content</h2>
            <p className="mt-1.5 mb-4 text-sm text-muted">
              {pluralize(sections.length, "section")} · {pluralize(course.lectureCount, "lecture")}
              {course.durationSec > 0 ? ` · ${formatDuration(course.durationSec)} total` : ""}
            </p>
            <div className="overflow-hidden rounded-2xl border border-line">
              {sections.map((section, i) => (
                <details key={section.id} open={i === 0} className="group border-b border-line last:border-b-0">
                  <summary className="flex list-none items-center gap-3 bg-surface-2 px-4 py-3.5 hover:bg-surface-3 [&::-webkit-details-marker]:hidden">
                    <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
                    <span className="min-w-0 flex-1 font-bold">{section.title}</span>
                    <span className="shrink-0 text-xs text-muted">{pluralize(section.lectures.length, "lecture")}</span>
                  </summary>
                  <ul className="bg-surface">
                    {section.lectures.map((l) => {
                      const Icon = LECTURE_ICONS[l.type];
                      return (
                        <li key={l.id} className="flex items-center gap-3 border-t border-line px-4 py-3 text-sm">
                          <Icon className="size-4 shrink-0 text-muted" aria-hidden />
                          <span className="min-w-0 flex-1">{l.title}</span>
                          {l.isPreview && previewSrc ? (
                            <a href="#preview" className="shrink-0 text-xs font-bold text-brand-text hover:underline">
                              Preview
                            </a>
                          ) : null}
                          <span className="shrink-0 text-xs text-subtle tabular-nums">{lectureMeta(l)}</span>
                          {l.isPreview ? null : <Lock className="size-3.5 shrink-0 text-subtle" aria-label="Locked" />}
                        </li>
                      );
                    })}
                  </ul>
                </details>
              ))}
            </div>
          </section>

          {course.requirements.length > 0 ? (
            <section>
              <h2 className="font-display text-2xl font-semibold">Requirements</h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 leading-relaxed">
                {course.requirements.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {course.description ? (
            <section>
              <h2 className="font-display text-2xl font-semibold">Description</h2>
              <Markdown className="mt-3">{course.description}</Markdown>
            </section>
          ) : null}
          {course.audience.length > 0 ? (
            <section>
              <h2 className="font-display text-2xl font-semibold">Who this course is for</h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 leading-relaxed">
                {course.audience.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h2 className="font-display text-2xl font-semibold">Your instructor</h2>
            <div className="mt-4 flex gap-4">
              <Avatar name={course.instructor.name} size={72} />
              <div className="min-w-0">
                <a href={href.instructor(ctx, course.instructor.id)} className="text-lg font-bold text-brand-text hover:underline">
                  {course.instructor.name}
                </a>
                {course.instructor.headline ? <p className="text-sm text-muted">{course.instructor.headline}</p> : null}
                <p className="mt-1.5 text-sm text-muted">
                  {pluralize(instructorStats.courses, "course")} · {pluralize(instructorStats.students, "student")} ·{" "}
                  {pluralize(instructorStats.reviews, "review")}
                </p>
              </div>
            </div>
            {course.instructor.bio ? <p className="mt-4 leading-relaxed whitespace-pre-line">{course.instructor.bio}</p> : null}
          </section>

          <section id="reviews" className="scroll-mt-24">
            <h2 className="font-display text-2xl font-semibold">Student reviews</h2>
            {course.ratingCount === 0 ? (
              <p className="mt-3 text-muted">This course hasn&apos;t been reviewed yet.</p>
            ) : (
              <>
                <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-center">
                  <div className="shrink-0 text-center sm:w-36">
                    <p className="font-display text-6xl leading-none font-semibold text-brand-text">{formatRating(course.ratingAvg)}</p>
                    <Stars value={course.ratingAvg} size={18} className="mt-2" />
                    <p className="mt-1 text-sm text-muted">{pluralize(course.ratingCount, "rating")}</p>
                  </div>
                  <ul className="flex flex-1 flex-col gap-1.5" aria-label="Rating breakdown">
                    {distribution.map(({ stars, share }) => (
                      <li key={stars} className="flex items-center gap-3 text-sm">
                        <span className="w-12 shrink-0 text-muted">{stars} star</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                          <span className="block h-full rounded-full bg-brand" style={{ width: `${share}%` }} />
                        </span>
                        <span className="w-10 shrink-0 text-right text-muted tabular-nums">{share}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <ul className="mt-8 flex flex-col divide-y divide-line">
                  {course.reviews.map((r) => (
                    <li key={r.id} className="py-5 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.user.name} size={40} />
                        <div>
                          <p className="font-bold">{r.user.name}</p>
                          <p className="flex items-center gap-2 text-xs text-subtle">
                            <Stars value={r.rating} size={13} /> {formatDate(r.createdAt)}
                          </p>
                        </div>
                      </div>
                      {r.comment ? <p className="mt-3 leading-relaxed whitespace-pre-line">{r.comment}</p> : null}
                      {r.reply ? (
                        <div className="mt-3 ml-4 rounded-xl border-l-2 border-brand bg-surface-2 px-4 py-3 text-sm">
                          <p className="font-bold">
                            {course.instructor.name} <span className="font-normal text-subtle">· Instructor</span>
                          </p>
                          <p className="mt-1 leading-relaxed whitespace-pre-line">{r.reply}</p>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      </div>
    </Document>
  );
}

function InstructorPage({ ctx, instructor, courses, now }: { ctx: Ctx; instructor: Course["instructor"]; courses: Course[]; now: number }) {
  const students = courses.reduce((n, c) => n + c.enrollmentCount, 0);
  const reviews = courses.reduce((n, c) => n + c.ratingCount, 0);
  const avg = reviews ? courses.reduce((n, c) => n + c.ratingAvg * c.ratingCount, 0) / reviews : 0;
  const facts = [
    { label: "Students", value: formatCount(students) },
    { label: "Reviews", value: formatCount(reviews) },
    { label: "Average rating", value: reviews ? formatRating(avg) : "—" },
    { label: "Courses", value: formatCount(courses.length) },
  ];
  return (
    <Document ctx={ctx} title={instructor.name} description={instructor.headline}>
      <div className="container-page py-10">
        <header className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <Avatar name={instructor.name} size={112} />
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-wide text-brand-text uppercase">Instructor</p>
            <h1 className="mt-1 font-display text-4xl font-semibold">{instructor.name}</h1>
            {instructor.headline ? <p className="mt-1 text-lg text-muted">{instructor.headline}</p> : null}
            <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
              {facts.map((f) => (
                <div key={f.label}>
                  <dd className="font-display text-2xl font-semibold">{f.value}</dd>
                  <dt className="text-xs text-muted">{f.label}</dt>
                </div>
              ))}
            </dl>
          </div>
        </header>
        {instructor.bio ? (
          <section className="mt-10 max-w-3xl">
            <h2 className="font-display text-2xl font-semibold">About</h2>
            <p className="mt-3 leading-relaxed whitespace-pre-line">{instructor.bio}</p>
          </section>
        ) : null}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-semibold">Courses by {instructor.name}</h2>
          <Grid className="mt-6">
            {courses.map((c) => (
              <CourseCard key={c.id} ctx={ctx} course={c} now={now} />
            ))}
          </Grid>
        </section>
      </div>
    </Document>
  );
}

// ───────────────────────── Build ─────────────────────────

async function writePage(relDir: string, element: ReactNode) {
  const dir = path.join(OUT, relDir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), "<!doctype html>\n" + renderToStaticMarkup(element));
}

const ctxFor = (depth: number): Ctx => ({ root: "../".repeat(depth) });

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const data = await loadData();
  if (data.courses.length === 0) throw new Error("No published courses. Seed the database with `npm run db:seed:demo` first.");
  // Fixed per build, so "New" badges reflect the snapshot date.
  const now = Date.now();

  await rm(OUT, { recursive: true, force: true });
  await mkdir(path.join(OUT, "assets", "fonts"), { recursive: true });

  // Stylesheet: the app's Tailwind build plus self-hosted fonts.
  execFileSync(
    path.resolve("node_modules/.bin/tailwindcss"),
    ["-i", "src/static-site/site.css", "-o", path.join(OUT, "assets", "site.css"), "--minify"],
    { stdio: "inherit" },
  );
  for (const font of ["figtree-latin-wght-normal.woff2", "figtree-latin-ext-wght-normal.woff2", "fraunces-latin-opsz-normal.woff2"]) {
    await copyFile(path.join("src/fonts", font), path.join(OUT, "assets", "fonts", font));
  }
  await copyFile("src/static-site/catalog.js", path.join(OUT, "assets", "catalog.js"));
  await writeFile(path.join(OUT, "assets", "icon.svg"), renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#f2a31b" /><path d="M16 6.5c.6 4.6 2.6 7 7.5 8.2-4.9 1.2-6.9 3.6-7.5 8.8-.6-5.2-2.6-7.6-7.5-8.8 4.9-1.2 6.9-3.6 7.5-8.2Z" fill="#1d1a16" /></svg>));

  await writePage("", <HomePage ctx={ctxFor(0)} data={data} now={now} />);
  await writePage("courses", <CatalogPage ctx={ctxFor(1)} data={data} now={now} />);

  for (const course of data.courses) {
    const preview = course.sections.flatMap((s) => s.lectures).find((l) => l.isPreview && l.type === "VIDEO" && l.media?.storageKey);
    const ctx = ctxFor(2);
    const previewSrc = preview?.media ? href.media(ctx, await publishVideo(preview.media.storageKey)) : null;
    const theirs = data.courses.filter((c) => c.instructor.id === course.instructor.id);
    await writePage(
      `courses/${course.slug}`,
      <CoursePage
        ctx={ctx}
        course={course}
        previewSrc={previewSrc}
        instructorStats={{
          courses: theirs.length,
          students: theirs.reduce((n, c) => n + c.enrollmentCount, 0),
          reviews: theirs.reduce((n, c) => n + c.ratingCount, 0),
        }}
      />,
    );
  }

  const instructors = new Map(data.courses.map((c) => [c.instructor.id, c.instructor]));
  for (const instructor of instructors.values()) {
    await writePage(
      `instructors/${instructor.id}`,
      <InstructorPage ctx={ctxFor(2)} instructor={instructor} courses={data.courses.filter((c) => c.instructor.id === instructor.id)} now={now} />,
    );
  }

  console.log(`✔ Static site written to ${path.relative(process.cwd(), OUT) || "."}: ${data.courses.length} courses, ${instructors.size} instructors, ${new Set(mediaFiles.values()).size} preview video file(s)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
