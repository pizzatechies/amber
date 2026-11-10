import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Award,
  BarChart3,
  Check,
  ChevronRight,
  CircleHelp,
  Clock,
  Download,
  FileText,
  Globe,
  Infinity as InfinityIcon,
  Pencil,
  PlayCircle,
  ScrollText,
  Users,
} from "lucide-react";
import { RatingLine } from "@/components/course/card";
import { CourseCover } from "@/components/course/cover";
import { CurriculumOutline } from "@/components/course/curriculum-outline";
import { PurchaseActions } from "@/components/course/purchase-actions";
import { RatingSummary, ReviewList, REVIEWS_PAGE_SIZE, getReviews } from "@/components/course/reviews";
import { Markdown } from "@/components/markdown";
import { LinkButton } from "@/components/ui/button";
import { Alert, Avatar, Badge, Card, Pagination, Skeleton } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { normalizeCouponCode, priceLine } from "@/lib/commerce/pricing";
import { courseAccess } from "@/lib/courses/access";
import { flattenCurriculum, getCurriculum } from "@/lib/courses/queries";
import { db } from "@/lib/db";
import { formatDate, formatDuration } from "@/lib/format";
import { formatMoney, formatPrice } from "@/lib/money";
import { requestTime } from "@/lib/request";
import { LEVELS } from "@/lib/site";
import { courseUrl, learnUrl, mediaUrl, studioUrl } from "@/lib/urls";
import { firstParam, pageParam, pluralize } from "@/lib/utils";

type Props = PageProps<"/courses/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const course = await db.course.findUnique({
    where: { slug },
    select: { title: true, subtitle: true, status: true },
  });
  if (!course || course.status !== "PUBLISHED") return { title: "Course", robots: { index: false } };
  return { title: course.title, description: course.subtitle || undefined };
}

