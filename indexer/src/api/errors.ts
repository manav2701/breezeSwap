import { Response } from 'express'
import { BadRequestError } from './validate'
import { logger } from '../utils/logger'

/**
 * Single exit point for handler failures.
 *
 * Handlers previously answered with `err.message`, which returned raw Supabase
 * and viem errors to the caller — those carry table names, column names, SQL
 * hints and the configured RPC URL. Details now go to the log; the client gets
 * a fixed string.
 */
export function respondWithError(res: Response, err: unknown, scope: string, emptyBody?: object) {
  if (err instanceof BadRequestError) {
    return res.status(400).json({ error: err.message })
  }

  logger.error(`${scope} failed`, { error: err instanceof Error ? err.message : String(err) })

  if (emptyBody) return res.json(emptyBody)
  return res.status(500).json({ error: 'Internal server error' })
}
