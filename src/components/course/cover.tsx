import { cn, hashString } from "@/lib/utils";
import { mediaUrl } from "@/lib/urls";

// Fixed palettes (background, primary shape, secondary shape, letter) so
// generated covers look the same in light and dark mode.
const PALETTES = [
  ["#f2a31b", "#fcefd2", "#1d1a16", "#1d1a16"],
  ["#1d1a16", "#f2a31b", "#5f574c", "#faf7f2"],
  ["#1f6f6b", "#f2a31b", "#d8efe6", "#faf7f2"],
  ["#b4472b", "#fcefd2", "#1d1a16", "#faf7f2"],
  ["#24507e", "#f2a31b", "#dce8f7", "#faf7f2"],
  ["#e9e2d6", "#b4472b", "#1d1a16", "#1d1a16"],
  ["#5b3a5e", "#f2a31b", "#ead9ec", "#faf7f2"],
  ["#3d5a2a", "#fcefd2", "#f2a31b", "#faf7f2"],
] as const;

/**
 * A course's cover image. Courses without an uploaded thumbnail get a
 * generated cover: a deterministic geometric composition with the title's
 * initial, so the catalogue never shows a grey placeholder.
 */
export function CourseCover({
  title,
  seed,
  assetId,
  className,
  eager,
}: {
  title: string;
  /** Stable value (the course id) that picks the generated design. */
  seed: string;
  assetId?: string | null;
  className?: string;
  eager?: boolean;
}) {
  const src = mediaUrl(assetId);
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- thumbnails are resized in the browser before upload
      <img
        src={src}
        alt=""
        width={1280}
        height={720}
        loading={eager ? "eager" : "lazy"}
        className={cn("aspect-video w-full bg-surface-2 object-cover", className)}
      />
    );
  }

  const h = hashString(seed);
  const [bg, a, b, ink] = PALETTES[h % PALETTES.length]!;
  const variant = (h >>> 8) % 4;
  const letter = (title.trim()[0] ?? "A").toUpperCase();

  return (
    <svg
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      className={cn("block aspect-video w-full", className)}
    >
      <rect width="320" height="180" fill={bg} />
      {variant === 0 ? (
        <>
          <circle cx="262" cy="150" r="96" fill={a} />
          <circle cx="262" cy="150" r="52" fill={b} />
          <rect x="24" y="24" width="64" height="5" rx="2.5" fill={b} opacity="0.55" />
        </>
      ) : variant === 1 ? (
        <>
          <path d="M320 0v120a120 120 0 0 1-120-120Z" fill={a} />
          <path d="M320 180h-90a90 90 0 0 1 90-90Z" fill={b} />
          <circle cx="170" cy="150" r="14" fill={a} />
        </>
      ) : variant === 2 ? (
        <>
          <rect x="190" y="0" width="44" height="180" fill={a} />
          <rect x="246" y="0" width="22" height="180" fill={b} />
          <rect x="280" y="0" width="10" height="180" fill={a} opacity="0.7" />
          <circle cx="212" cy="62" r="44" fill={b} />
        </>
      ) : (
        <>
          <path d="M150 180 320 30v150Z" fill={a} />
          <path d="M230 180 320 100v80Z" fill={b} />
          <circle cx="278" cy="44" r="20" fill={a} />
        </>
      )}
      <text
        x="24"
        y="156"
        fontSize="112"
        fontWeight="600"
        fill={ink}
        style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}
      >
        {letter}
      </text>
    </svg>
  );
}
