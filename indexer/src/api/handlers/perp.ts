import { Request, Response } from 'express'
import { supabase } from '../../db/client'
import { getPublicClient } from '../../utils/chainClient'
import { parseChainId, parseEnum, parseInteger, requireAddress } from '../validate'
import { respondWithError } from '../errors'

const PerpMarketViewABI = [
  {
    inputs: [],
    name: "getMarkPrice",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "totalLongOpenInterest",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "totalShortOpenInterest",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "lastFundingSettledAt",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  }
] as const

const CANDLE_INTERVALS = ['5m', '15m', '1h'] as const
const CANDLE_BUCKET_MS: Record<(typeof CANDLE_INTERVALS)[number], number> = {
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000
}

export async function getPerpMarkets(req: Request, res: Response) {
  try {
    const chainId = parseChainId(req.query.chainId)
    const { data, error } = await supabase.from('perp_markets').select('*').eq('chain_id', chainId).order('created_at', { ascending: false })
    if (error) throw error
    return res.json({ markets: data || [] })
  } catch (err: unknown) {
    return respondWithError(res, err, 'getPerpMarkets')
  }
}

export async function getPerpMarket(req: Request, res: Response) {
  try {
    const address = requireAddress(req.params.address)
    const chainId = parseChainId(req.query.chainId)
    const { data, error } = await supabase.from('perp_markets').select('*').eq('contract_address', address).eq('chain_id', chainId).single()
    if (error) return res.status(404).json({ error: 'Perp market not found' })
    return res.json(data)
  } catch (err: unknown) {
    return respondWithError(res, err, 'getPerpMarket')
  }
}

