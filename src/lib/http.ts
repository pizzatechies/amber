import "server-only";

export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(data, { status, headers });
}

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

/**
 * Reject cross-site requests to cookie-authenticated Route Handlers.
 * (Server Actions get this check from Next.js; Route Handlers do not.)
 * Browsers always send Origin on cross-origin and non-GET requests.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Content-Disposition header value with a safely encoded filename. */
export function contentDisposition(type: "inline" | "attachment", filename: string): string {
  const fallback = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
