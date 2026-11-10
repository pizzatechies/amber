"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Check, ChevronDown, CircleHelp, FileText, Lock, PlayCircle, ScrollText } from "lucide-react";
import { useServerAction } from "@/components/ui/action-form";
import type { CurriculumSection } from "@/lib/courses/queries";
import { formatTimecode } from "@/lib/format";
import { learnUrl } from "@/lib/urls";
import { cn, pluralize } from "@/lib/utils";
import { setLectureCompleteAction } from "@/server/actions/learning";

const ICONS = { VIDEO: PlayCircle, ARTICLE: ScrollText, DOCUMENT: FileText, QUIZ: CircleHelp } as const;

function meta(l: CurriculumSection["lectures"][number]): string {
  if (l.type === "QUIZ") return pluralize(l.questionCount, "question");
  if (l.type === "DOCUMENT") return "Document";
  if (l.type === "ARTICLE") return l.durationSec > 0 ? `${Math.round(l.durationSec / 60)} min read` : "Article";
  return l.durationSec > 0 ? formatTimecode(l.durationSec) : "Video";
}

export function PlayerSidebar({
  slug,
  sections,
  completedIds,
  canLearn,
  canTrack,
}: {
  slug: string;
  sections: CurriculumSection[];
  completedIds: string[];
  /** Full access: every lecture is a link. Otherwise only free previews are. */
  canLearn: boolean;
  /** Show completion checkboxes (signed-in learners and course managers). */
  canTrack: boolean;
}) {
  const { lectureId: activeId } = useParams<{ lectureId?: string }>();
  const done = new Set(completedIds);
  const toggle = useServerAction(setLectureCompleteAction, { quiet: true });

  return (
    <nav aria-label="Course content">
      {sections.map((section, index) => {
        const finished = section.lectures.filter((l) => done.has(l.id)).length;
        const hasActive = section.lectures.some((l) => l.id === activeId);
        return (
          <details key={section.id} open={hasActive || sections.length <= 4} className="group border-b border-line">
            <summary className="flex list-none items-start gap-2 bg-surface-2 px-4 py-3 hover:bg-surface-3 [&::-webkit-details-marker]:hidden">
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug font-bold">
                  Section {index + 1}: {section.title}
                </p>
                <p className="mt-0.5 text-xs text-subtle">
                  {canTrack ? `${finished} / ${section.lectures.length} complete` : pluralize(section.lectures.length, "lecture")}
                </p>
              </div>
              <ChevronDown className="mt-0.5 size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <ul>
              {section.lectures.map((lecture) => {
                const Icon = ICONS[lecture.type];
                const open = canLearn || lecture.isPreview;
                const active = lecture.id === activeId;
                const complete = done.has(lecture.id);
                const body = (
                  <>
                    <span className={cn("block text-sm leading-snug", active && "font-bold")}>{lecture.title}</span>
                    <span className="mt-1 flex items-center gap-1.5 text-xs text-subtle">
                      <Icon className="size-3.5" aria-hidden />
                      {meta(lecture)}
                      {!lecture.isReady ? <span className="font-semibold text-warn">· No content yet</span> : null}
                      {lecture.isPreview && !canLearn ? <span className="font-semibold text-brand-text">· Preview</span> : null}
                    </span>
                  </>
                );
                return (
                  <li
                    key={lecture.id}
                    className={cn("flex items-start gap-3 px-4 py-2.5", active ? "bg-brand-soft" : "hover:bg-surface-2")}
                  >
                    {canTrack ? (
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={complete}
                        aria-label={`Mark “${lecture.title}” as ${complete ? "not complete" : "complete"}`}
                        disabled={toggle.pending}
                        onClick={() => toggle.run(lecture.id, !complete)}
                        className={cn(
                          "mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded border-2 transition-colors",
                          complete ? "border-success bg-success text-surface" : "border-line-strong hover:border-fg",
                        )}
                      >
                        {complete ? <Check className="size-3" strokeWidth={3.5} aria-hidden /> : null}
                      </button>
                    ) : open ? null : (
                      <Lock className="mt-0.5 size-4 shrink-0 text-subtle" aria-label="Locked" />
                    )}
                    {open ? (
                      <Link
                        href={learnUrl(slug, lecture.id)}
                        aria-current={active ? "page" : undefined}
                        className="min-w-0 flex-1"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="min-w-0 flex-1 opacity-75">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
    </nav>
  );
}
