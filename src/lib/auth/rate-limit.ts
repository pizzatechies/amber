import "server-only";
import { headers } from "next/headers";

/**
 * Sliding-window rate limiter held in process memory.
 *
 * This is enough for a single app instance. If you run several instances,
 * swap the Map for a shared store such as Redis so limits apply across them.
 */
const hits = new Map<string, number[]>();
const MAX_KEYS = 20_000;

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  const since = now - windowMs;
  const recent = (hits.get(key) ?? []).filter((t) => t > since);

  if (recent.length >= limit) {
    hits.set(key, recent);
    const oldest = recent[0] ?? now;
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)) };
  }

  recent.push(now);
  hits.set(key, recent);
  if (hits.size > MAX_KEYS) prune(now);
  return { ok: true };
}

function prune(now: number): void {
  for (const [key, times] of hits) {
    const last = times[times.length - 1];
    // Nothing here uses a window longer than an hour.
    if (last === undefined || now - last > 60 * 60 * 1000) hits.delete(key);
  }
}

/** Best-effort client address, honouring the reverse proxy's forwarded header. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "unknown";
}

/** Test helper. */
export function resetRateLimits(): void {
  hits.clear();
}
