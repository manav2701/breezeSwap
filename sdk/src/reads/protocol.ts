import { TradeHistoryEntry } from '../types'
import { fetchJsonOr } from './http'

export async function getTotalFeesCollected(indexerUrl: string, chainId: number = 114): Promise<string> {
  const data = await fetchJsonOr<{ totalFeesWei?: string }>(`${indexerUrl}/api/protocol/fees/total?chainId=${chainId}`, {})
  return data.totalFeesWei || '0'
}

export async function getInsuranceFundBalance(indexerUrl: string, chainId: number = 114): Promise<string> {
  const data = await fetchJsonOr<{ balanceWei?: string }>(`${indexerUrl}/api/protocol/insurance-fund?chainId=${chainId}`, {})
  return data.balanceWei || '0'
}

export async function getProtocolTreasuryBalance(indexerUrl: string, chainId: number = 114): Promise<string> {
  const data = await fetchJsonOr<{ balanceWei?: string }>(`${indexerUrl}/api/protocol/treasury?chainId=${chainId}`, {})
  return data.balanceWei || '0'
}

export async function getGlobalTradeHistory(
  indexerUrl: string,
  chainId: number = 114,
  limit = 50
): Promise<TradeHistoryEntry[]> {
  const data = await fetchJsonOr<{ trades?: TradeHistoryEntry[] }>(`${indexerUrl}/api/protocol/trade-history?limit=${limit}&chainId=${chainId}`, {})
  return data.trades || []
}
