import { Request, Response } from 'express'
import { supabase } from '../../db/client'
import { fail } from '../respond'

// GET /api/users/:address/positions
export async function getUserPositions(req: Request, res: Response) {
  try {
    const address = String(req.params.address).toLowerCase()
    const { data, error } = await supabase
      .from('positions')
      .select('*, markets(region_name, weather_variable, expiry_timestamp, status)')
      .eq('holder_address', address)
      .order('minted_at', { ascending: false })

    // Answering an outage with an empty list told a trader they held no
    // positions, which is the one wrong answer this endpoint must never give.
    if (error) return fail(res, 'user positions query', error)
    res.json({ positions: data || [] })
  } catch (err) {
    fail(res, 'user positions query', err)
  }
}