export async function getPerpMarketPositions(req: Request, res: Response) {
  try {
    const address = requireAddress(req.params.address)
    const limit = parseInteger(req.query.limit, { fallback: 200, min: 1, max: 500, name: 'limit' })
    const { data, error } = await supabase
      .from('perp_positions')
      .select('*')
      .eq('market_address', address)
      .order('opened_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return res.json({ positions: data || [] })
  } catch (err: unknown) {
    return respondWithError(res, err, 'getPerpMarketPositions')
  }
}

export async function getFundingHistory(req: Request, res: Response) {
  try {
    const address = requireAddress(req.params.address)
    const { data, error } = await supabase
      .from('funding_history')
      .select('*')
      .eq('market_address', address)
      .order('settled_at', { ascending: false })
      .limit(50)
    if (error) throw error
    return res.json({ history: data || [] })
  } catch (err: unknown) {
    return respondWithError(res, err, 'getFundingHistory')
  }
}

export async function getMarkPriceHistory(req: Request, res: Response) {
  try {
    const address = requireAddress(req.params.address)
    const minutes = parseInteger(req.query.minutes, { fallback: 60, min: 1, max: 60 * 24 * 30, name: 'minutes' })
    const since = new Date(Date.now() - minutes * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('mark_price_history')
      .select('*')
      .eq('market_address', address)
      .gte('snapshotted_at', since)
      .order('snapshotted_at', { ascending: true })

    if (error) throw error
    return res.json({ history: data || [] })
  } catch (err: unknown) {
    return respondWithError(res, err, 'getMarkPriceHistory')
  }
}

export async function getUserPerpPositions(req: Request, res: Response) {
  try {
    const address = requireAddress(req.params.address)
    const limit = parseInteger(req.query.limit, { fallback: 200, min: 1, max: 500, name: 'limit' })
    const { data, error } = await supabase
      .from('perp_positions')
      .select('*')
      .eq('trader_address', address)
      .order('opened_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return res.json({ positions: data || [] })
  } catch (err: unknown) {
    return respondWithError(res, err, 'getUserPerpPositions')
  }
}

// GET /api/perp-markets/:address/trade-history?limit=50&offset=0&chainId=114
export async function getTradeHistory(req: Request, res: Response) {
  try {
    const address = requireAddress(req.params.address)
    const limit = parseInteger(req.query.limit, { fallback: 50, min: 1, max: 100, name: 'limit' })
    const offset = parseInteger(req.query.offset, { fallback: 0, min: 0, max: 100_000, name: 'offset' })

    const { data: positions, error } = await supabase
      .from('perp_positions')
      .select('*')
      .eq('market_address', address)
      .order('opened_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    const trades: any[] = []
    for (const pos of positions || []) {
      // 1. Open Event
      trades.push({
        id: `${pos.position_id}-open`,
        type: 'OPEN',
        timestamp: pos.opened_at,
        trader: pos.trader_address,
        side: pos.is_long ? 'LONG' : 'SHORT',
        size: (Number(pos.collateral || 0) * Number(pos.leverage || 1)).toString(),
        price: pos.entry_mark_price ? (Number(pos.entry_mark_price) / 1e18).toFixed(2) : '0.00',
        pnl: null,
        txHash: pos.open_tx_hash
      })

      // 2. Close or Liquidation Event
      if (pos.closed_at) {
        trades.push({
          id: `${pos.position_id}-close`,
          type: pos.was_liquidated ? 'LIQUIDATION' : 'CLOSE',
          timestamp: pos.closed_at,
          trader: pos.trader_address,
          side: pos.is_long ? 'LONG' : 'SHORT',
          size: (Number(pos.collateral || 0) * Number(pos.leverage || 1)).toString(),
          price: pos.entry_mark_price ? (Number(pos.entry_mark_price) / 1e18).toFixed(2) : '0.00',
          pnl: pos.realized_pnl ? (Number(pos.realized_pnl) / 1e18).toFixed(2) : '0.00',
          txHash: pos.close_tx_hash
        })
      }
    }

    trades.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return res.json({ trades: trades.slice(0, limit) })
  } catch (err: unknown) {
    return respondWithError(res, err, 'getTradeHistory')
  }
}

// GET /api/perp-markets/:address/stats?chainId=114
export async function getPerpMarketStats(req: Request, res: Response) {
  try {
    const address = requireAddress(req.params.address)
    const chainId = parseChainId(req.query.chainId)
    const client = getPublicClient(chainId)

    // 1. On-chain view queries using Promise.allSettled for fault tolerance
    let markPrice = '0'
    let oraclePrice = '0'
    let longOI = '0'
    let shortOI = '0'
    let lastFundingSettledAt = 0

    const results = await Promise.allSettled([
      client.readContract({ address: address as `0x${string}`, abi: PerpMarketViewABI, functionName: 'getMarkPrice' }),
      client.readContract({ address: address as `0x${string}`, abi: PerpMarketViewABI, functionName: 'totalLongOpenInterest' }),
      client.readContract({ address: address as `0x${string}`, abi: PerpMarketViewABI, functionName: 'totalShortOpenInterest' }),
      client.readContract({ address: address as `0x${string}`, abi: PerpMarketViewABI, functionName: 'lastFundingSettledAt' })
    ])

    if (results[0].status === 'fulfilled') markPrice = results[0].value.toString()
    oraclePrice = markPrice // default oraclePrice to markPrice
    if (results[1].status === 'fulfilled') longOI = results[1].value.toString()
    if (results[2].status === 'fulfilled') shortOI = results[2].value.toString()
    if (results[3].status === 'fulfilled') lastFundingSettledAt = Number(results[3].value)

    // 2. Funding history
    const { data: fundingRows } = await supabase
      .from('funding_history')
      .select('funding_rate')
      .eq('market_address', address)
      .order('settled_at', { ascending: false })
      .limit(1)

    const latestFundingBps = fundingRows && fundingRows.length > 0 ? Number(fundingRows[0].funding_rate || 0) : 0
    const currentFundingRate = (latestFundingBps / 10000).toFixed(4) // e.g. 0.0012 = 0.12%

    const fundingInterval = 900 // 15 mins
    const nextFundingTimestamp = lastFundingSettledAt > 0 ? lastFundingSettledAt + fundingInterval : Math.floor(Date.now() / 1000) + fundingInterval
    const nextFundingAt = new Date(nextFundingTimestamp * 1000).toISOString()

    // 3. OI Skew
    const numLong = Number(longOI) / 1e18
    const numShort = Number(shortOI) / 1e18
    const totalOI = numLong + numShort
    const oiSkewPercent = totalOI > 0 ? Math.round((numLong / totalOI) * 1000) / 10 : 50

    // 4. 24h Volume and Trade Count from DB
    const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    const { data: recentPositions } = await supabase
      .from('perp_positions')
      .select('collateral, leverage, opened_at')
      .eq('market_address', address)
      .gte('opened_at', since24h)

    let totalVolume24h = 0
    let tradeCount24h = 0

    for (const row of recentPositions || []) {
      tradeCount24h++
      const col = Number(row.collateral || 0) / 1e18
      const lev = Number(row.leverage || 1)
      totalVolume24h += col * lev
    }

    return res.json({
      markPrice: (Number(markPrice) / 1e18).toFixed(2),
      oraclePrice: (Number(oraclePrice) / 1e6).toFixed(2),
      currentFundingRate,
      nextFundingAt,
      fundingInterval,
      openInterestLong: (numLong).toFixed(2),
      openInterestShort: (numShort).toFixed(2),
      oiSkewPercent,
      totalVolume24h: totalVolume24h.toFixed(2),
      tradeCount24h
    })
  } catch (err: unknown) {
    return respondWithError(res, err, 'getPerpMarketStats')
  }
}

// GET /api/perp-markets/:address/candles?interval=5m&limit=100&chainId=114
export async function getCandles(req: Request, res: Response) {
  try {
    const address = requireAddress(req.params.address)
    const limit = parseInteger(req.query.limit, { fallback: 100, min: 1, max: 200, name: 'limit' })
    const interval = req.query.interval === undefined || req.query.interval === ''
      ? '5m'
      : parseEnum(req.query.interval, CANDLE_INTERVALS, 'interval')

    const bucketMs = CANDLE_BUCKET_MS[interval]

    const { data: rows, error } = await supabase
      .from('mark_price_history')
      .select('mark_price, snapshotted_at')
      .eq('market_address', address)
      .order('snapshotted_at', { ascending: true })
      .limit(1000)

    if (error || !rows || rows.length === 0) {
      return res.json({ candles: [] })
    }

    // Group into time buckets
    const bucketMap: Record<number, number[]> = {}
    for (const r of rows) {
      const timeMs = new Date(r.snapshotted_at).getTime()
      const bucketKey = Math.floor(timeMs / bucketMs) * bucketMs
      if (!bucketMap[bucketKey]) bucketMap[bucketKey] = []
      bucketMap[bucketKey].push(Number(r.mark_price) / 1e18)
    }

    const candles = Object.entries(bucketMap).map(([timeKey, prices]) => {
      const timestamp = Math.floor(Number(timeKey) / 1000)
      const open = prices[0]
      const close = prices[prices.length - 1]
      const high = Math.max(...prices)
      const low = Math.min(...prices)
      return { timestamp, open, high, low, close }
    }).slice(-limit)

    return res.json({ candles })
  } catch (err: unknown) {
    return respondWithError(res, err, 'getCandles')
  }
}
