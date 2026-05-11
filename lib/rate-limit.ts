/**
 * Simple in-memory rate limiter for server actions.
 * Suitable for ~100 users on a single Vercel instance.
 *
 * For multi-instance deployments, consider Upstash Redis rate limiting.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/** Clean stale entries periodically to prevent memory leaks */
let cleanupCounter = 0;
function cleanupStaleEntries() {
  cleanupCounter++;
  if (cleanupCounter < 100) return;
  cleanupCounter = 0;
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

/**
 * Check rate limit for a given user.
 * Throws if the user has exceeded the limit within the time window.
 *
 * @param userId - The user's unique identifier
 * @param limit - Maximum number of requests allowed (default: 30)
 * @param windowMs - Time window in milliseconds (default: 60000 = 1 minute)
 */
export function checkRateLimit(
  userId: string,
  limit = 30,
  windowMs = 60_000,
): void {
  cleanupStaleEntries();

  const now = Date.now();
  const entry = store.get(userId);

  if (!entry || entry.resetAt <= now) {
    // Start new window
    store.set(userId, { count: 1, resetAt: now + windowMs });
    return;
  }

  entry.count++;

  if (entry.count > limit) {
    throw new Error("คำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่");
  }
}
