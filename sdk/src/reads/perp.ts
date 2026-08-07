import {
  PerpMarket, PerpPosition, FundingHistoryItem, MarkPriceHistoryItem,
  TradeHistoryEntry, PerpMarketStatsData, OHLCCandle
} from '../types'
import { fetchJsonOr } from './http'

export async function getPerpMarkets(indexerUrl: string, chainId: number = 114): Promise<PerpMarket[]> {
  const data = await fetchJsonOr<{ markets?: PerpMarket[] }>(`${indexerUrl}/api/perp-markets?chainId=${chainId}`, {})
  return data.markets || []
}

export async function getPerpMarket(indexerUrl: string, address: string, chainId: number = 114): Promise<PerpMarket | null> {
  return fetchJsonOr<PerpMarket | null>(`${indexerUrl}/api/perp-markets/${address}?chainId=${chainId}`, null)
}

export async function getPerpMarketPositions(indexerUrl: string, address: string, chainId: number = 114): Promise<PerpPosition[]> {
  const data = await fetchJsonOr<{ positions?: PerpPosition[] }>(`${indexerUrl}/api/perp-markets/${address}/positions?chainId=${chainId}`, {})
  return data.positions || []
}

export async function getUserPerpPositions(indexerUrl: string, userAddress: string, chainId: number = 114): Promise<PerpPosition[]> {
  const data = await fetchJsonOr<{ positions?: PerpPosition[] }>(`${indexerUrl}/api/users/${userAddress}/perp-positions?chainId=${chainId}`, {})
  return data.positions || []
}

export async function getFundingHistory(indexerUrl: string, marketAddress: string, chainId: number = 114): Promise<FundingHistoryItem[]> {
  const data = await fetchJsonOr<{ history?: FundingHistoryItem[] }>(`${indexerUrl}/api/perp-markets/${marketAddress}/funding-history?chainId=${chainId}`, {})
  return data.history || []
}

export async function getMarkPriceHistory(
  indexerUrl: string,
  marketAddress: string,
  minutes = 60,
  chainId: number = 114
): Promise<MarkPriceHistoryItem[]> {
  const data = await fetchJsonOr<{ history?: MarkPriceHistoryItem[] }>(`${indexerUrl}/api/perp-markets/${marketAddress}/mark-price-history?minutes=${minutes}&chainId=${chainId}`, {})
  return data.history || []
}

export async function getTradeHistory(
  indexerUrl: string,
  marketAddress: string,
  chainId: number = 114,
  limit = 50,
  offset = 0
): Promise<TradeHistoryEntry[]> {
  const data = await fetchJsonOr<{ trades?: TradeHistoryEntry[] }>(`${indexerUrl}/api/perp-markets/${marketAddress}/trade-history?limit=${limit}&offset=${offset}&chainId=${chainId}`, {})
  return data.trades || []
}

export async function getPerpMarketStats(
  indexerUrl: string,
  marketAddress: string,
  chainId: number = 114
): Promise<PerpMarketStatsData | null> {
  return fetchJsonOr<PerpMarketStatsData | null>(`${indexerUrl}/api/perp-markets/${marketAddress}/stats?chainId=${chainId}`, null)
}

export async function getMarkPriceCandles(
  indexerUrl: string,
  marketAddress: string,
  interval = '5m',
  limit = 100,
  chainId: number = 114
): Promise<OHLCCandle[]> {
  const data = await fetchJsonOr<{ candles?: OHLCCandle[] }>(`${indexerUrl}/api/perp-markets/${marketAddress}/candles?interval=${interval}&limit=${limit}&chainId=${chainId}`, {})
  return data.candles || []
}
