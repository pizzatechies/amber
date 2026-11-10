import Link from "next/link";
import { ChevronDown, CircleHelp, FileText, Lock, PlayCircle, ScrollText } from "lucide-react";
import type { CurriculumSection } from "@/lib/courses/queries";
import { formatDuration, formatTimecode } from "@/lib/format";
import { learnUrl } from "@/lib/urls";
import { pluralize } from "@/lib/utils";

export const LECTURE_ICONS = {
  VIDEO: PlayCircle,
  ARTICLE: ScrollText,
  DOCUMENT: FileText,
  QUIZ: CircleHelp,
} as const;

export function lectureMeta(l: { type: keyof typeof LECTURE_ICONS; durationSec: number; questionCount: number }): string {
  if (l.type === "QUIZ") return pluralize(l.questionCount, "question");
  if (l.type === "DOCUMENT") return "Document";
  if (l.type === "ARTICLE") return l.durationSec > 0 ? `${Math.round(l.durationSec / 60)} min read` : "Article";
  return l.durationSec > 0 ? formatTimecode(l.durationSec) : "Video";
}

/** The public course outline. Free-preview lectures link into the player. */
export function CurriculumOutline({
  sections,
  slug,
  unlocked,
}: {
  sections: CurriculumSection[];
  slug: string;
  /** The viewer has full access, so every lecture is a link. */
  unlocked: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      {sections.map((section, i) => {
        const seconds = section.lectures.reduce((sum, l) => sum + l.durationSec, 0);
        return (
          <details key={section.id} open={i === 0} className="group border-b border-line last:border-b-0">
            <summary className="flex list-none items-center gap-3 bg-surface-2 px-4 py-3.5 hover:bg-surface-3 [&::-webkit-details-marker]:hidden">
              <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
              <span className="min-w-0 flex-1 font-bold">{section.title}</span>
              <span className="shrink-0 text-xs text-muted">
                {pluralize(section.lectures.length, "lecture")}
                {seconds > 0 ? ` · ${formatDuration(seconds)}` : ""}
              </span>
            </summary>
            <ul className="bg-surface">
              {section.lectures.map((lecture) => {
                const Icon = LECTURE_ICONS[lecture.type];
                const open = unlocked || lecture.isPreview;
                return (
                  <li key={lecture.id} className="flex items-center gap-3 border-t border-line px-4 py-3 text-sm">
                    <Icon className="size-4 shrink-0 text-muted" aria-hidden />
                    {open ? (
                      <Link href={learnUrl(slug, lecture.id)} className="min-w-0 flex-1 text-brand-text hover:underline">
                        {lecture.title}
                      </Link>
                    ) : (
                      <span className="min-w-0 flex-1">{lecture.title}</span>
                    )}
                    {lecture.isPreview && !unlocked ? (
                      <span className="shrink-0 text-xs font-bold text-brand-text">Preview</span>
                    ) : null}
                    <span className="shrink-0 text-xs text-subtle tabular-nums">{lectureMeta(lecture)}</span>
                    {open ? null : <Lock className="size-3.5 shrink-0 text-subtle" aria-label="Locked" />}
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
