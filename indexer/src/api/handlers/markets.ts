import { Request, Response } from 'express'
import { supabase } from '../../db/client'
import { parseChainId, parseEnum, parseInteger, parseShortString, requireAddress } from '../validate'
import { respondWithError } from '../errors'

/** The only values the watchers ever write to `markets.status`. */
const MARKET_STATUSES = ['OPEN', 'SETTLED'] as const

// GET /api/markets
export async function getMarkets(req: Request, res: Response) {
  try {
    const chainId = parseChainId(req.query.chainId)
    let query = supabase.from('markets').select('*').eq('chain_id', chainId).order('created_at', { ascending: false })

    if (req.query.status) {
      query = query.eq('status', parseEnum(req.query.status, MARKET_STATUSES, 'status'))
    }
    if (req.query.region) {
      query = query.eq('region_name', parseShortString(req.query.region, 'region'))
    }

    const offset = parseInteger(req.query.offset, { fallback: 0, min: 0, max: 100_000, name: 'offset' })
    const limit = parseInteger(req.query.limit, { fallback: 20, min: 1, max: 100, name: 'limit' })
    query = query.range(offset, offset + limit - 1)

    const { data, error } = await query
    if (error) throw error
    res.json({ markets: data || [] })
  } catch (err: unknown) {
    respondWithError(res, err, 'getMarkets', { markets: [] })
  }
}

// GET /api/markets/:address
export async function getMarket(req: Request, res: Response) {
  try {
    const address = requireAddress(req.params.address)
    const chainId = parseChainId(req.query.chainId)
    const { data, error } = await supabase
      .from('markets')
      .select('*, settlements(*)')
      .eq('contract_address', address)
      .eq('chain_id', chainId)
      .single()

    if (error || !data) return res.status(404).json({ error: 'Market not found' })
    res.json(data)
  } catch (err: unknown) {
    respondWithError(res, err, 'getMarket')
  }
}

// GET /api/markets/:address/positions
export async function getMarketPositions(req: Request, res: Response) {
  try {
    const address = requireAddress(req.params.address)
    const limit = parseInteger(req.query.limit, { fallback: 100, min: 1, max: 500, name: 'limit' })
    const { data, error } = await supabase
      .from('positions')
      .select('*')
      .eq('market_address', address)
      .order('minted_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    res.json({ positions: data || [] })
  } catch (err: unknown) {
    respondWithError(res, err, 'getMarketPositions', { positions: [] })
  }
}
