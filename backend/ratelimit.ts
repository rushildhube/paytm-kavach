/**
 * A small in-memory rate limit for the routes that spend the Sarvam key
 * (speech to text, text to speech, drafting). Enough for a demo reachable
 * over a LAN or tunnel; not a substitute for real auth.
 */
const g = globalThis as unknown as { __kavachRate?: Map<string, number[]> };

/** Requests allowed per client per minute, by bucket. */
export const RATE_LIMITS = { voice: 30, draft: 12, upload: 20 } as const;

export class RateLimited extends Error {
  constructor() {
    super("too many requests, wait a minute");
  }
}

/** Client key from the request: first forwarded address, else one shared local key. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local";
}

/** Throws RateLimited when `key` has used up its bucket in the last minute. */
export function takeToken(bucket: keyof typeof RATE_LIMITS, key: string, at = Date.now()): void {
  const hits = (g.__kavachRate ??= new Map<string, number[]>());
  const id = `${bucket}|${key}`;
  const recent = (hits.get(id) ?? []).filter((t) => at - t < 60_000);
  if (recent.length >= RATE_LIMITS[bucket]) {
    hits.set(id, recent);
    throw new RateLimited();
  }
  recent.push(at);
  hits.set(id, recent);
}

export function resetRateLimits(): void {
  g.__kavachRate?.clear();
}
