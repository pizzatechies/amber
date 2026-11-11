"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  CircleHelp,
  Download,
  ExternalLink,
  FileText,
  LoaderCircle,
  Pencil,
  PlayCircle,
  Plus,
  ScrollText,
  Trash2,
  X,
} from "lucide-react";
import { useServerAction } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { Alert, Badge } from "@/components/ui/misc";
import { FileUploader } from "@/components/ui/uploader";
import type { Quiz } from "@/lib/courses/quiz";
import { formatBytes, formatTimecode } from "@/lib/format";
import { mediaUrl } from "@/lib/urls";
import { pluralize } from "@/lib/utils";
import {
  addLectureResourceAction,
  createLectureAction,
  createSectionAction,
  deleteLectureAction,
  deleteSectionAction,
  moveLectureAction,
  moveSectionAction,
  removeLectureResourceAction,
  renameSectionAction,
  saveLectureAction,
  setLectureMediaAction,
} from "@/server/actions/studio";
import { MarkdownEditor } from "./markdown-editor";
import { QuizEditor } from "./quiz-editor";

type LectureType = "VIDEO" | "ARTICLE" | "DOCUMENT" | "QUIZ";

export type EditorLecture = {
  id: string;
  title: string;
  type: LectureType;
  isPreview: boolean;
  isReady: boolean;
  durationSec: number;
  content: string;
  videoUrl: string;
  quiz: Quiz | null;
  media: { id: string; filename: string; sizeBytes: number } | null;
  resources: Array<{ id: string; title: string; url: string; assetId: string | null }>;
};

export type EditorSection = { id: string; title: string; lectures: EditorLecture[] };

const TYPES: Record<LectureType, { label: string; Icon: typeof PlayCircle }> = {
  VIDEO: { label: "Video", Icon: PlayCircle },
  ARTICLE: { label: "Article", Icon: ScrollText },
  DOCUMENT: { label: "Document", Icon: FileText },
  QUIZ: { label: "Quiz", Icon: CircleHelp },
};

function summary(l: EditorLecture): string {
  if (l.type === "QUIZ") return pluralize(l.quiz?.questions.length ?? 0, "question");
  if (l.type === "DOCUMENT") return l.media?.filename ?? "No file";
  if (l.type === "ARTICLE") return l.durationSec > 0 ? `${Math.round(l.durationSec / 60)} min read` : "Empty";
  if (l.media) return l.durationSec > 0 ? formatTimecode(l.durationSec) : l.media.filename;
  return l.videoUrl ? "External video" : "No video";
}

const iconButton = "rounded-lg p-1.5 text-muted hover:bg-surface-3 hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent";

