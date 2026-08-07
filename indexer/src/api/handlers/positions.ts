import { Request, Response } from 'express'
import { supabase } from '../../db/client'
import { parseInteger, requireAddress } from '../validate'
import { respondWithError } from '../errors'

// GET /api/users/:address/positions
export async function getUserPositions(req: Request, res: Response) {
  try {
    const address = requireAddress(req.params.address)
    const limit = parseInteger(req.query.limit, { fallback: 200, min: 1, max: 500, name: 'limit' })
    const { data, error } = await supabase
      .from('positions')
      .select('*, markets(region_name, weather_variable, expiry_timestamp, status)')
      .eq('holder_address', address)
      .order('minted_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    res.json({ positions: data || [] })
  } catch (err: unknown) {
    respondWithError(res, err, 'getUserPositions', { positions: [] })
  }
}
