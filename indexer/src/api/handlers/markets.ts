import { Request, Response } from 'express'
import { supabase } from '../../db/client'

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
    if (error) return res.json({ markets: [] })
    res.json({ markets: data || [] })
  } catch (err: any) {
    res.json({ markets: [] })
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

    if (error || !data) return res.status(404).json({ error: 'Market not found' })
    res.json(data)
  } catch (err: any) {
    res.status(404).json({ error: 'Market not found' })
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

    if (error) return res.json({ positions: [] })
    res.json({ positions: data || [] })
  } catch (err: any) {
    res.json({ positions: [] })
  }
}
