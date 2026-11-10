import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BadgeDollarSign, FileVideo, MessagesSquare, Rocket, ShieldCheck, Users } from "lucide-react";
import { ActionButton } from "@/components/ui/action-form";
import { LinkButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { getCurrentUser, isInstructor } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { site } from "@/lib/site";
import { becomeInstructorAction } from "@/server/actions/account";

export const metadata: Metadata = {
  title: "Teach",
  description: `Create a course and reach learners on ${site.name}.`,
};

const FEATURES = [
  {
    Icon: FileVideo,
    title: "Every kind of lesson",
    body: "Upload videos, write articles, attach documents and downloadable resources, and check understanding with quizzes.",
  },
  {
    Icon: BadgeDollarSign,
    title: "Your price, your coupons",
    body: "Make a course free or set a price, then run your own promotions with discount codes.",
  },
  {
    Icon: Users,
    title: "Know your students",
    body: "See who enrolled, how far they've got, what they earned you and what they think.",
  },
  {
    Icon: MessagesSquare,
    title: "Stay in the conversation",
    body: "Answer questions, reply to reviews and post announcements to everyone enrolled.",
  },
];

const STEPS = [
  { title: "Plan your course", body: "Give it a title, say who it's for and list what students will be able to do." },
  { title: "Add your lessons", body: "Organise sections and lectures, then upload or write the content for each." },
  { title: "Publish", body: "Set a price and submit. Once it's approved it appears in the catalogue." },
];

export default function TeachPage() {
  return (
    <>
      <section className="border-b border-line bg-ink text-paper">
        <div className="container-page py-16 lg:py-24">
          <p className="text-sm font-bold tracking-wide text-brand uppercase">Teach on {site.name}</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl leading-[1.08] font-semibold sm:text-6xl">
            Turn what you know into a course.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-paper-muted">
            Build it at your own pace with a studio made for the job, and publish to learners looking for exactly what
            you teach.
          </p>
          <div className="mt-8 min-h-12">
            <Suspense fallback={<Skeleton className="h-12 w-56 bg-ink-2" />}>
              <CallToAction />
            </Suspense>
          </div>
        </div>
      </section>

      <section className="container-page py-16">
        <h2 className="font-display text-3xl font-semibold">Everything you need to teach online</h2>
        <ul className="mt-8 grid gap-6 sm:grid-cols-2">
          {FEATURES.map(({ Icon, title, body }) => (
            <li key={title} className="flex gap-4 rounded-2xl border border-line bg-surface p-6">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <h3 className="font-bold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="container-page">
        <h2 className="font-display text-3xl font-semibold">How it works</h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-2xl border border-line bg-surface p-6">
              <span className="font-display text-4xl font-semibold text-brand-text">{i + 1}</span>
              <h3 className="mt-2 font-bold">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
        <Suspense fallback={null}>
          <RevenueNote />
        </Suspense>
      </section>
    </>
  );
}

async function CallToAction() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <LinkButton href="/signup?next=/teach" size="lg">
        <Rocket aria-hidden /> Create an account to start
      </LinkButton>
    );
  }
  if (isInstructor(user)) redirect("/instructor");
  return (
    <ActionButton action={becomeInstructorAction} size="lg">
      <Rocket aria-hidden /> Become an instructor
    </ActionButton>
  );
}

async function RevenueNote() {
  const settings = await getSettings();
  return (
    <p className="mt-8 flex items-start gap-3 rounded-2xl bg-surface-2 p-5 text-sm leading-relaxed">
      <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
      <span>
        Instructors keep <strong>{settings.instructorSharePercent}%</strong> of every sale.
        {settings.requireCourseReview
          ? " Each course is checked by our team before it goes live, to keep quality high for learners."
          : " Courses go live as soon as you publish them."}
      </span>
    </p>
  );
}
