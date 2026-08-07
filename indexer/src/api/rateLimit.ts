import { NextFunction, Request, Response } from 'express'

/**
 * Fixed-window per-IP rate limit.
 *
 * Several endpoints fan a single request out into on-chain `readContract` calls
 * or full-table scans, and there was no ceiling on how fast anyone could ask.
 * In-process and per-instance, so it is a blunt-force cap rather than a quota —
 * enough to stop a single client from exhausting the RPC allowance.
 */
const WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = Number(process.env.RATE_LIMIT_PER_MINUTE) || 120

interface Window {
  count: number
  resetAt: number
}

const windows = new Map<string, Window>()

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now()
  const key = req.ip ?? 'unknown'
  const existing = windows.get(key)

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + WINDOW_MS })
    if (windows.size > 10_000) evictExpired(now)
    return next()
  }

  existing.count++
  if (existing.count > MAX_REQUESTS_PER_WINDOW) {
    res.setHeader('Retry-After', Math.ceil((existing.resetAt - now) / 1000))
    return res.status(429).json({ error: 'Too many requests' })
  }

  return next()
}

function evictExpired(now: number) {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key)
  }
}
