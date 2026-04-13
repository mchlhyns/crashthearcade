type Entry = { count: number; resetAt: number }

const store = new Map<string, Entry>()

// Prune expired entries periodically to prevent unbounded growth
let lastPrune = Date.now()
function maybePrune() {
  const now = Date.now()
  if (now - lastPrune < 60_000) return
  lastPrune = now
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key)
  }
}

/**
 * Returns true if the request is allowed, false if it exceeds the limit.
 * @param key     - unique identifier (e.g. "ip:route")
 * @param limit   - max requests per window
 * @param windowMs - window duration in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  maybePrune()
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= limit) return false
  entry.count++
  return true
}

/** Extract the best available client IP from a Next.js request */
export function getClientIp(req: Request): string {
  const forwarded = (req.headers as Headers).get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return 'unknown'
}
