import { headers } from "next/headers";

/**
 * In-memory fixed-window rate limiter. Deliberately simple for this app's
 * scale (small, private, single Railway instance — see METHODS.md): state
 * resets on process restart and isn't shared across instances, which is
 * an accepted tradeoff rather than an oversight.
 */
const buckets = new Map<string, { count: number; windowStart: number }>();

export class RateLimitError extends Error {
  constructor() {
    super("Too many attempts. Please wait a minute and try again.");
    this.name = "RateLimitError";
  }
}

/** Pure counting logic, decoupled from Next's request context so it's unit-testable. */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number,
  store: Map<string, { count: number; windowStart: number }> = buckets
) {
  const bucket = store.get(key);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return;
  }

  if (bucket.count >= limit) {
    throw new RateLimitError();
  }

  bucket.count++;
}

export async function enforceRateLimit(
  action: string,
  limit: number,
  windowMs = 60_000
) {
  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  checkRateLimit(`${action}:${ip}`, limit, windowMs, Date.now());
}
