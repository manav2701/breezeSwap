import { Request, Response } from 'express'
import { supabase } from '../../db/client'
import { fail } from '../respond'

// GET /api/markets
export async function getMarkets(req: Request, res: Response) {
  try {
    const chainId = Number(req.query.chainId ?? 114)
    let query = supabase.from('markets').select('*').eq('chain_id', chainId).order('created_at', { ascending: false })

    if (req.query.status) {
      query = query.eq('status', String(req.query.status).toUpperCase())
    }
    if (req.query.region) {
      query = query.eq('region_name', String(req.query.region))
    }

    const offset = Number(req.query.offset ?? 0)
    const limit = Number(req.query.limit ?? 20)
    query = query.range(offset, offset + limit - 1)

    const { data, error } = await query
    if (error) return fail(res, 'markets query', error)
    res.json({ markets: data || [] })
  } catch (err) {
    fail(res, 'markets query', err)
  }
}

// GET /api/markets/:address
export async function getMarket(req: Request, res: Response) {
  try {
    const address = String(req.params.address).toLowerCase()
    const chainId = Number(req.query.chainId ?? 114)
    const { data, error } = await supabase
      .from('markets')
      .select('*, settlements(*)')
      .eq('contract_address', address)
      .eq('chain_id', chainId)
      .single()

    // `.single()` reports "no rows" as an error too, so only that code is a
    // genuine 404 — anything else is the database failing and must not be
    // dressed up as a missing market.
    if (error) {
      if (error.code === 'PGRST116') return res.status(404).json({ error: 'Market not found' })
      return fail(res, 'market query', error)
    }
    if (!data) return res.status(404).json({ error: 'Market not found' })
    res.json(data)
  } catch (err) {
    fail(res, 'market query', err)
  }
}

// GET /api/markets/:address/positions
export async function getMarketPositions(req: Request, res: Response) {
  try {
    const address = String(req.params.address).toLowerCase()
    const { data, error } = await supabase
      .from('positions')
      .select('*')
      .eq('market_address', address)
      .order('minted_at', { ascending: false })

    if (error) return fail(res, 'market positions query', error)
    res.json({ positions: data || [] })
  } catch (err) {
    fail(res, 'market positions query', err)
  }
}
