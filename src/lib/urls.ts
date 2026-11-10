// URL builders. Safe to import from client components.

export function mediaUrl(assetId: string): string;
export function mediaUrl(assetId: string | null | undefined): string | null;
export function mediaUrl(assetId: string | null | undefined): string | null {
  return assetId ? `/api/media/${assetId}` : null;
}

export function downloadUrl(assetId: string): string {
  return `/api/media/${assetId}?download=1`;
}

export function courseUrl(slug: string): string {
  return `/courses/${slug}`;
}

export function learnUrl(slug: string, lectureId?: string): string {
  return lectureId ? `/learn/${slug}/${lectureId}` : `/learn/${slug}`;
}

export function studioUrl(courseId: string, tab = ""): string {
  return `/instructor/courses/${courseId}${tab ? `/${tab}` : ""}`;
}
