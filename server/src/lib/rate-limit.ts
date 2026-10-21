// Owned by workstream B. In-memory sliding-window rate limiter keyed by an arbitrary string.
// Single-process only (matches the in-process job queue); state resets when the server restarts.

const windows = new Map<string, number[]>()
let lastSweep = 0
const SWEEP_INTERVAL_MS = 10 * 60 * 1000

export interface RateLimitResult { ok: boolean; retryAfterSeconds: number }

/**
 * Records one hit for `key` if fewer than `limit` hits happened within the last `windowMs`.
 * When the limit is reached nothing is recorded, `ok` is false and `retryAfterSeconds` says when the oldest hit expires.
 */
export function consume(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  sweep(now, windowMs)
  const hits = (windows.get(key) ?? []).filter((at) => now - at < windowMs)
  if (hits.length >= limit) {
    windows.set(key, hits)
    const oldest = hits[0] ?? now
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)) }
  }
  hits.push(now)
  windows.set(key, hits)
  return { ok: true, retryAfterSeconds: 0 }
}

/** Drops keys whose hits have all expired, so the map does not grow without bound. */
function sweep(now: number, windowMs: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return
  lastSweep = now
  for (const [key, hits] of windows) {
    if (!hits.some((at) => now - at < Math.max(windowMs, SWEEP_INTERVAL_MS))) windows.delete(key)
  }
}
