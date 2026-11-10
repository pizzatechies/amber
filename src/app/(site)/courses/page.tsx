import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SearchX, SlidersHorizontal, X } from "lucide-react";
import { CourseCard, CourseGrid, CourseGridSkeleton } from "@/components/course/card";
import { SearchBox } from "@/components/site/header";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, Pagination, Skeleton, Stars } from "@/components/ui/misc";
import {
  SORT_OPTIONS,
  getCategories,
  parseCatalogParams,
  searchCourses,
  type CatalogFilters,
  type SortKey,
} from "@/lib/courses/queries";
import { requestTime } from "@/lib/request";
import { LEVELS } from "@/lib/site";
import { cn, pluralize } from "@/lib/utils";
import { SortSelect } from "./sort-select";

export const metadata: Metadata = {
  title: "Browse courses",
  description: "Search and filter every course in the catalogue.",
};

export default function CoursesPage(props: PageProps<"/courses">) {
  return (
    <div className="container-page py-10">
      <Suspense fallback={<CatalogSkeleton />}>
        <Catalog searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

type FilterKey = "q" | "category" | "level" | "price" | "rating" | "sort";

/** Link to the catalogue with some filters changed. Any change goes back to page one. */
function hrefWith(f: CatalogFilters, patch: Partial<Record<FilterKey, string>>): string {
  const current: Record<FilterKey, string> = {
    q: f.q,
    category: f.category,
    level: f.level.toLowerCase(),
    price: f.price,
    rating: f.rating ? String(f.rating) : "",
    sort: f.sort === "popular" ? "" : f.sort,
  };
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...patch })) if (value) qs.set(key, value);
  const s = qs.toString();
  return s ? `/courses?${s}` : "/courses";
}

function FilterGroup({
  title,
  options,
}: {
  title: string;
  options: Array<{ label: React.ReactNode; href: string; active: boolean; count?: number }>;
}) {
  return (
    <div>
      <h2 className="text-sm font-bold">{title}</h2>
      <ul className="mt-2.5 flex flex-col gap-0.5">
        {options.map((o) => (
          <li key={o.href}>
            <Link
              href={o.href}
              aria-current={o.active ? "true" : undefined}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm",
                o.active ? "bg-brand-soft font-bold text-brand-text" : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              <span className="flex min-w-0 items-center gap-1.5">{o.label}</span>
              {o.count !== undefined ? <span className="text-xs font-normal text-subtle">{o.count}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function Catalog({ searchParams }: Pick<PageProps<"/courses">, "searchParams">) {
  const filters = parseCatalogParams(await searchParams);
  const [categories, result] = await Promise.all([getCategories(), searchCourses(filters)]);
  const now = await requestTime();

  const activeCategory = categories.find((c) => c.slug === filters.category);
  const heading = filters.q
    ? `Results for “${filters.q}”`
    : activeCategory
      ? `${activeCategory.name} courses`
      : "All courses";

  const filterPanel = (
    <div className="flex flex-col gap-7">
      <FilterGroup
        title="Category"
        options={[
          { label: "All categories", href: hrefWith(filters, { category: "" }), active: !filters.category },
          ...categories
            .filter((c) => c.courseCount > 0 || c.slug === filters.category)
            .map((c) => ({
              label: c.name,
              href: hrefWith(filters, { category: c.slug }),
              active: c.slug === filters.category,
              count: c.courseCount,
            })),
        ]}
      />
      <FilterGroup
        title="Level"
        options={[
          { label: "Any level", href: hrefWith(filters, { level: "" }), active: !filters.level },
          ...Object.entries(LEVELS).map(([value, label]) => ({
            label,
            href: hrefWith(filters, { level: value.toLowerCase() }),
            active: filters.level === value,
          })),
        ]}
      />
      <FilterGroup
        title="Price"
        options={[
          { label: "Any price", href: hrefWith(filters, { price: "" }), active: !filters.price },
          { label: "Free", href: hrefWith(filters, { price: "free" }), active: filters.price === "free" },
          { label: "Paid", href: hrefWith(filters, { price: "paid" }), active: filters.price === "paid" },
        ]}
      />
      <FilterGroup
        title="Rating"
        options={[
          { label: "Any rating", href: hrefWith(filters, { rating: "" }), active: !filters.rating },
          ...[4.5, 4, 3.5].map((r) => ({
            label: (
              <>
                <Stars value={r} size={13} /> {r.toFixed(1)} &amp; up
              </>
            ),
            href: hrefWith(filters, { rating: String(r) }),
            active: filters.rating === r,
          })),
        ]}
      />
    </div>
  );

  const hasFilters = !!(filters.q || filters.category || filters.level || filters.price || filters.rating);

  return (
    <>
      <h1 className="font-display text-3xl font-semibold sm:text-4xl">{heading}</h1>
      {activeCategory?.description && !filters.q ? (
        <p className="mt-2 max-w-2xl text-muted">{activeCategory.description}</p>
      ) : null}
      <SearchBox defaultValue={filters.q} className="mt-5 max-w-xl sm:hidden" />

      <div className="mt-8 grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside aria-label="Filters">
          <details className="group rounded-xl border border-line bg-surface lg:hidden">
            <summary className="flex list-none items-center gap-2 px-4 py-3 text-sm font-bold [&::-webkit-details-marker]:hidden">
              <SlidersHorizontal className="size-4" aria-hidden /> Filters
            </summary>
            <div className="border-t border-line p-4">{filterPanel}</div>
          </details>
          <div className="sticky top-24 hidden lg:block">{filterPanel}</div>
        </aside>

        <div>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted" role="status">
              {pluralize(result.total, "course")}
              {hasFilters ? (
                <Link
                  href={filters.sort === "popular" ? "/courses" : `/courses?sort=${filters.sort}`}
                  className="ml-3 inline-flex items-center gap-1 font-semibold text-brand-text hover:underline"
                >
                  <X className="size-3.5" aria-hidden /> Clear filters
                </Link>
              ) : null}
            </p>
            <SortSelect
              value={filters.sort}
              options={(Object.keys(SORT_OPTIONS) as SortKey[]).map((key) => ({
                value: key,
                label: SORT_OPTIONS[key],
                href: hrefWith(filters, { sort: key === "popular" ? "" : key }),
              }))}
            />
          </div>

          {result.courses.length === 0 ? (
            <EmptyState
              icon={<SearchX />}
              title="No courses match"
              action={
                <LinkButton href="/courses" variant="outline">
                  Show all courses
                </LinkButton>
              }
            >
              Try a different search term or remove some filters.
            </EmptyState>
          ) : (
            <>
              <CourseGrid className="xl:grid-cols-3">
                {result.courses.map((c) => (
                  <CourseCard key={c.id} course={c} now={now} />
                ))}
              </CourseGrid>
              <div className="mt-10">
                <Pagination
                  page={filters.page}
                  pageCount={result.pageCount}
                  basePath="/courses"
                  params={{
                    q: filters.q,
                    category: filters.category,
                    level: filters.level.toLowerCase(),
                    price: filters.price,
                    rating: filters.rating ? String(filters.rating) : "",
                    sort: filters.sort === "popular" ? "" : filters.sort,
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function CatalogSkeleton() {
  return (
    <div aria-busy="true">
      <Skeleton className="h-10 w-64" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <div className="hidden flex-col gap-3 lg:flex">
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
        <CourseGridSkeleton count={6} className="xl:grid-cols-3" />
      </div>
    </div>
  );
}
