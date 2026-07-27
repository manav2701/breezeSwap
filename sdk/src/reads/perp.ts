import { PerpMarket, PerpPosition, FundingHistoryItem, MarkPriceHistoryItem } from '../types'

export async function getPerpMarkets(indexerUrl: string): Promise<PerpMarket[]> {
  try {
    const res = await fetch(`${indexerUrl}/api/perp-markets`)
    if (!res.ok) throw new Error('Failed to fetch perp markets')
    const data = await res.json()
    return data.markets || []
  } catch (err) {
    console.warn('getPerpMarkets error:', err)
    return []
  }
}

export async function getPerpMarket(indexerUrl: string, address: string): Promise<PerpMarket | null> {
  try {
    const res = await fetch(`${indexerUrl}/api/perp-markets/${address}`)
    if (!res.ok) return null
    return await res.json()
  } catch (err) {
    return null
  }
}

export async function getPerpMarketPositions(indexerUrl: string, address: string): Promise<PerpPosition[]> {
  try {
    const res = await fetch(`${indexerUrl}/api/perp-markets/${address}/positions`)
    if (!res.ok) return []
    const data = await res.json()
    return data.positions || []
  } catch (err) {
    return []
  }
}

export async function getUserPerpPositions(indexerUrl: string, userAddress: string): Promise<PerpPosition[]> {
  try {
    const res = await fetch(`${indexerUrl}/api/users/${userAddress}/perp-positions`)
    if (!res.ok) return []
    const data = await res.json()
    return data.positions || []
  } catch (err) {
    return []
  }
}

export async function getFundingHistory(indexerUrl: string, marketAddress: string): Promise<FundingHistoryItem[]> {
  try {
    const res = await fetch(`${indexerUrl}/api/perp-markets/${marketAddress}/funding-history`)
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
  minutes = 60
): Promise<MarkPriceHistoryItem[]> {
  try {
    const res = await fetch(`${indexerUrl}/api/perp-markets/${marketAddress}/mark-price-history?minutes=${minutes}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.history || []
  } catch (err) {
    return []
  }
}
