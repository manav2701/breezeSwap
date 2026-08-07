import { TradeHistoryEntry } from '../types'
import { fetchJson } from '../utils/http'

/**
 * Protocol-level aggregates.
 *
 * These used to answer every failure with `'0'` or `[]`, which put a confident
 * "0 mUSDT collected" on the protocol page whenever the indexer was unreachable.
 * A zero fee total and an unknown fee total are different claims and only one of
 * them is safe to render.
 */
export async function getTotalFeesCollected(indexerUrl: string, chainId: number = 114): Promise<string> {
  const data = await fetchJson<{ totalFeesWei?: string }>(
    `${indexerUrl}/api/protocol/fees/total?chainId=${chainId}`,
    'total fees'
  )
  return data.totalFeesWei || '0'
}

export async function getInsuranceFundBalance(indexerUrl: string, chainId: number = 114): Promise<string> {
  const data = await fetchJson<{ balanceWei?: string }>(
    `${indexerUrl}/api/protocol/insurance-fund?chainId=${chainId}`,
    'insurance fund balance'
  )
  return data.balanceWei || '0'
}

export async function getProtocolTreasuryBalance(indexerUrl: string, chainId: number = 114): Promise<string> {
  const data = await fetchJson<{ balanceWei?: string }>(
    `${indexerUrl}/api/protocol/treasury?chainId=${chainId}`,
    'treasury balance'
  )
  return data.balanceWei || '0'
}

export async function getGlobalTradeHistory(
  indexerUrl: string,
  chainId: number = 114,
  limit = 50
): Promise<TradeHistoryEntry[]> {
  const data = await fetchJson<{ trades?: TradeHistoryEntry[] }>(
    `${indexerUrl}/api/protocol/trade-history?limit=${limit}&chainId=${chainId}`,
    'global trade history'
  )
  return data.trades || []
}
