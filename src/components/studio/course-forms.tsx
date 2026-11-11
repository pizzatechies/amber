"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { CourseCover } from "@/components/course/cover";
import { ActionForm, FieldError, SubmitButton } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { FileUploader, ImageUploader } from "@/components/ui/uploader";
import { LANGUAGES, LEVELS, site } from "@/lib/site";
import { discardUpload } from "@/lib/upload-client";
import { mediaUrl } from "@/lib/urls";
import { toAmountInput } from "@/lib/money";
import {
  updateCourseDetailsAction,
  updateCourseGoalsAction,
  updateCoursePricingAction,
} from "@/server/actions/studio";
import { MarkdownEditor } from "./markdown-editor";

type Details = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  categoryId: string | null;
  level: string;
  language: string;
  thumbnailAssetId: string | null;
  promoAssetId: string | null;
};

export function DetailsForm({ course, categories }: { course: Details; categories: Array<{ id: string; name: string }> }) {
  const [thumbnail, setThumbnail] = useState(course.thumbnailAssetId);
  const [promo, setPromo] = useState(course.promoAssetId);

  // An upload that was replaced before saving is no longer needed.
  function replace(current: string | null, saved: string | null, next: string | null, set: (v: string | null) => void) {
    if (current && current !== saved && current !== next) discardUpload(current);
    set(next);
  }

  return (
    <ActionForm action={updateCourseDetailsAction} className="flex max-w-3xl flex-col gap-6">
      <input type="hidden" name="courseId" value={course.id} />
      <input type="hidden" name="thumbnailAssetId" value={thumbnail ?? ""} />
      <input type="hidden" name="promoAssetId" value={promo ?? ""} />

      <Field label="Title">
        <Input name="title" defaultValue={course.title} required minLength={5} maxLength={120} />
        <FieldError name="title" />
      </Field>
      <Field label="Subtitle" hint="One sentence on what students get out of the course. Shown under the title.">
        <Input name="subtitle" defaultValue={course.subtitle} maxLength={200} />
        <FieldError name="subtitle" />
      </Field>
      <div>
        <p className="mb-1.5 text-sm font-semibold">Description</p>
        <MarkdownEditor name="description" label="Description" defaultValue={course.description} rows={12} maxLength={20000} />
        <FieldError name="description" className="mt-1.5" />
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <Field label="Category">
          <Select name="categoryId" defaultValue={course.categoryId ?? ""}>
            <option value="">Choose…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <FieldError name="categoryId" />
        </Field>
        <Field label="Level">
          <Select name="level" defaultValue={course.level}>
            {Object.entries(LEVELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Language">
          <Select name="language" defaultValue={course.language}>
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Course image</p>
        <ImageUploader
          purpose="thumbnail"
          value={thumbnail}
          onChange={(next) => replace(thumbnail, course.thumbnailAssetId, next, setThumbnail)}
          width={1280}
          height={720}
          label="Upload an image"
          placeholder={<CourseCover title={course.title} seed={course.id} />}
        />
        {!thumbnail ? <p className="mt-2 text-xs text-muted">Without an image, the generated cover shown here is used.</p> : null}
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">
          Promo video <span className="text-xs font-normal text-subtle">Optional</span>
        </p>
        {promo ? (
          <div className="flex flex-wrap items-start gap-4">
            <video src={mediaUrl(promo)} controls preload="metadata" className="w-64 rounded-xl border border-line bg-black" />
            <Button variant="ghost" size="sm" className="text-muted" onClick={() => replace(promo, course.promoAssetId, null, setPromo)}>
              <Trash2 aria-hidden /> Remove video
            </Button>
          </div>
        ) : (
          <FileUploader
            purpose="promo"
            label="Upload a promo video"
            hint="A short trailer shown on the course page. MP4 or WebM."
            onUploaded={(asset) => replace(promo, course.promoAssetId, asset.id, setPromo)}
          />
        )}
      </div>

      <SubmitButton className="self-start" pendingLabel="Saving…">
        Save details
      </SubmitButton>
    </ActionForm>
  );
}

function ListField({
  name,
  label,
  hint,
  initial,
  placeholder,
}: {
  name: string;
  label: string;
  hint: string;
  initial: string[];
  placeholder: string;
}) {
  const [items, setItems] = useState(() => (initial.length > 0 ? initial : [""]).map((value, i) => ({ key: i, value })));
  const [nextKey, setNextKey] = useState(initial.length + 1);

  return (
    <fieldset>
      <legend className="text-sm font-semibold">{label}</legend>
      <p className="mt-1 text-xs text-muted">{hint}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {items.map((item, index) => (
          <li key={item.key} className="flex gap-2">
            <Input
              name={name}
              value={item.value}
              maxLength={200}
              placeholder={placeholder}
              aria-label={`${label} ${index + 1}`}
              onChange={(e) => setItems((list) => list.map((it) => (it.key === item.key ? { ...it, value: e.target.value } : it)))}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Remove ${label.toLowerCase()} ${index + 1}`}
              disabled={items.length === 1}
              onClick={() => setItems((list) => list.filter((it) => it.key !== item.key))}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      {items.length < 20 ? (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={() => {
            setItems((list) => [...list, { key: nextKey, value: "" }]);
            setNextKey((k) => k + 1);
          }}
        >
          <Plus aria-hidden /> Add another
        </Button>
      ) : null}
    </fieldset>
  );
}

export function GoalsForm({
  course,
}: {
  course: { id: string; outcomes: string[]; requirements: string[]; audience: string[] };
}) {
  return (
    <ActionForm action={updateCourseGoalsAction} className="flex max-w-3xl flex-col gap-8">
      <input type="hidden" name="courseId" value={course.id} />
      <ListField
        name="outcomes"
        label="What students will learn"
        hint="Concrete things they'll be able to do. At least two are needed to publish."
        initial={course.outcomes}
        placeholder="e.g. Build a responsive page layout with CSS grid"
      />
      <ListField
        name="requirements"
        label="Requirements"
        hint="Skills, tools or equipment needed before starting. Say so if there are none."
        initial={course.requirements}
        placeholder="e.g. A laptop with a modern browser"
      />
      <ListField
        name="audience"
        label="Who this course is for"
        hint="Describe the learners who will get the most from it."
        initial={course.audience}
        placeholder="e.g. Designers who want to start coding"
      />
      <SubmitButton className="self-start" pendingLabel="Saving…">
        Save goals
      </SubmitButton>
    </ActionForm>
  );
}

export function PricingForm({ courseId, priceCents, sharePercent }: { courseId: string; priceCents: number; sharePercent: number }) {
  const [mode, setMode] = useState(priceCents > 0 ? "paid" : "free");
  return (
    <ActionForm action={updateCoursePricingAction} className="flex max-w-xl flex-col gap-5">
      <input type="hidden" name="courseId" value={courseId} />
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-semibold">How do students get this course?</legend>
        {[
          { value: "free", title: "Free", body: "Anyone can enroll at no cost." },
          { value: "paid", title: "Paid", body: `You keep ${sharePercent}% of each sale.` },
        ].map((option) => (
          <label
            key={option.value}
            className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${mode === option.value ? "border-focus bg-brand-soft" : "border-line-strong hover:bg-surface-2"}`}
          >
            <input
              type="radio"
              name="mode"
              value={option.value}
              checked={mode === option.value}
              onChange={() => setMode(option.value)}
              className="mt-1 size-4 accent-[var(--brand)]"
            />
            <span>
              <span className="block font-bold">{option.title}</span>
              <span className="block text-sm text-muted">{option.body}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {mode === "paid" ? (
        <Field label={`Price (${site.currency})`}>
          <Input
            name="price"
            inputMode="decimal"
            defaultValue={priceCents > 0 ? toAmountInput(priceCents) : ""}
            placeholder="29.99"
            required
            className="max-w-40"
          />
          <FieldError name="price" />
        </Field>
      ) : null}
      <SubmitButton className="self-start" pendingLabel="Saving…">
        Save pricing
      </SubmitButton>
    </ActionForm>
  );
}

