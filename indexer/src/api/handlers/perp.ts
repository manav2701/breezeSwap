import { Request, Response } from 'express'
import { supabase } from '../../db/client'
import { logger } from '../../utils/logger'

export async function getPerpMarkets(req: Request, res: Response) {
  try {
    const { data, error } = await supabase.from('perp_markets').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return res.json({ markets: data || [] })
  } catch (err: any) {
    logger.error('getPerpMarkets error:', err)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}

export async function getPerpMarket(req: Request, res: Response) {
  try {
    const address = req.params.address?.toLowerCase()
    const { data, error } = await supabase.from('perp_markets').select('*').eq('contract_address', address).single()
    if (error) return res.status(404).json({ error: 'Perp market not found' })
    return res.json(data)
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}

export async function getPerpMarketPositions(req: Request, res: Response) {
  try {
    const address = req.params.address?.toLowerCase()
    const { data, error } = await supabase
      .from('perp_positions')
      .select('*')
      .eq('market_address', address)
      .order('opened_at', { ascending: false })
    if (error) throw error
    return res.json({ positions: data || [] })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}

export async function getFundingHistory(req: Request, res: Response) {
  try {
    const address = req.params.address?.toLowerCase()
    const { data, error } = await supabase
      .from('funding_history')
      .select('*')
      .eq('market_address', address)
      .order('settled_at', { ascending: false })
      .limit(50)
    if (error) throw error
    return res.json({ history: data || [] })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}

export async function getMarkPriceHistory(req: Request, res: Response) {
  try {
    const address = req.params.address?.toLowerCase()
    const minutes = Number(req.query.minutes) || 60
    const since = new Date(Date.now() - minutes * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('mark_price_history')
      .select('*')
      .eq('market_address', address)
      .gte('snapshotted_at', since)
      .order('snapshotted_at', { ascending: true })

    if (error) throw error
    return res.json({ history: data || [] })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}

export async function getUserPerpPositions(req: Request, res: Response) {
  try {
    const address = req.params.address?.toLowerCase()
    const { data, error } = await supabase
      .from('perp_positions')
      .select('*')
      .eq('trader_address', address)
      .order('opened_at', { ascending: false })

    if (error) throw error
    return res.json({ positions: data || [] })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}
