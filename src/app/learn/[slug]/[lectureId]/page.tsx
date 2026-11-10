import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, ExternalLink, Eye, FileText, Megaphone, NotebookPen, VideoOff } from "lucide-react";
import { getQuestions, QuestionList } from "@/components/course/qa";
import { AskQuestionForm } from "@/components/course/qa-controls";
import { Markdown } from "@/components/markdown";
import { CompleteButton, DeleteNoteButton, NoteForm, NoteTimestamp, ReviewForm } from "@/components/player/controls";
import { QuizPlayer } from "@/components/player/quiz-player";
import { Tabs, type TabItem } from "@/components/player/tabs";
import { EmbeddedVideo, VideoPlayer, VisitBeacon } from "@/components/player/video-player";
import { LinkButton } from "@/components/ui/button";
import { Alert, EmptyState, Skeleton } from "@/components/ui/misc";
import { canOpenLecture, getLearnContext } from "@/lib/courses/learn";
import { readQuiz, toPublicQuiz } from "@/lib/courses/quiz";
import { embedUrl } from "@/lib/courses/video";
import { db } from "@/lib/db";
import { formatBytes, timeAgo } from "@/lib/format";
import { requestTime } from "@/lib/request";
import { courseUrl, downloadUrl, learnUrl, mediaUrl } from "@/lib/urls";
import { firstParam } from "@/lib/utils";

type Props = PageProps<"/learn/[slug]/[lectureId]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lectureId } = await params;
  const lecture = await db.lecture.findUnique({ where: { id: lectureId }, select: { title: true } });
  return { title: lecture?.title ?? "Course player", robots: { index: false } };
}

