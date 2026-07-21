import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { logger } from "@/lib/logger";

// Rate limiting is opt-in based on env config: without UPSTASH_REDIS_REST_URL /
// UPSTASH_REDIS_REST_TOKEN set, every check below no-ops (never blocks a request).
// This keeps the app fully functional before Upstash is provisioned, and lets
// individual routes call `checkRateLimit` unconditionally without a config check.

let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

const limiters = new Map<string, Ratelimit>();

function getLimiter(bucket: string, limit: number, windowSeconds: number): Ratelimit | null {
  const client = getRedis();
  if (!client) return null;
  const key = `${bucket}:${limit}:${windowSeconds}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: client,
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
      prefix: `bloompilot:ratelimit:${bucket}`,
      analytics: false,
    });
    limiters.set(key, limiter);
  }
  return limiter;
}

export type RateLimitResult = { limited: false } | { limited: true; retryAfterSeconds: number };

/**
 * Checks and consumes one request against a sliding-window limit for `identity`
 * (typically a user id or IP) in the given `bucket`. No-ops (never limits) if
 * Upstash isn't configured, so this is always safe to call.
 */
export async function checkRateLimit(
  bucket: string,
  identity: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const limiter = getLimiter(bucket, limit, windowSeconds);
  if (!limiter) return { limited: false };

  try {
    const result = await limiter.limit(identity);
    if (result.success) return { limited: false };
    const retryAfterSeconds = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
    logger.warn("rate_limit_exceeded", { bucket, identity, limit, windowSeconds, retryAfterSeconds });
    return { limited: true, retryAfterSeconds };
  } catch (error) {
    // Fail open: a Redis outage should not take down the API.
    logger.error("rate_limit_check_failed", {
      bucket, error: error instanceof Error ? error.message : String(error),
    });
    return { limited: false };
  }
}