export function CurriculumEditor({ courseId, sections }: { courseId: string; sections: EditorSection[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<{ kind: "section" | "lecture"; id: string; title: string } | null>(null);
  const moveSection = useServerAction(moveSectionAction, { quiet: true });
  const moveLecture = useServerAction(moveLectureAction, { quiet: true });
  const busy = moveSection.pending || moveLecture.pending;

  const allLectures = sections.flatMap((s) => s.lectures);
  const editing = allLectures.find((l) => l.id === editingId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      {sections.length === 0 ? (
        <Alert tone="info" title="Start with a section">
          Sections group related lectures, like chapters. Add one below, then add lectures to it.
        </Alert>
      ) : null}

      {sections.map((section, si) => (
        <section key={section.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
          <header className="flex items-center gap-2 border-b border-line bg-surface-2 px-4 py-3">
            <span className="shrink-0 text-xs font-bold text-subtle uppercase">Section {si + 1}</span>
            <SectionTitle key={section.title} id={section.id} title={section.title} />
            <button
              type="button"
              className={iconButton}
              aria-label={`Move section “${section.title}” up`}
              disabled={busy || si === 0}
              onClick={() => moveSection.run(section.id, "up")}
            >
              <ArrowUp className="size-4" />
            </button>
            <button
              type="button"
              className={iconButton}
              aria-label={`Move section “${section.title}” down`}
              disabled={busy || si === sections.length - 1}
              onClick={() => moveSection.run(section.id, "down")}
            >
              <ArrowDown className="size-4" />
            </button>
            <button
              type="button"
              className={iconButton}
              aria-label={`Delete section “${section.title}”`}
              onClick={() => setDeleting({ kind: "section", id: section.id, title: section.title })}
            >
              <Trash2 className="size-4" />
            </button>
          </header>

          <ul>
            {section.lectures.map((lecture, li) => {
              const { Icon } = TYPES[lecture.type];
              const first = si === 0 && li === 0;
              const last = si === sections.length - 1 && li === section.lectures.length - 1;
              return (
                <li key={lecture.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
                  <Icon className="size-4 shrink-0 text-muted" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{lecture.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-subtle">
                      <span>
                        {TYPES[lecture.type].label} · {summary(lecture)}
                      </span>
                      {lecture.isPreview ? <Badge tone="brand">Free preview</Badge> : null}
                      {!lecture.isReady ? <Badge tone="warn">No content — hidden from students</Badge> : null}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setEditingId(lecture.id)} aria-label={`Edit “${lecture.title}”`}>
                    <Pencil aria-hidden /> Edit
                  </Button>
                  <button
                    type="button"
                    className={iconButton}
                    aria-label={`Move “${lecture.title}” up`}
                    disabled={busy || first}
                    onClick={() => moveLecture.run(lecture.id, "up")}
                  >
                    <ArrowUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    className={iconButton}
                    aria-label={`Move “${lecture.title}” down`}
                    disabled={busy || last}
                    onClick={() => moveLecture.run(lecture.id, "down")}
                  >
                    <ArrowDown className="size-4" />
                  </button>
                  <button
                    type="button"
                    className={iconButton}
                    aria-label={`Delete “${lecture.title}”`}
                    onClick={() => setDeleting({ kind: "lecture", id: lecture.id, title: lecture.title })}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
          <AddLecture sectionId={section.id} sectionTitle={section.title} onCreated={setEditingId} />
        </section>
      ))}

      <AddSection courseId={courseId} />

      {editing ? <LectureEditor key={editing.id} lecture={editing} onClose={() => setEditingId(null)} /> : null}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={deleting?.kind === "section" ? "Delete this section?" : "Delete this lecture?"}
        confirmLabel="Delete"
        action={() => (deleting?.kind === "section" ? deleteSectionAction(deleting.id) : deleteLectureAction(deleting?.id ?? ""))}
      >
        “{deleting?.title}” {deleting?.kind === "section" ? "and every lecture in it" : ""} will be permanently removed, along
        with any uploaded files and students&apos; progress on it.
      </ConfirmDialog>
    </div>
  );
}

function SectionTitle({ id, title }: { id: string; title: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const rename = useServerAction(renameSectionAction, { quiet: true, onSuccess: () => setEditing(false) });

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group flex min-w-0 flex-1 items-center gap-2 text-left font-bold"
        aria-label={`Rename section “${title}”`}
      >
        <span className="truncate">{title}</span>
        <Pencil className="size-3.5 shrink-0 text-subtle opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
      </button>
    );
  }
  return (
    <form
      className="flex min-w-0 flex-1 items-center gap-1"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (value.trim()) rename.run(id, value);
      }}
    >
      <Input value={value} onChange={(e) => setValue(e.target.value)} maxLength={160} autoFocus aria-label="Section title" className="h-8" />
      <button type="submit" className={iconButton} aria-label="Save section title" disabled={rename.pending}>
        <Check className="size-4" />
      </button>
      <button type="button" className={iconButton} aria-label="Cancel" onClick={() => { setValue(title); setEditing(false); }}>
        <X className="size-4" />
      </button>
    </form>
  );
}

function AddSection({ courseId }: { courseId: string }) {
  const [title, setTitle] = useState("");
  const create = useServerAction(createSectionAction, { quiet: true, onSuccess: () => setTitle("") });
  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-2xl border border-dashed border-line-strong p-4"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (title.trim()) create.run(courseId, title);
      }}
    >
      <Field label="New section" className="min-w-52 flex-1">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="e.g. Getting started" />
      </Field>
      <Button type="submit" variant="outline" disabled={create.pending || !title.trim()}>
        <Plus aria-hidden /> Add section
      </Button>
    </form>
  );
}

function AddLecture({ sectionId, sectionTitle, onCreated }: { sectionId: string; sectionTitle: string; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<LectureType>("VIDEO");
  const create = useServerAction(createLectureAction, {
    quiet: true,
    onSuccess: (data) => {
      setTitle("");
      if (data) onCreated(data.lectureId);
    },
  });
  return (
    <form
      className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-2/50 px-4 py-3"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (title.trim()) create.run(sectionId, type, title);
      }}
    >
      <Select value={type} onChange={(e) => setType(e.target.value as LectureType)} aria-label={`Type of new lecture in ${sectionTitle}`} className="h-9 w-auto!">
        {Object.entries(TYPES).map(([value, t]) => (
          <option key={value} value={value}>
            {t.label}
          </option>
        ))}
      </Select>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={160}
        placeholder="New lecture title"
        aria-label={`Title of new lecture in ${sectionTitle}`}
        className="h-9 min-w-40 flex-1"
      />
      <Button type="submit" size="sm" variant="outline" disabled={create.pending || !title.trim()}>
        {create.pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Plus aria-hidden />} Add lecture
      </Button>
    </form>
  );
}

function LectureEditor({ lecture, onClose }: { lecture: EditorLecture; onClose: () => void }) {
  const [title, setTitle] = useState(lecture.title);
  const [isPreview, setIsPreview] = useState(lecture.isPreview);
  const [content, setContent] = useState(lecture.content);
  const [videoUrl, setVideoUrl] = useState(lecture.videoUrl);
  const [quiz, setQuiz] = useState<Quiz>(lecture.quiz ?? { questions: [] });
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const save = useServerAction(saveLectureAction, { onSuccess: onClose });
  const media = useServerAction(setLectureMediaAction);
  const addResource = useServerAction(addLectureResourceAction, {
    onSuccess: () => {
      setLinkTitle("");
      setLinkUrl("");
    },
  });
  const removeResource = useServerAction(removeLectureResourceAction, { quiet: true });

  const isVideo = lecture.type === "VIDEO";
  const takesFile = isVideo || lecture.type === "DOCUMENT";

  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      title={`Edit ${TYPES[lecture.type].label.toLowerCase()} lecture`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={save.pending || !title.trim()}
            aria-busy={save.pending}
            onClick={() =>
              save.run({
                lectureId: lecture.id,
                title,
                isPreview,
                content,
                videoUrl,
                quiz: lecture.type === "QUIZ" ? quiz : null,
              })
            }
          >
            {save.pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
            Save lecture
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {save.error ? <Alert tone="danger">{save.error}</Alert> : null}
        <Field label="Lecture title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
        </Field>

        {takesFile ? (
          <div>
            <p className="mb-2 text-sm font-semibold">{isVideo ? "Video file" : "Document"}</p>
            {lecture.media ? (
              <div className="flex flex-col gap-3">
                {isVideo ? (
                  <video src={mediaUrl(lecture.media.id)} controls preload="metadata" className="max-h-64 w-full rounded-xl bg-black" />
                ) : null}
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm">
                  <span className="min-w-0 flex-1 truncate font-semibold">{lecture.media.filename}</span>
                  <span className="text-subtle">{formatBytes(lecture.media.sizeBytes)}</span>
                  <Button variant="ghost" size="sm" className="text-muted" disabled={media.pending} onClick={() => media.run(lecture.id, null)}>
                    <Trash2 aria-hidden /> Remove
                  </Button>
                </div>
                <FileUploader
                  compact
                  purpose={isVideo ? "lecture-video" : "lecture-document"}
                  label="Replace file"
                  onUploaded={(asset) => media.run(lecture.id, asset.id)}
                />
              </div>
            ) : (
              <FileUploader
                purpose={isVideo ? "lecture-video" : "lecture-document"}
                label={isVideo ? "Upload a video" : "Upload a document"}
                hint={isVideo ? "MP4 (H.264) plays everywhere. Large files upload in resumable chunks." : "PDFs open in the browser; other files are offered as downloads."}
                onUploaded={(asset) => media.run(lecture.id, asset.id)}
              />
            )}
          </div>
        ) : null}

        {isVideo && !lecture.media ? (
          <Field label="Or link a hosted video" optional hint="Paste a YouTube or Vimeo address instead of uploading.">
            <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} type="url" placeholder="https://www.youtube.com/watch?v=…" maxLength={500} />
          </Field>
        ) : null}

        {lecture.type === "QUIZ" ? (
          <div>
            <p className="mb-2 text-sm font-semibold">Questions</p>
            <QuizEditor quiz={quiz} onChange={setQuiz} />
          </div>
        ) : (
          <div>
            <p className="mb-1.5 text-sm font-semibold">
              {lecture.type === "ARTICLE" ? "Article" : "Notes"}
              {lecture.type === "ARTICLE" ? null : <span className="ml-2 text-xs font-normal text-subtle">Optional, shown under the lecture</span>}
            </p>
            <MarkdownEditor
              label={lecture.type === "ARTICLE" ? "Article" : "Notes"}
              value={content}
              onChange={setContent}
              rows={lecture.type === "ARTICLE" ? 14 : 5}
              maxLength={100000}
            />
          </div>
        )}

        <Checkbox
          checked={isPreview}
          onChange={(e) => setIsPreview(e.target.checked)}
          label={
            <>
              <span className="font-semibold">Free preview</span>
              <span className="block text-xs text-muted">Anyone can open this lecture without enrolling. Good for your introduction.</span>
            </>
          }
        />

        <div className="border-t border-line pt-5">
          <p className="text-sm font-semibold">Downloadable resources</p>
          <p className="mt-1 text-xs text-muted">Slides, source files, worksheets or useful links for this lecture. Added straight away.</p>
          {lecture.resources.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-2">
              {lecture.resources.map((r) => (
                <li key={r.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm">
                  {r.assetId ? <Download className="size-4 text-muted" aria-hidden /> : <ExternalLink className="size-4 text-muted" aria-hidden />}
                  <span className="min-w-0 flex-1 truncate">{r.title}</span>
                  <button type="button" className={iconButton} aria-label={`Remove resource ${r.title}`} disabled={removeResource.pending} onClick={() => removeResource.run(r.id)}>
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <FileUploader
              compact
              purpose="resource"
              label="Upload a file"
              onUploaded={(asset) => addResource.run({ lectureId: lecture.id, title: asset.filename, assetId: asset.id })}
            />
            <span className="pb-1.5 text-xs text-subtle">or add a link:</span>
            <Input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="Link name" aria-label="Link name" maxLength={120} className="h-8 w-40" />
            <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://" aria-label="Link address" maxLength={500} className="h-8 w-52" />
            <Button
              variant="outline"
              size="sm"
              disabled={addResource.pending || !linkTitle.trim() || !linkUrl.trim()}
              onClick={() => addResource.run({ lectureId: lecture.id, title: linkTitle, url: linkUrl })}
            >
              Add link
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