export default function LecturePage(props: Props) {
  return (
    <Suspense fallback={<LectureSkeleton />}>
      <Lecture params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Lecture({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ slug, lectureId }, sp] = await Promise.all([params, searchParams]);
  const ctx = await getLearnContext(slug);
  if (!ctx) notFound();

  const lecture = ctx.lectures.find((l) => l.id === lectureId);
  if (!lecture) {
    if (ctx.access.canLearn) redirect(learnUrl(slug));
    notFound();
  }
  if (!canOpenLecture(ctx, lecture)) {
    redirect(ctx.user ? courseUrl(slug) : `/login?next=${encodeURIComponent(learnUrl(slug, lectureId))}`);
  }

  const { user, course, access, progress } = ctx;
  // Signed-in learners and course managers get progress, notes and discussion; preview visitors don't.
  const member = user && progress ? user : null;
  const now = await requestTime();

  const [data, questions, notes, announcements, myReview, bestAttempt] = await Promise.all([
    db.lecture.findUniqueOrThrow({
      where: { id: lecture.id },
      select: {
        content: true,
        videoUrl: true,
        mediaAssetId: true,
        quiz: true,
        media: { select: { filename: true, mimeType: true, sizeBytes: true } },
        section: { select: { title: true } },
        resources: {
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          select: { id: true, title: true, url: true, assetId: true, asset: { select: { filename: true, sizeBytes: true } } },
        },
      },
    }),
    member ? getQuestions({ courseId: course.id }) : [],
    member
      ? db.note.findMany({
          where: { userId: member.id, courseId: course.id },
          orderBy: [{ createdAt: "desc" }],
          take: 200,
          select: { id: true, body: true, positionSec: true, lectureId: true, createdAt: true, lecture: { select: { title: true, type: true } } },
        })
      : [],
    member
      ? db.announcement.findMany({
          where: { courseId: course.id },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { id: true, title: true, body: true, createdAt: true },
        })
      : [],
    member && access.isEnrolled
      ? db.review.findUnique({
          where: { userId_courseId: { userId: member.id, courseId: course.id } },
          select: { rating: true, comment: true },
        })
      : null,
    member && lecture.type === "QUIZ"
      ? db.quizAttempt.findFirst({
          where: { userId: member.id, lectureId: lecture.id },
          orderBy: [{ correct: "desc" }, { createdAt: "desc" }],
          select: { correct: true, total: true },
        })
      : null,
  ]);

  const openable = ctx.lectures.filter((l) => canOpenLecture(ctx, l));
  const index = openable.findIndex((l) => l.id === lecture.id);
  const prev = openable[index - 1];
  const next = openable[index + 1];
  const completed = progress?.completedIds.includes(lecture.id) ?? false;
  const quiz = lecture.type === "QUIZ" ? readQuiz(data.quiz) : null;
  const embed = embedUrl(data.videoUrl);
  const isUploadedVideo = lecture.type === "VIDEO" && !!data.mediaAssetId;
  const isPdf = data.media?.mimeType === "application/pdf";

  // ── The lecture itself ──
  let stage: React.ReactNode;
  if (lecture.type === "VIDEO") {
    stage = isUploadedVideo ? (
      <VideoPlayer
        key={`video-${lecture.id}`}
        lectureId={lecture.id}
        src={mediaUrl(data.mediaAssetId!)}
        startAt={progress?.positions[lecture.id] ?? 0}
        track={!!member}
        completed={completed}
        next={next ? { href: learnUrl(slug, next.id), title: next.title } : null}
      />
    ) : embed ? (
      <EmbeddedVideo src={embed} title={lecture.title} />
    ) : (
      <div className="flex aspect-video max-h-[60dvh] w-full flex-col items-center justify-center gap-2 bg-ink text-paper">
        <VideoOff className="size-10 text-paper-muted" aria-hidden />
        <p className="font-bold">No video has been added to this lecture yet.</p>
      </div>
    );
  } else if (lecture.type === "DOCUMENT" && data.mediaAssetId) {
    stage = isPdf ? (
      <iframe src={mediaUrl(data.mediaAssetId)} title={lecture.title} className="block h-[75dvh] w-full border-b border-line bg-surface-2" />
    ) : (
      <div className="flex flex-col items-center gap-3 border-b border-line bg-surface-2 px-6 py-14 text-center">
        <FileText className="size-12 text-muted" aria-hidden />
        <p className="font-bold">{data.media?.filename}</p>
        <p className="text-sm text-muted">This file type opens on your device rather than in the browser.</p>
      </div>
    );
  } else if (lecture.type === "QUIZ" && quiz) {
    stage = (
      <QuizPlayer key={`quiz-${lecture.id}`} lectureId={lecture.id} quiz={toPublicQuiz(quiz)} canSubmit={!!member} best={bestAttempt} />
    );
  } else if (lecture.type === "ARTICLE" && data.content.trim()) {
    stage = (
      <article className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
        <Markdown>{data.content}</Markdown>
      </article>
    );
  } else {
    stage = (
      <EmptyState className="m-6" title="This lecture has no content yet">
        Add content in the curriculum editor to make it visible to students.
      </EmptyState>
    );
  }

  // ── Tabs ──
  const showNotesInOverview = lecture.type !== "ARTICLE" && data.content.trim();
  const overview = (
    <div className="flex flex-col gap-6">
      {showNotesInOverview ? <Markdown>{data.content}</Markdown> : null}
      {lecture.type === "DOCUMENT" && data.mediaAssetId ? (
        <div>
          <LinkButton href={downloadUrl(data.mediaAssetId)} variant="outline" prefetch={false}>
            <Download aria-hidden /> Download {data.media?.filename}
            {data.media ? <span className="font-normal text-subtle">({formatBytes(Number(data.media.sizeBytes))})</span> : null}
          </LinkButton>
        </div>
      ) : null}
      {data.resources.length > 0 ? (
        <section>
          <h2 className="font-bold">Resources for this lecture</h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            {data.resources.map((r) =>
              !access.canLearn ? (
                <li key={r.id} className="flex items-center gap-2 text-sm text-muted">
                  <Download className="size-4" aria-hidden /> {r.title} <span className="text-xs">(enroll to download)</span>
                </li>
              ) : r.assetId ? (
                <li key={r.id}>
                  <a href={downloadUrl(r.assetId)} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-text hover:underline">
                    <Download className="size-4" aria-hidden /> {r.title}
                    {r.asset ? <span className="font-normal text-subtle">({formatBytes(Number(r.asset.sizeBytes))})</span> : null}
                  </a>
                </li>
              ) : (
                <li key={r.id}>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-brand-text hover:underline"
                  >
                    <ExternalLink className="size-4" aria-hidden /> {r.title}
                  </a>
                </li>
              ),
            )}
          </ul>
        </section>
      ) : null}
      {!showNotesInOverview && data.resources.length === 0 && lecture.type !== "DOCUMENT" ? (
        <p className="text-sm text-muted">
          You&apos;re in <strong className="text-fg">{data.section.title}</strong>, part of{" "}
          <Link href={courseUrl(slug)} className="font-semibold text-brand-text hover:underline">
            {course.title}
          </Link>{" "}
          by {course.instructorName}.
        </p>
      ) : null}
    </div>
  );

  const tabs: TabItem[] = [{ id: "overview", label: "Overview", content: overview }];

  if (member) {
    tabs.push({
      id: "qa",
      label: "Q&A",
      count: questions.length,
      content: (
        <div className="flex flex-col gap-5">
          <AskQuestionForm courseId={course.id} lectureId={lecture.id} />
          {questions.length > 0 ? (
            <QuestionList questions={questions} viewer={{ id: member.id, isAdmin: member.role === "ADMIN" }} now={now} />
          ) : (
            <p className="text-sm text-muted">No questions yet. Be the first to ask.</p>
          )}
        </div>
      ),
    });
    tabs.push({
      id: "notes",
      label: "Notes",
      count: notes.length,
      content: (
        <div className="flex flex-col gap-6">
          <NoteForm key={lecture.id} lectureId={lecture.id} isVideo={isUploadedVideo} />
          {notes.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {notes.map((note) => (
                <li key={note.id} className="rounded-xl border border-line bg-surface p-4">
                  <div className="flex items-start gap-2">
                    {note.lecture.type === "VIDEO" && note.positionSec > 0 ? (
                      <NoteTimestamp positionSec={note.positionSec} isCurrentLecture={note.lectureId === lecture.id} />
                    ) : null}
                    <Link
                      href={learnUrl(slug, note.lectureId)}
                      className="min-w-0 flex-1 truncate text-sm font-bold hover:text-brand-text"
                    >
                      {note.lecture.title}
                    </Link>
                    <DeleteNoteButton noteId={note.id} />
                  </div>
                  <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">{note.body}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<NotebookPen />} title="No notes yet" className="py-10">
              Notes are private to you and stay with the course.
            </EmptyState>
          )}
        </div>
      ),
    });
    tabs.push({
      id: "announcements",
      label: "Announcements",
      count: announcements.length,
      content:
        announcements.length > 0 ? (
          <ul className="flex flex-col gap-4">
            {announcements.map((a) => (
              <li key={a.id} className="rounded-xl border border-line bg-surface p-5">
                <p className="text-xs text-subtle">
                  {course.instructorName} · {timeAgo(a.createdAt, new Date(now))}
                </p>
                <h3 className="mt-1 text-lg font-bold">{a.title}</h3>
                <Markdown className="mt-2 text-sm">{a.body}</Markdown>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Megaphone />} title="No announcements" className="py-10">
            News from the instructor will appear here.
          </EmptyState>
        ),
    });
    if (access.isEnrolled) {
      tabs.push({
        id: "review",
        label: myReview ? "Your review" : "Leave a review",
        content: (
          <div className="max-w-xl">
            <ReviewForm key={myReview ? "edit" : "new"} courseId={course.id} existing={myReview} />
            <p className="mt-6 text-sm text-muted">
              Reviews are public and help other learners decide.{" "}
              <Link href={`${courseUrl(slug)}#reviews`} className="font-semibold text-brand-text hover:underline">
                See all reviews
              </Link>
            </p>
          </div>
        ),
      });
    }
  }

  return (
    <>
      {member && !isUploadedVideo ? <VisitBeacon key={`visit-${lecture.id}`} lectureId={lecture.id} /> : null}
      {stage}
      <div className="mx-auto max-w-4xl px-4 pt-6 pb-16 sm:px-6">
        {!access.canLearn ? (
          <Alert tone="info" title="You're viewing a free preview" className="mb-6">
            <span className="inline-flex items-center gap-1.5">
              <Eye className="size-4" aria-hidden />
              Enroll to unlock every lecture, track your progress and earn a certificate.
            </span>{" "}
            <Link href={courseUrl(slug)} className="font-bold text-brand-text hover:underline">
              View the course
            </Link>
          </Alert>
        ) : null}
        {access.canManage && course.status !== "PUBLISHED" ? (
          <Alert tone="warn" className="mb-6">
            This course isn&apos;t published. Only you and the site administrators can see this page.
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-wide text-subtle uppercase">{data.section.title}</p>
            <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">{lecture.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {prev ? (
              <LinkButton href={learnUrl(slug, prev.id)} variant="outline" size="icon" aria-label={`Previous: ${prev.title}`}>
                <ChevronLeft />
              </LinkButton>
            ) : null}
            {member ? <CompleteButton lectureId={lecture.id} completed={completed} /> : null}
            {next ? (
              <LinkButton href={learnUrl(slug, next.id)} variant="outline" aria-label={`Next: ${next.title}`}>
                Next <ChevronRight aria-hidden />
              </LinkButton>
            ) : null}
          </div>
        </div>

        {ctx.certificateCode && progress?.percent === 100 ? (
          <Alert tone="success" title="You've completed this course" className="mt-6">
            Your certificate is ready.{" "}
            <Link href={`/certificates/${ctx.certificateCode}`} className="font-bold text-brand-text hover:underline">
              View certificate
            </Link>
          </Alert>
        ) : null}

        <div className="mt-6">
          <Tabs tabs={tabs} initial={firstParam(sp.tab)} />
        </div>
      </div>
    </>
  );
}

function LectureSkeleton() {
  return (
    <div aria-busy="true">
      <Skeleton className="aspect-video max-h-[70dvh] w-full rounded-none bg-ink-2" />
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-8 w-2/3" />
        <Skeleton className="mt-8 h-40 w-full" />
      </div>
    </div>
  );
}
