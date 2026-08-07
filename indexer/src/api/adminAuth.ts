import { NextFunction, Request, Response } from 'express'
import { timingSafeEqual } from 'node:crypto'
import { logger } from '../utils/logger'

/**
 * Shared-secret guard for `/api/admin/*`.
 *
 * The admin routes were reachable by anyone who knew the URL. Set `ADMIN_API_KEY`
 * in the service environment and send it as `Authorization: Bearer <key>` or
 * `X-Admin-Api-Key: <key>`.
 *
 * With no key configured the routes are refused rather than served openly, so a
 * deployment that forgets the variable fails closed.
 */
export function requireAdminKey(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.ADMIN_API_KEY

  if (!expected) {
    logger.warn('Admin route refused: ADMIN_API_KEY is not configured', { path: req.path })
    return res.status(503).json({ error: 'Admin API is not configured' })
  }

  const header = req.get('authorization')
  const presented = header?.toLowerCase().startsWith('bearer ')
    ? header.slice('bearer '.length).trim()
    : req.get('x-admin-api-key')?.trim()

  if (!presented || !constantTimeEquals(presented, expected)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  return next()
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  // `timingSafeEqual` throws on length mismatch, which would itself leak length.
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}