export default function CoursePage(props: Props) {
  return (
    <Suspense fallback={<CourseSkeleton />}>
      <CourseContent params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function CourseContent({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ slug }, sp, user] = await Promise.all([params, searchParams, getCurrentUser()]);

  const course = await db.course.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      description: true,
      language: true,
      level: true,
      priceCents: true,
      outcomes: true,
      requirements: true,
      audience: true,
      thumbnailAssetId: true,
      promoAssetId: true,
      status: true,
      instructorId: true,
      ratingAvg: true,
      ratingCount: true,
      enrollmentCount: true,
      lectureCount: true,
      durationSec: true,
      updatedAt: true,
      category: { select: { name: true, slug: true } },
      instructor: { select: { id: true, name: true, headline: true, bio: true, avatarAssetId: true } },
    },
  });
  if (!course) notFound();

  const access = await courseAccess(user, course);
  if (!access.canViewLanding) notFound();

  const now = await requestTime();
  const reviewPage = pageParam(sp.reviews);
  const couponCode = normalizeCouponCode(firstParam(sp.coupon) ?? "");

  const [sections, reviewData, coupon, instructorStats, resourceCount, viewerState] = await Promise.all([
    getCurriculum(course.id, { readyOnly: true }),
    getReviews(course.id, reviewPage),
    couponCode
      ? db.coupon.findUnique({ where: { courseId_code: { courseId: course.id, code: couponCode } } })
      : Promise.resolve(null),
    db.course.aggregate({
      where: { instructorId: course.instructorId, status: "PUBLISHED" },
      _count: { _all: true },
      _sum: { enrollmentCount: true, ratingCount: true },
    }),
    db.lectureResource.count({ where: { lecture: { courseId: course.id, isReady: true } } }),
    user && !access.canLearn
      ? Promise.all([
          db.cartItem.findUnique({
            where: { userId_courseId: { userId: user.id, courseId: course.id } },
            select: { coupon: true },
          }),
          db.wishlistItem.findUnique({
            where: { userId_courseId: { userId: user.id, courseId: course.id } },
            select: { courseId: true },
          }),
        ])
      : Promise.resolve([null, null] as const),
  ]);
  const [cartItem, wishlistItem] = viewerState;

  // A coupon from the link wins; otherwise show the one already applied in the cart.
  const price = priceLine(course.priceCents, coupon ?? cartItem?.coupon ?? null, now);
  const lectures = flattenCurriculum(sections);
  const firstPreview = lectures.find((l) => l.isPreview);
  const counts = {
    video: lectures.filter((l) => l.type === "VIDEO").length,
    article: lectures.filter((l) => l.type === "ARTICLE").length,
    document: lectures.filter((l) => l.type === "DOCUMENT").length,
    quiz: lectures.filter((l) => l.type === "QUIZ").length,
  };
  const videoSeconds = lectures.filter((l) => l.type === "VIDEO").reduce((sum, l) => sum + l.durationSec, 0);
  const pagePath = courseUrl(course.slug) + (price.coupon ? `?coupon=${price.coupon.code}` : "");
  const loginHref = `/login?next=${encodeURIComponent(pagePath)}`;
  const reviewPages = Math.max(1, Math.ceil(course.ratingCount / REVIEWS_PAGE_SIZE));

  const includes = [
    videoSeconds > 0 ? { Icon: Clock, text: `${formatDuration(videoSeconds)} of video` } : null,
    { Icon: PlayCircle, text: pluralize(course.lectureCount, "lecture") },
    counts.article > 0 ? { Icon: ScrollText, text: pluralize(counts.article, "article") } : null,
    counts.document > 0 ? { Icon: FileText, text: pluralize(counts.document, "document") } : null,
    counts.quiz > 0 ? { Icon: CircleHelp, text: pluralize(counts.quiz, "quiz", "quizzes") } : null,
    resourceCount > 0 ? { Icon: Download, text: pluralize(resourceCount, "downloadable resource") } : null,
    { Icon: InfinityIcon, text: "Lifetime access" },
    { Icon: Award, text: "Certificate of completion" },
  ].filter((x) => x !== null);

  const purchaseCard = (
    <Card className="overflow-hidden shadow-pop">
      {course.promoAssetId ? (
        <video
          src={mediaUrl(course.promoAssetId)}
          poster={mediaUrl(course.thumbnailAssetId) ?? undefined}
          controls
          preload="metadata"
          playsInline
          className="aspect-video w-full bg-black"
        />
      ) : (
        <div className="relative">
          <CourseCover title={course.title} seed={course.id} assetId={course.thumbnailAssetId} eager />
          {firstPreview && !access.canLearn ? (
            <Link
              href={learnUrl(course.slug, firstPreview.id)}
              className="group absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/35 text-white transition-colors hover:bg-black/50"
            >
              <PlayCircle className="size-14 drop-shadow transition-transform group-hover:scale-105" aria-hidden />
              <span className="text-sm font-bold drop-shadow">Preview this course</span>
            </Link>
          ) : null}
        </div>
      )}

      <div className="flex flex-col gap-5 p-6">
        {access.canLearn ? (
          <>
            {access.isEnrolled ? (
              <Alert tone="success">You&apos;re enrolled in this course.</Alert>
            ) : (
              <Alert tone="info">
                {course.status === "PUBLISHED" ? "This is your course." : `This course is not public (${statusLabel(course.status)}).`}
              </Alert>
            )}
            <div className="flex flex-col gap-2.5">
              <LinkButton href={learnUrl(course.slug)} size="lg">
                <PlayCircle aria-hidden /> {access.isEnrolled ? "Go to course" : "Preview as a student"}
              </LinkButton>
              {access.canManage ? (
                <LinkButton href={studioUrl(course.id)} size="lg" variant="outline">
                  <Pencil aria-hidden /> Edit course
                </LinkButton>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-display text-4xl font-semibold">{formatPrice(price.priceCents)}</span>
                {price.discountCents > 0 ? (
                  <>
                    <s className="text-muted">{formatMoney(price.listCents)}</s>
                    <Badge tone="success">{price.coupon?.percentOff}% off</Badge>
                  </>
                ) : null}
              </p>
              {price.coupon ? (
                <p className="mt-1.5 text-sm text-success">
                  Coupon <strong>{price.coupon.code}</strong> applied
                </p>
              ) : couponCode ? (
                <p className="mt-1.5 text-sm text-danger">The coupon “{couponCode}” isn&apos;t valid for this course.</p>
              ) : null}
            </div>
            <PurchaseActions
              courseId={course.id}
              isFree={course.priceCents === 0}
              inCart={!!cartItem}
              wishlisted={!!wishlistItem}
              signedIn={!!user}
              loginHref={loginHref}
              couponCode={price.coupon?.code}
            />
          </>
        )}

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
    </Card>
  );

  return (
    <>
      <section className="border-b border-line bg-ink text-paper">
        <div className="container-page grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_23rem] lg:py-14">
          <div>
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-brand">
              <Link href="/courses" className="hover:underline">
                Courses
              </Link>
              {course.category ? (
                <>
                  <ChevronRight className="size-3.5 text-paper-muted" aria-hidden />
                  <Link href={`/courses?category=${course.category.slug}`} className="hover:underline">
                    {course.category.name}
                  </Link>
                </>
              ) : null}
            </nav>
            <h1 className="mt-4 font-display text-3xl leading-tight font-semibold sm:text-4xl lg:text-[2.75rem]">
              {course.title}
            </h1>
            {course.subtitle ? <p className="mt-4 max-w-2xl text-lg leading-relaxed text-paper-muted">{course.subtitle}</p> : null}

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              {course.ratingCount > 0 ? (
                <a href="#reviews" className="hover:underline">
                  <RatingLine
                    avg={course.ratingAvg}
                    count={course.ratingCount}
                    className="[&>span:first-child]:text-brand [&>span:last-child]:text-paper-muted"
                  />
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
              <Link href={`/instructors/${course.instructor.id}`} className="font-semibold text-brand hover:underline">
                {course.instructor.name}
              </Link>
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
          <div className="lg:sticky lg:top-24">{purchaseCard}</div>
        </aside>

        <div className="flex min-w-0 flex-col gap-12 pb-4 lg:pt-10">
          {course.outcomes.length > 0 ? (
            <section aria-labelledby="outcomes">
              <Card className="p-6">
                <h2 id="outcomes" className="font-display text-2xl font-semibold">
                  What you&apos;ll learn
                </h2>
                <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                  {course.outcomes.map((item) => (
                    <li key={item} className="flex gap-2.5 text-sm leading-relaxed">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          ) : null}

          <section aria-labelledby="content">
            <h2 id="content" className="font-display text-2xl font-semibold">
              Course content
            </h2>
            <p className="mt-1.5 mb-4 text-sm text-muted">
              {pluralize(sections.length, "section")} · {pluralize(course.lectureCount, "lecture")}
              {course.durationSec > 0 ? ` · ${formatDuration(course.durationSec)} total` : ""}
            </p>
            {sections.length > 0 ? (
              <CurriculumOutline sections={sections} slug={course.slug} unlocked={access.canLearn} />
            ) : (
              <p className="text-sm text-muted">The instructor hasn&apos;t added any lectures yet.</p>
            )}
          </section>

          {course.requirements.length > 0 ? (
            <section aria-labelledby="requirements">
              <h2 id="requirements" className="font-display text-2xl font-semibold">
                Requirements
              </h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 leading-relaxed">
                {course.requirements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {course.description ? (
            <section aria-labelledby="description">
              <h2 id="description" className="font-display text-2xl font-semibold">
                Description
              </h2>
              <Markdown className="mt-3">{course.description}</Markdown>
            </section>
          ) : null}

          {course.audience.length > 0 ? (
            <section aria-labelledby="audience">
              <h2 id="audience" className="font-display text-2xl font-semibold">
                Who this course is for
              </h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 leading-relaxed">
                {course.audience.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="instructor">
            <h2 id="instructor" className="font-display text-2xl font-semibold">
              Your instructor
            </h2>
            <div className="mt-4 flex gap-4">
              <Avatar name={course.instructor.name} assetId={course.instructor.avatarAssetId} size={72} />
              <div className="min-w-0">
                <Link
                  href={`/instructors/${course.instructor.id}`}
                  className="text-lg font-bold text-brand-text hover:underline"
                >
                  {course.instructor.name}
                </Link>
                {course.instructor.headline ? <p className="text-sm text-muted">{course.instructor.headline}</p> : null}
                <p className="mt-1.5 text-sm text-muted">
                  {pluralize(instructorStats._count._all, "course")} ·{" "}
                  {pluralize(instructorStats._sum.enrollmentCount ?? 0, "student")} ·{" "}
                  {pluralize(instructorStats._sum.ratingCount ?? 0, "review")}
                </p>
              </div>
            </div>
            {course.instructor.bio ? (
              <p className="mt-4 leading-relaxed whitespace-pre-line">{course.instructor.bio}</p>
            ) : null}
          </section>

          <section aria-labelledby="reviews" className="scroll-mt-24">
            <h2 id="reviews" className="font-display text-2xl font-semibold">
              Student reviews
            </h2>
            {course.ratingCount === 0 ? (
              <p className="mt-3 text-muted">
                This course hasn&apos;t been reviewed yet. Students can leave a rating from the course player.
              </p>
            ) : (
              <>
                <div className="mt-5">
                  <RatingSummary avg={course.ratingAvg} count={course.ratingCount} counts={reviewData.counts} />
                </div>
                <div className="mt-8">
                  <ReviewList reviews={reviewData.reviews} instructorName={course.instructor.name} now={now} />
                </div>
                <div className="mt-8">
                  <Pagination
                    page={reviewPage}
                    pageCount={reviewPages}
                    basePath={courseUrl(course.slug)}
                    pageParam="reviews"
                    hash="reviews"
                    params={{ coupon: price.coupon?.code }}
                  />
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function statusLabel(status: string): string {
  return status.toLowerCase().replace("_", " ");
}

function CourseSkeleton() {
  return (
    <div aria-busy="true">
      <div className="border-b border-line bg-ink">
        <div className="container-page py-14">
          <Skeleton className="h-4 w-40 bg-ink-2" />
          <Skeleton className="mt-5 h-10 w-full max-w-2xl bg-ink-2" />
          <Skeleton className="mt-4 h-6 w-full max-w-xl bg-ink-2" />
          <Skeleton className="mt-6 h-4 w-72 bg-ink-2" />
        </div>
      </div>
      <div className="container-page grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-64 w-full" />
        </div>
        <Skeleton className="hidden h-96 w-full lg:block" />
      </div>
    </div>
  );
}
