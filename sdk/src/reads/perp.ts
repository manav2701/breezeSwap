import {
  PerpMarket, PerpPosition, FundingHistoryItem, MarkPriceHistoryItem,
  TradeHistoryEntry, PerpMarketStatsData, OHLCCandle
} from '../types'

export async function getPerpMarkets(indexerUrl: string, chainId: number = 114): Promise<PerpMarket[]> {
  try {
    const res = await fetch(`${indexerUrl}/api/perp-markets?chainId=${chainId}`)
    if (!res.ok) throw new Error('Failed to fetch perp markets')
    const data = await res.json()
    return data.markets || []
  } catch (err) {
    console.warn('getPerpMarkets error:', err)
    return []
  }
}

export async function getPerpMarket(indexerUrl: string, address: string, chainId: number = 114): Promise<PerpMarket | null> {
  try {
    const res = await fetch(`${indexerUrl}/api/perp-markets/${address}?chainId=${chainId}`)
    if (!res.ok) return null
    return await res.json()
  } catch (err) {
    return null
  }
}

export async function getPerpMarketPositions(indexerUrl: string, address: string, chainId: number = 114): Promise<PerpPosition[]> {
  try {
    const res = await fetch(`${indexerUrl}/api/perp-markets/${address}/positions?chainId=${chainId}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.positions || []
  } catch (err) {
    return []
  }
}

export async function getUserPerpPositions(indexerUrl: string, userAddress: string, chainId: number = 114): Promise<PerpPosition[]> {
  try {
    const res = await fetch(`${indexerUrl}/api/users/${userAddress}/perp-positions?chainId=${chainId}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.positions || []
  } catch (err) {
    return []
  }
}

export async function getFundingHistory(indexerUrl: string, marketAddress: string, chainId: number = 114): Promise<FundingHistoryItem[]> {
  try {
    const res = await fetch(`${indexerUrl}/api/perp-markets/${marketAddress}/funding-history?chainId=${chainId}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.history || []
  } catch (err) {
    return []
  }
}

export async function getMarkPriceHistory(
  indexerUrl: string,
  marketAddress: string,
  minutes = 60,
  chainId: number = 114
): Promise<MarkPriceHistoryItem[]> {
  try {
    const res = await fetch(`${indexerUrl}/api/perp-markets/${marketAddress}/mark-price-history?minutes=${minutes}&chainId=${chainId}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.history || []
  } catch (err) {
    return []
  }
}

export async function getTradeHistory(
  indexerUrl: string,
  marketAddress: string,
  chainId: number = 114,
  limit = 50,
  offset = 0
): Promise<TradeHistoryEntry[]> {
  try {
    const res = await fetch(`${indexerUrl}/api/perp-markets/${marketAddress}/trade-history?limit=${limit}&offset=${offset}&chainId=${chainId}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.trades || []
  } catch (err) {
    return []
  }
}

export async function getPerpMarketStats(
  indexerUrl: string,
  marketAddress: string,
  chainId: number = 114
): Promise<PerpMarketStatsData | null> {
  try {
    const res = await fetch(`${indexerUrl}/api/perp-markets/${marketAddress}/stats?chainId=${chainId}`)
    if (!res.ok) return null
    return await res.json()
  } catch (err) {
    return null
  }
}

export async function getMarkPriceCandles(
  indexerUrl: string,
  marketAddress: string,
  interval = '5m',
  limit = 100,
  chainId: number = 114
): Promise<OHLCCandle[]> {
  try {
    const res = await fetch(`${indexerUrl}/api/perp-markets/${marketAddress}/candles?interval=${interval}&limit=${limit}&chainId=${chainId}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.candles || []
  } catch (err) {
    return []
  }
}
