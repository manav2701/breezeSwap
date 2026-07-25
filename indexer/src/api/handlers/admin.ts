import { Request, Response } from 'express'
import { supabase } from '../../db/client'
import { logger } from '../../utils/logger'

export async function getAuditLog(req: Request, res: Response) {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100)
    const { data, error } = await supabase
      .from('protocol_events')
      .select('*')
      .order('occurred_at', { ascending: false })
      .limit(limit)

    if (error) {
      // If table doesn't exist yet or DB error occurs, return empty list gracefully
      logger.warn('Audit log query returned error:', error.message)
      return res.json({ events: [] })
    }

    return res.json({ events: data || [] })
  } catch (err: any) {
    logger.error('Audit log endpoint error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
