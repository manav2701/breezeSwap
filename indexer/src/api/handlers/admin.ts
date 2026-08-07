import { Request, Response } from 'express'
import { supabase } from '../../db/client'
import { parseInteger } from '../validate'
import { respondWithError } from '../errors'

export async function getAuditLog(req: Request, res: Response) {
  try {
    const limit = parseInteger(req.query.limit, { fallback: 50, min: 1, max: 100, name: 'limit' })
    const { data, error } = await supabase
      .from('protocol_events')
      .select('*')
      .order('occurred_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return res.json({ events: data || [] })
  } catch (err: unknown) {
    return respondWithError(res, err, 'getAuditLog', { events: [] })
  }
}
