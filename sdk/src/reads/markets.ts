import type { Market } from '../types'

export async function getMarkets(
  indexerUrl: string,
  params?: { status?: 'OPEN' | 'SETTLED'; region?: string; limit?: number; offset?: number }
): Promise<Market[]> {
  const url = new URL(`${indexerUrl}/api/markets`)
  if (params?.status) url.searchParams.set('status', params.status)
  if (params?.region) url.searchParams.set('region', params.region)
  if (params?.limit) url.searchParams.set('limit', String(params.limit))
  if (params?.offset) url.searchParams.set('offset', String(params.offset))

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Failed to fetch markets: ${res.statusText}`)
  const data = await res.json()
  return data.markets || []
}

export async function getMarket(indexerUrl: string, address: string): Promise<Market> {
  const res = await fetch(`${indexerUrl}/api/markets/${address.toLowerCase()}`)
  if (!res.ok) throw new Error(`Market not found: ${address}`)
  return res.json()
}

export async function getMarketPositions(indexerUrl: string, marketAddress: string) {
  const res = await fetch(`${indexerUrl}/api/markets/${marketAddress.toLowerCase()}/positions`)
  if (!res.ok) throw new Error(`Failed to fetch positions for market: ${marketAddress}`)
  const data = await res.json()
  return data.positions || []
}
