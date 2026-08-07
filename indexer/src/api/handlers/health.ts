import { Request, Response } from 'express'
import { supabase } from '../../db/client'
import { logger } from '../../utils/logger'
import { errorMessage } from '../../utils/errors'

/**
 * Report whether the indexer can actually reach its database.
 *
 * This used to answer `200 {"status":"ok"}` whatever happened, with a
 * `note: "Database connecting"` that no platform health check reads. A probe
 * that cannot fail is not a health check, so an indexer with a broken database
 * URL stayed "healthy" indefinitely.
 */
export async function healthHandler(req: Request, res: Response) {
  try {
    const { data, error } = await supabase
      .from('indexer_state')
      .select('*')
      .eq('id', 'coston2_main')
      .single()

    // No state row yet is expected on a fresh deployment: the database answered,
    // which is what this endpoint reports on.
    if (error && error.code !== 'PGRST116') throw error

    res.json({
      status: 'ok',
      lastIndexedBlock: data?.last_block ?? 0,
      updatedAt: data?.updated_at ?? null
    })
  } catch (err) {
    logger.error('Health check failed', { err: errorMessage(err) })
    res.status(503).json({
      status: 'degraded',
      lastIndexedBlock: null,
      updatedAt: null,
      error: 'Database unreachable'
    })
  }
}
