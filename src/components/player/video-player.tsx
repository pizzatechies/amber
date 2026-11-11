"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, SkipForward, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setLectureCompleteAction } from "@/server/actions/learning";
import { playback } from "./playback-store";

const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];
const RATE_KEY = "player:rate";
const SAVE_EVERY_MS = 10_000;
const UP_NEXT_SECONDS = 6;

export function VideoPlayer({
  lectureId,
  src,
  startAt,
  track,
  completed,
  next,
}: {
  lectureId: string;
  src: string;
  /** Saved position to resume from, in seconds. */
  startAt: number;
  /** Record progress for this viewer (false for free previews). */
  track: boolean;
  completed: boolean;
  next: { href: string; title: string } | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const lastSaved = useRef(0);
  const [failed, setFailed] = useState(false);
  const rateRef = useRef<HTMLSelectElement>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const save = useCallback(
    (useBeacon = false) => {
      const video = videoRef.current;
      if (!video || !track) return;
      lastSaved.current = Date.now();
      // A finished video restarts from the beginning next time.
      const positionSec = video.ended ? 0 : Math.floor(video.currentTime);
      const body = JSON.stringify({ lectureId, positionSec });
      if (useBeacon && typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon("/api/progress", new Blob([body], { type: "application/json" }));
        return;
      }
      fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => undefined);
    },
    [lectureId, track],
  );

  // Restore the viewer's preferred speed (kept in the browser, so applied after mount).
  useEffect(() => {
    const stored = Number(window.localStorage.getItem(RATE_KEY));
    if (!RATES.includes(stored)) return;
    if (rateRef.current) rateRef.current.value = String(stored);
    if (videoRef.current) videoRef.current.playbackRate = stored;
  }, []);

  // Record the visit straight away, so "continue learning" points here.
  useEffect(() => {
    save();
  }, [save]);

  // Notes can ask the player to jump to a timestamp.
  useEffect(
    () =>
      playback.onSeek((sec) => {
        const video = videoRef.current;
        if (!video) return;
        video.currentTime = sec;
        setCountdown(null);
        video.play().catch(() => undefined);
        video.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }),
    [],
  );

  // Next.js keeps a page mounted (hidden) after you navigate away, and a
  // hidden <video> would keep playing. Pause and save when that happens.
  useLayoutEffect(() => {
    const video = videoRef.current;
    return () => {
      video?.pause();
      save();
    };
  }, [save]);

  useEffect(() => {
    const onHide = () => save(true);
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [save]);

  // "Up next" countdown after the video ends.
  useEffect(() => {
    if (countdown === null || !next) return;
    if (countdown <= 0) {
      router.push(next.href);
      return;
    }
    const timer = window.setTimeout(() => setCountdown((n) => (n === null ? null : n - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown, next, router]);

  function changeRate(value: number) {
    if (videoRef.current) videoRef.current.playbackRate = value;
    window.localStorage.setItem(RATE_KEY, String(value));
  }

  async function onEnded() {
    save();
    if (track && !completed) await setLectureCompleteAction(lectureId, true).catch(() => undefined);
    if (next) setCountdown(UP_NEXT_SECONDS);
  }

  if (failed) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-ink px-6 text-center text-paper">
        <TriangleAlert className="size-10 text-brand" aria-hidden />
        <p className="font-bold">This video couldn&apos;t be loaded.</p>
        <p className="max-w-sm text-sm text-paper-muted">Check your connection and try again.</p>
        <Button variant="outline" onClick={() => setFailed(false)}>
          <RotateCcw aria-hidden /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-black">
      <div className="relative mx-auto max-h-[calc(100dvh-11rem)] w-full" style={{ aspectRatio: "16 / 9" }}>
        <video
          ref={videoRef}
          src={src}
          controls
          playsInline
          preload="metadata"
          className="size-full bg-black"
          onLoadedMetadata={(e) => {
            const video = e.currentTarget;
            video.playbackRate = Number(rateRef.current?.value) || 1;
            if (startAt > 0 && startAt < video.duration - 3) video.currentTime = startAt;
          }}
          onTimeUpdate={(e) => {
            playback.report(lectureId, e.currentTarget.currentTime);
            if (Date.now() - lastSaved.current > SAVE_EVERY_MS) save();
          }}
          onPause={() => save()}
          onPlay={() => setCountdown(null)}
          onEnded={onEnded}
          onError={() => setFailed(true)}
        />
        {countdown !== null && next ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center text-white">
            <p className="text-sm text-white/70">Up next in {countdown}</p>
            <p className="max-w-lg font-display text-2xl font-semibold">{next.title}</p>
            <div className="mt-2 flex gap-2">
              <Button onClick={() => router.push(next.href)}>
                <SkipForward aria-hidden /> Play now
              </Button>
              <Button variant="outline" onClick={() => setCountdown(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      <div className="flex items-center justify-end gap-2 bg-ink px-4 py-1.5 text-xs text-paper-muted">
        <label className="flex items-center gap-2">
          Speed
          <select
            ref={rateRef}
            defaultValue={1}
            onChange={(e) => changeRate(Number(e.target.value))}
            className="rounded-md border border-white/20 bg-ink-2 px-2 py-1 text-paper"
          >
            {RATES.map((r) => (
              <option key={r} value={r}>
                {r}×
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

/** A lecture that points at YouTube or Vimeo. Progress there can't be observed, so completion is manual. */
export function EmbeddedVideo({ src, title }: { src: string; title: string }) {
  return (
    <div className="bg-black">
      <iframe
        src={src}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="mx-auto block aspect-video max-h-[calc(100dvh-11rem)] w-full"
      />
    </div>
  );
}

/** Marks a non-video lecture as the learner's most recent one. */
export function VisitBeacon({ lectureId }: { lectureId: string }) {
  useEffect(() => {
    fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lectureId, positionSec: 0 }),
    }).catch(() => undefined);
  }, [lectureId]);
  return null;
}
