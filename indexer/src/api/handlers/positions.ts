import { Request, Response } from 'express'
import { supabase } from '../../db/client'

// GET /api/users/:address/positions
export async function getUserPositions(req: Request, res: Response) {
  try {
    const address = String(req.params.address).toLowerCase()
    const { data, error } = await supabase
      .from('positions')
      .select('*, markets(region_name, weather_variable, expiry_timestamp, status)')
      .eq('holder_address', address)
      .order('minted_at', { ascending: false })

    if (error) return res.json({ positions: [] })
    res.json({ positions: data || [] })
  } catch (err: any) {
    res.json({ positions: [] })
  }
}
