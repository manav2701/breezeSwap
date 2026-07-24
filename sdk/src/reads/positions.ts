import type { Position } from '../types'
import { mapMarketFromDB } from './markets'

export function mapPositionFromDB(item: any): Position {
  if (!item) return item
  return {
    id: item.id || '',
    marketAddress: item.market_address || item.marketAddress || '',
    tokenId: item.token_id || item.tokenId || '',
    holderAddress: item.holder_address || item.holderAddress || '',
    side: item.side || 'LONG',
    collateralAsset: item.collateral_asset || item.collateralAsset || 'usdt',
    collateralAmount: item.collateral_amount || item.collateralAmount || '0',
    mintedAt: item.minted_at || item.mintedAt || '',
    blockNumber: item.block_number || item.blockNumber || 0,
    txHash: item.tx_hash || item.txHash || '',
    redeemed: !!item.redeemed,
    redeemedAmount: item.redeemed_amount || item.redeemedAmount || null,
    redeemedAt: item.redeemed_at || item.redeemedAt || null,
    redeemTxHash: item.redeem_tx_hash || item.redeemTxHash || null,
    market: item.markets ? mapMarketFromDB(item.markets) : (item.market ? mapMarketFromDB(item.market) : undefined)
  }
}

export async function getUserPositions(
  indexerUrl: string,
  walletAddress: string
): Promise<Position[]> {
  const res = await fetch(`${indexerUrl}/api/users/${walletAddress.toLowerCase()}/positions`)
  if (!res.ok) throw new Error(`Failed to fetch positions for user: ${walletAddress}`)
  const data = await res.json()
  return (data.positions || []).map(mapPositionFromDB)
}
