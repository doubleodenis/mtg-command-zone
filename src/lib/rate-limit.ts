/**
 * Fixed-window rate limiter for Server Actions.
 *
 * In-memory, per-server-instance — fine for a single-region beta launch
 * where abuse just needs a speed bump, not airtight enforcement. Counts
 * reset on redeploy and aren't shared across instances. If traffic grows
 * enough to run multiple instances or need durable limits, swap the store
 * for Upstash Redis (`@upstash/ratelimit`) behind this same `checkRateLimit`
 * signature.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * @param key - Unique identifier for the caller + action, e.g. `${userId}:createMatch`
 * @param limit - Max allowed calls within the window
 * @param windowMs - Window size in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}
