import type { Response } from 'express'
import { logger } from '../utils/logger'
import { errorMessage } from '../utils/errors'

/**
 * Report a failed request as a failure.
 *
 * Several handlers used to answer a database error with `200 {"markets": []}`.
 * A client cannot tell that apart from "there are no markets", so an outage
 * rendered as an empty, healthy-looking app and never appeared in any log. Every
 * handler now logs the cause server-side and answers 500, which is what the SDK
 * and the UI already treat as retryable.
 *
 * The cause itself stays in the log. A Postgrest error carries table names, and
 * an RPC error carries the node URL, neither of which belongs in a response to
 * an unauthenticated caller.
 */
export function fail(res: Response, operation: string, cause: unknown): Response {
  logger.error(`${operation} failed`, { err: errorMessage(cause) })
  return res.status(500).json({ error: `${operation} failed` })
}
