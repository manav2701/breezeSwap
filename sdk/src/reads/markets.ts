import type { Market } from '../types'

export function mapMarketFromDB(item: any): Market {
  if (!item) return item
  const rawLow = item.threshold_low ?? item.thresholdLow ?? 0
  const rawHigh = item.threshold_high ?? item.thresholdHigh ?? null
  const rawFinal = item.final_oracle_value ?? item.finalOracleValue ?? null

  return {
    contractAddress: item.contract_address || item.contractAddress || '',
    chainId: item.chain_id || item.chainId || 114,
    regionId: item.region_id || item.regionId || '',
    regionName: item.region_name || item.regionName || null,
    weatherVariable: item.weather_variable || item.weatherVariable || 'RAINFALL',
    payoffType: item.payoff_type || item.payoffType || 'CAPPED',
    thresholdLow: typeof rawLow === 'number' ? rawLow : Number(rawLow) / 1e6,
    thresholdHigh: rawHigh !== null && rawHigh !== undefined ? (typeof rawHigh === 'number' ? rawHigh : Number(rawHigh) / 1e6) : null,
    expiryTimestamp: item.expiry_timestamp || item.expiryTimestamp || '',
    collateralToken: item.collateral_token || item.collateralToken || '',
    status: item.status || 'OPEN',
    finalOracleValue: rawFinal !== null && rawFinal !== undefined ? (typeof rawFinal === 'number' ? rawFinal : Number(rawFinal) / 1e6) : null,
    longPayoutRatio: item.long_payout_ratio !== undefined ? (item.long_payout_ratio !== null ? Number(item.long_payout_ratio) : null) : (item.longPayoutRatio ?? null),
    shortPayoutRatio: item.short_payout_ratio !== undefined ? (item.short_payout_ratio !== null ? Number(item.short_payout_ratio) : null) : (item.shortPayoutRatio ?? null),
    settledAt: item.settled_at || item.settledAt || null,
    createdAt: item.created_at || item.createdAt || '',
    blockNumber: item.block_number || item.blockNumber || 0,
    txHash: item.tx_hash || item.txHash || ''
  }
}

export async function getMarkets(
  indexerUrl: string,
  chainId: number = 114,
  params?: { status?: 'OPEN' | 'SETTLED'; region?: string; limit?: number; offset?: number }
): Promise<Market[]> {
  const url = new URL(`${indexerUrl}/api/markets`)
  url.searchParams.set('chainId', String(chainId))
  if (params?.status) url.searchParams.set('status', params.status)
  if (params?.region) url.searchParams.set('region', params.region)
  if (params?.limit) url.searchParams.set('limit', String(params.limit))
  if (params?.offset) url.searchParams.set('offset', String(params.offset))

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Failed to fetch markets: ${res.statusText}`)
  const data = await res.json()
  return (data.markets || []).map(mapMarketFromDB)
}

export async function getMarket(indexerUrl: string, address: string, chainId: number = 114): Promise<Market> {
  const res = await fetch(`${indexerUrl}/api/markets/${address.toLowerCase()}?chainId=${chainId}`)
  if (!res.ok) throw new Error(`Market not found: ${address}`)
  const data = await res.json()
  return mapMarketFromDB(data)
}

export async function getMarketPositions(indexerUrl: string, marketAddress: string, chainId: number = 114) {
  const res = await fetch(`${indexerUrl}/api/markets/${marketAddress.toLowerCase()}/positions?chainId=${chainId}`)
  if (!res.ok) throw new Error(`Failed to fetch positions for market: ${marketAddress}`)
  const data = await res.json()
  return data.positions || []
}
