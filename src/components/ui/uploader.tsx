"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ImagePlus, LoaderCircle, Upload, X } from "lucide-react";
import { acceptAttribute, type AssetKindName } from "@/lib/storage/files";
import {
  UploadError,
  resizeImage,
  uploadFile,
  videoDuration,
  type UploadPurpose,
  type UploadedAsset,
} from "@/lib/upload-client";
import { mediaUrl } from "@/lib/urls";
import { cn } from "@/lib/utils";
import { Button } from "./button";

const KIND: Record<UploadPurpose, AssetKindName> = {
  avatar: "IMAGE",
  thumbnail: "IMAGE",
  promo: "VIDEO",
  "lecture-video": "VIDEO",
  "lecture-document": "FILE",
  resource: "FILE",
};

type State = { phase: "idle" } | { phase: "uploading"; name: string; fraction: number } | { phase: "error"; message: string };

/** Shared upload state machine: pick a file, show progress, allow cancelling. */
function useUpload(purpose: UploadPurpose, onUploaded: (asset: UploadedAsset) => void, prepare?: (file: File) => Promise<Blob>) {
  const [state, setState] = useState<State>({ phase: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const onUploadedRef = useRef(onUploaded);
  useEffect(() => {
    onUploadedRef.current = onUploaded;
  });
  // Stop an in-flight upload if the component goes away.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function start(file: File) {
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ phase: "uploading", name: file.name, fraction: 0 });
    try {
      const body = prepare ? await prepare(file) : file;
      const filename = prepare ? file.name.replace(/\.[^.]+$/, "") + ".jpg" : file.name;
      const durationSec = KIND[purpose] === "VIDEO" ? await videoDuration(file) : undefined;
      const asset = await uploadFile(body, {
        purpose,
        filename,
        durationSec,
        signal: controller.signal,
        onProgress: (fraction) => setState({ phase: "uploading", name: file.name, fraction }),
      });
      setState({ phase: "idle" });
      onUploadedRef.current(asset);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setState({ phase: "idle" });
      } else {
        setState({
          phase: "error",
          message: err instanceof UploadError ? err.message : "The upload failed. Please try again.",
        });
      }
    } finally {
      abortRef.current = null;
    }
  }

  return { state, start, cancel: () => abortRef.current?.abort() };
}

function ProgressRow({ name, fraction, onCancel }: { name: string; fraction: number; onCancel: () => void }) {
  const pct = Math.round(fraction * 100);
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-center gap-3 text-sm">
        <LoaderCircle className="size-4 shrink-0 animate-spin text-brand-text" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{name}</span>
        <span className="shrink-0 font-bold tabular-nums">{pct}%</span>
        <button type="button" onClick={onCancel} aria-label="Cancel upload" className="rounded p-1 text-subtle hover:bg-surface-2 hover:text-fg">
          <X className="size-4" />
        </button>
      </div>
      <div
        role="progressbar"
        aria-label={`Uploading ${name}`}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3"
      >
        <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** A drop zone / button that uploads one file and reports the stored asset. */
export function FileUploader({
  purpose,
  onUploaded,
  label,
  hint,
  compact,
}: {
  purpose: UploadPurpose;
  onUploaded: (asset: UploadedAsset) => void;
  label: string;
  hint?: ReactNode;
  /** Render as a plain button rather than a drop zone. */
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const { state, start, cancel } = useUpload(purpose, onUploaded);

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={acceptAttribute(KIND[purpose])}
      className="sr-only"
      tabIndex={-1}
      aria-label={label}
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) void start(file);
      }}
    />
  );

  if (state.phase === "uploading") {
    return <ProgressRow name={state.name} fraction={state.fraction} onCancel={cancel} />;
  }

  const error = state.phase === "error" ? <p role="alert" className="mt-2 text-sm font-medium text-danger">{state.message}</p> : null;

  if (compact) {
    return (
      <div>
        {input}
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          <Upload aria-hidden /> {label}
        </Button>
        {error}
      </div>
    );
  }

  return (
    <div>
      {input}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void start(file);
        }}
        className={cn(
          "flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
          dragging ? "border-focus bg-brand-soft" : "border-line-strong hover:border-fg/50 hover:bg-surface-2",
        )}
      >
        <Upload className="size-6 text-muted" aria-hidden />
        <span className="text-sm font-bold">{label}</span>
        {hint ? <span className="text-xs text-muted">{hint}</span> : null}
      </button>
      {error}
    </div>
  );
}

/**
 * Image picker with a preview. The image is cropped and resized in the browser
 * before upload. `value` is the current asset id (or null).
 */
export function ImageUploader({
  purpose,
  value,
  onChange,
  width,
  height,
  label,
  round,
  placeholder,
}: {
  purpose: "avatar" | "thumbnail";
  value: string | null;
  onChange: (assetId: string | null) => void;
  width: number;
  height: number;
  label: string;
  round?: boolean;
  /** Shown instead of the image when there is none. */
  placeholder?: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { state, start, cancel } = useUpload(purpose, (asset) => onChange(asset.id), (file) => resizeImage(file, width, height));
  const src = mediaUrl(value);

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div
        className={cn("shrink-0 overflow-hidden border border-line bg-surface-2", round ? "size-20 rounded-full" : "w-48 rounded-xl")}
        style={round ? undefined : { aspectRatio: `${width} / ${height}` }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- already resized before upload
          <img src={src} alt="" className="size-full object-cover" />
        ) : (
          (placeholder ?? (
            <div className="flex size-full items-center justify-center text-subtle">
              <ImagePlus className="size-6" aria-hidden />
            </div>
          ))
        )}
      </div>
      <div className="min-w-0 flex-1">
        <input
          ref={inputRef}
          type="file"
          accept={acceptAttribute("IMAGE")}
          className="sr-only"
          tabIndex={-1}
          aria-label={label}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void start(file);
          }}
        />
        {state.phase === "uploading" ? (
          <ProgressRow name={state.name} fraction={state.fraction} onCancel={cancel} />
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              <Upload aria-hidden /> {value ? "Replace image" : label}
            </Button>
            {value ? (
              <Button variant="ghost" size="sm" className="text-muted" onClick={() => onChange(null)}>
                Remove
              </Button>
            ) : null}
          </div>
        )}
        {state.phase === "error" ? <p role="alert" className="mt-2 text-sm font-medium text-danger">{state.message}</p> : null}
        <p className="mt-2 text-xs text-muted">
          JPEG, PNG, WebP or GIF. It will be cropped to {width}×{height}.
        </p>
      </div>
    </div>
  );
}
