import {
  PerpMarket, PerpPosition, FundingHistoryItem, MarkPriceHistoryItem,
  TradeHistoryEntry, PerpMarketStatsData, OHLCCandle
} from '../types'
import { fetchJson, isNotFound } from '../utils/http'

/**
 * Perp reads against the indexer.
 *
 * Every function here used to end in `catch { return [] }` / `catch { return
 * null }`, so a failing indexer looked exactly like a market with no history:
 * empty charts, an empty trade tape, "no positions" on a portfolio that held
 * some. Failures now propagate; the components that want a demo-data fallback
 * still get one from their own catch, but they can also say when they are
 * showing it because a read failed.
 *
 * `getPerpMarket` and `getPerpMarketStats` keep `null`, but only for a genuine
 * 404 — the one case where "nothing here" is the truth.
 */
export async function getPerpMarkets(indexerUrl: string, chainId: number = 114): Promise<PerpMarket[]> {
  const data = await fetchJson<{ markets?: PerpMarket[] }>(
    `${indexerUrl}/api/perp-markets?chainId=${chainId}`,
    'perp markets'
  )
  return data.markets || []
}

export async function getPerpMarket(indexerUrl: string, address: string, chainId: number = 114): Promise<PerpMarket | null> {
  try {
    return await fetchJson<PerpMarket>(
      `${indexerUrl}/api/perp-markets/${address}?chainId=${chainId}`,
      `perp market ${address}`
    )
  } catch (err) {
    if (isNotFound(err)) return null
    throw err
  }
}

export async function getPerpMarketPositions(indexerUrl: string, address: string, chainId: number = 114): Promise<PerpPosition[]> {
  const data = await fetchJson<{ positions?: PerpPosition[] }>(
    `${indexerUrl}/api/perp-markets/${address}/positions?chainId=${chainId}`,
    `positions for perp market ${address}`
  )
  return data.positions || []
}

export async function getUserPerpPositions(indexerUrl: string, userAddress: string, chainId: number = 114): Promise<PerpPosition[]> {
  const data = await fetchJson<{ positions?: PerpPosition[] }>(
    `${indexerUrl}/api/users/${userAddress}/perp-positions?chainId=${chainId}`,
    `perp positions for ${userAddress}`
  )
  return data.positions || []
}

export async function getFundingHistory(indexerUrl: string, marketAddress: string, chainId: number = 114): Promise<FundingHistoryItem[]> {
  const data = await fetchJson<{ history?: FundingHistoryItem[] }>(
    `${indexerUrl}/api/perp-markets/${marketAddress}/funding-history?chainId=${chainId}`,
    'funding history'
  )
  return data.history || []
}

export async function getMarkPriceHistory(
  indexerUrl: string,
  marketAddress: string,
  minutes = 60,
  chainId: number = 114
): Promise<MarkPriceHistoryItem[]> {
  const data = await fetchJson<{ history?: MarkPriceHistoryItem[] }>(
    `${indexerUrl}/api/perp-markets/${marketAddress}/mark-price-history?minutes=${minutes}&chainId=${chainId}`,
    'mark price history'
  )
  return data.history || []
}

export async function getTradeHistory(
  indexerUrl: string,
  marketAddress: string,
  chainId: number = 114,
  limit = 50,
  offset = 0
): Promise<TradeHistoryEntry[]> {
  const data = await fetchJson<{ trades?: TradeHistoryEntry[] }>(
    `${indexerUrl}/api/perp-markets/${marketAddress}/trade-history?limit=${limit}&offset=${offset}&chainId=${chainId}`,
    'trade history'
  )
  return data.trades || []
}

export async function getPerpMarketStats(
  indexerUrl: string,
  marketAddress: string,
  chainId: number = 114
): Promise<PerpMarketStatsData | null> {
  try {
    return await fetchJson<PerpMarketStatsData>(
      `${indexerUrl}/api/perp-markets/${marketAddress}/stats?chainId=${chainId}`,
      'perp market stats'
    )
  } catch (err) {
    if (isNotFound(err)) return null
    throw err
  }
}

export async function getMarkPriceCandles(
  indexerUrl: string,
  marketAddress: string,
  interval = '5m',
  limit = 100,
  chainId: number = 114
): Promise<OHLCCandle[]> {
  const data = await fetchJson<{ candles?: OHLCCandle[] }>(
    `${indexerUrl}/api/perp-markets/${marketAddress}/candles?interval=${interval}&limit=${limit}&chainId=${chainId}`,
    'mark price candles'
  )
  return data.candles || []
}
