// Support for lectures that link to a video hosted elsewhere.

const YOUTUBE_ID = /^[\w-]{11}$/;

/**
 * Turn a YouTube or Vimeo page link into an embeddable player URL.
 * Returns null for anything else, so we never iframe arbitrary sites.
 */
export function embedUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^www\.|^m\./, "").toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "youtu.be") {
    const id = parts[0] ?? "";
    return YOUTUBE_ID.test(id) ? youtube(id) : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    let id = "";
    if (parts[0] === "watch") id = url.searchParams.get("v") ?? "";
    else if (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live") id = parts[1] ?? "";
    return YOUTUBE_ID.test(id) ? youtube(id) : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = parts[0] === "video" ? parts[1] : parts[0];
    return id && /^\d{5,12}$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
  }
  return null;
}

function youtube(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
}

/** Estimated reading time for an article, in seconds (200 words per minute, minimum one minute). */
export function readingTimeSec(markdown: string): number {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;
  return Math.max(1, Math.ceil(words / 200)) * 60;
}
