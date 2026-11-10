import { Suspense } from "react";
import Link from "next/link";
import { Award, ChevronLeft } from "lucide-react";
import { PlayerSidebar } from "@/components/player/sidebar";
import { LogoMark } from "@/components/site/logo";
import { LinkButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { getLearnContext } from "@/lib/courses/learn";
import { formatPrice } from "@/lib/money";
import { courseUrl } from "@/lib/urls";

type Params = LayoutProps<"/learn/[slug]">["params"];

export default function LearnLayout({ children, params }: LayoutProps<"/learn/[slug]">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 bg-ink px-3 text-paper sm:px-4">
        <Link href="/" aria-label="Home" className="shrink-0 rounded-lg">
          <LogoMark />
        </Link>
        <span className="h-5 w-px shrink-0 bg-white/20" aria-hidden />
        <Suspense fallback={<Skeleton className="h-5 w-64 bg-ink-2" />}>
          <TopBar params={params} />
        </Suspense>
      </header>

      <div className="flex-1 lg:grid lg:grid-cols-[minmax(0,1fr)_23rem]">
        <main id="main" className="min-w-0">
          {children}
        </main>
        <aside className="border-t border-line bg-surface lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:overflow-y-auto lg:border-t-0 lg:border-l">
          <Suspense fallback={<SidebarFallback />}>
            <Sidebar params={params} />
          </Suspense>
        </aside>
      </div>
    </div>
  );
}

async function TopBar({ params }: { params: Params }) {
  const ctx = await getLearnContext((await params).slug);
  if (!ctx) return null;
  const { course, progress, access, certificateCode } = ctx;

  return (
    <>
      <Link href={courseUrl(course.slug)} className="flex min-w-0 items-center gap-1 text-sm font-bold hover:underline">
        <ChevronLeft className="size-4 shrink-0 sm:hidden" aria-hidden />
        <span className="truncate">{course.title}</span>
      </Link>
      <div className="ml-auto flex shrink-0 items-center gap-3">
        {progress && progress.total > 0 ? (
          <div className="flex items-center gap-2 text-xs" title={`${progress.completed} of ${progress.total} lectures complete`}>
            <div
              role="progressbar"
              aria-label="Course progress"
              aria-valuenow={progress.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-white/20 sm:block"
            >
              <div className="h-full rounded-full bg-brand" style={{ width: `${progress.percent}%` }} />
            </div>
            <span className="font-bold tabular-nums">{progress.percent}%</span>
            <span className="hidden text-paper-muted md:inline">
              {progress.completed}/{progress.total} complete
            </span>
          </div>
        ) : null}
        {certificateCode ? (
          <LinkButton href={`/certificates/${certificateCode}`} size="sm">
            <Award aria-hidden /> Certificate
          </LinkButton>
        ) : null}
        {!access.canLearn ? (
          <LinkButton href={courseUrl(course.slug)} size="sm">
            {course.priceCents === 0 ? "Enroll for free" : `Get the course · ${formatPrice(course.priceCents)}`}
          </LinkButton>
        ) : null}
      </div>
    </>
  );
}

async function Sidebar({ params }: { params: Params }) {
  const ctx = await getLearnContext((await params).slug);
  if (!ctx) return null;
  return (
    <>
      <h2 className="border-b border-line px-4 py-3 font-bold">Course content</h2>
      <PlayerSidebar
        slug={ctx.course.slug}
        sections={ctx.sections}
        completedIds={ctx.progress?.completedIds ?? []}
        canLearn={ctx.access.canLearn}
        canTrack={ctx.progress !== null}
      />
    </>
  );
}

function SidebarFallback() {
  return (
    <div className="flex flex-col gap-3 p-4" aria-busy="true">
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
