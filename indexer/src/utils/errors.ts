/**
 * Error helpers shared by the watchers, the backfill and the API.
 *
 * Two failure modes are easy to write by accident in this codebase and both are
 * invisible in production:
 *
 *  1. Supabase does not throw. `insert`/`update`/`upsert` resolve with an
 *     `{ error }` field, so ignoring the return value turns a rejected write
 *     into a no-op that logs a success line immediately afterwards.
 *  2. `catch (err: any)` followed by `err.message` throws a second time when
 *     something non-`Error` is thrown, which replaces the original failure with
 *     a `TypeError` far from its source.
 */

import type { PostgrestError } from '@supabase/supabase-js'

/** Extract a message from an unknown thrown value without assuming its shape. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

/**
 * Throw when a Supabase write returned an error.
 *
 * Callers pass the `{ error }` they already destructured; the thrown error
 * carries the operation name so the log line identifies which write failed
 * rather than only that "something" did.
 */
export function assertWritten(
  operation: string,
  error: PostgrestError | null,
  context?: Record<string, unknown>
): void {
  if (!error) return
  const suffix = context ? ` ${JSON.stringify(context)}` : ''
  throw new Error(`${operation} failed: ${error.message}${suffix}`)
}
