"use client";

import { useState } from "react";
import { Markdown } from "@/components/markdown";
import { Textarea } from "@/components/ui/form";
import { cn } from "@/lib/utils";

/** A Markdown textarea with a Write / Preview switch. Works controlled or as a named form field. */
export function MarkdownEditor({
  name,
  value,
  defaultValue = "",
  onChange,
  rows = 10,
  maxLength,
  placeholder,
  label,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  label: string;
}) {
  const [inner, setInner] = useState(defaultValue);
  const [preview, setPreview] = useState(false);
  const text = value ?? inner;
  const tab = (active: boolean) =>
    cn("rounded-md px-2.5 py-1 text-xs font-bold", active ? "bg-fg text-bg" : "text-muted hover:bg-surface-2");

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex gap-1" role="group" aria-label={`${label} view`}>
          <button type="button" className={tab(!preview)} aria-pressed={!preview} onClick={() => setPreview(false)}>
            Write
          </button>
          <button type="button" className={tab(preview)} aria-pressed={preview} onClick={() => setPreview(true)}>
            Preview
          </button>
        </div>
        <span className="text-xs text-subtle">Markdown: **bold**, # heading, - list, [link](https://…)</span>
      </div>
      {/* Keep the textarea mounted so its value is always submitted with the form. */}
      <Textarea
        name={name}
        aria-label={label}
        value={text}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => {
          setInner(e.target.value);
          onChange?.(e.target.value);
        }}
        className={cn("font-mono text-[0.8125rem]", preview && "hidden")}
      />
      {preview ? (
        <div className="min-h-32 rounded-lg border border-line-strong bg-surface px-4 py-3">
          {text.trim() ? <Markdown>{text}</Markdown> : <p className="text-sm text-subtle">Nothing to preview yet.</p>}
        </div>
      ) : null}
    </div>
  );
}
