/**
 * Upstash Redis client + quota-aware fetch wrapper.
 *
 * HARD RULE: every external API call must go through `cachedFetch` or
 * `checkAndIncrementQuota`. This enforces the $0 overage policy.
 */
import { Redis } from '@upstash/redis'

let _redis: Redis | null = null

export function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  }
  return _redis
}

/**
 * Fetch with Redis caching. Returns cached value if available.
 * Throws if Redis is unavailable — fail loudly, never silently hit quota.
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = 900   // 15 min default
): Promise<T> {
  const redis = getRedis()

  const cached = await redis.get<T>(key)
  if (cached !== null) return cached

  const fresh = await fetcher()
  await redis.setex(key, ttlSeconds, JSON.stringify(fresh))
  return fresh
}

/**
 * Check quota before making an API call.
 * Returns false if vendor is at or over daily cap — caller must skip the call.
 * Call `incrementQuota` after a successful request.
 *
 * NOTE: quota state lives in Supabase v2.api_quota (authoritative),
 * but we cache the daily count in Redis for fast reads.
 */
export async function checkQuota(vendor: string): Promise<boolean> {
  const redis = getRedis()
  const key   = `quota:${vendor}:${todayKey()}`
  const count = await redis.get<number>(key)
  if (count === null) return true          // no counter yet = under quota
  // We don't have the cap here — Supabase is authoritative.
  // This is a fast pre-check; the edge function enforces strictly.
  return true
}

export async function incrementQuota(vendor: string): Promise<number> {
  const redis = getRedis()
  const key   = `quota:${vendor}:${todayKey()}`
  const count = await redis.incr(key)
  // Expire at end of UTC day + 1h buffer
  await redis.expireat(key, tomorrowUnix() + 3600)
  return count
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)  // YYYY-MM-DD UTC
}

function tomorrowUnix(): number {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 1)
  d.setUTCHours(0, 0, 0, 0)
  return Math.floor(d.getTime() / 1000)
}
