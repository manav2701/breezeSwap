import { Request, Response } from 'express'
import { supabase } from '../../db/client'
import { fail } from '../respond'

export async function getAuditLog(req: Request, res: Response) {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100)
    const { data, error } = await supabase
      .from('protocol_events')
      .select('*')
      .order('occurred_at', { ascending: false })
      .limit(limit)

    // An audit log that answers a query failure with "no events" is worse than
    // no audit log at all, so the failure is reported rather than logged as a
    // warning and hidden behind an empty list.
    if (error) return fail(res, 'audit log query', error)

    return res.json({ events: data || [] })
  } catch (err) {
    return fail(res, 'audit log query', err)
  }
}
