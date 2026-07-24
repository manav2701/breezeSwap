export type Side = 'LONG' | 'SHORT'
export type MarketStatus = 'OPEN' | 'SETTLED'
export type WeatherVariable = 'RAINFALL' | 'TEMPERATURE'
export type PayoffType = 'BINARY' | 'LINEAR' | 'CAPPED'

export interface Market {
  contractAddress: string
  chainId: number
  regionId: string
  regionName: string | null
  weatherVariable: WeatherVariable
  payoffType: PayoffType
  thresholdLow: number        // in display units (mm or °C), already divided by 1e6
  thresholdHigh: number | null
  expiryTimestamp: string     // ISO string
  collateralToken: string
  status: MarketStatus
  finalOracleValue: number | null
  longPayoutRatio: number | null   // 0-1
  shortPayoutRatio: number | null  // 0-1
  settledAt: string | null
  createdAt: string
  blockNumber: number
  txHash: string
}

export interface Position {
  id: string
  marketAddress: string
  tokenId: string
  holderAddress: string
  side: Side
  collateralAsset: string
  collateralAmount: string     // raw wei string, format for display
  mintedAt: string
  blockNumber: number
  txHash: string
  redeemed: boolean
  redeemedAmount: string | null
  redeemedAt: string | null
  redeemTxHash: string | null
  // Joined from markets table when fetching user positions
  market?: Pick<Market, 'regionName' | 'weatherVariable' | 'expiryTimestamp' | 'status'>
}

export interface WeatherReading {
  regionId: string
  regionName: string | null
  variable: WeatherVariable
  value: number              // display value (already divided by 1e6)
  readingTimestamp: string
}

export interface CreateMarketParams {
  regionId: `0x${string}`    // bytes32 — use encodeRegionId() helper
  weatherVariable: WeatherVariable
  payoffType: PayoffType
  thresholdLow: bigint       // raw oracle units (multiply display value by 1e6)
  thresholdHigh: bigint      // 0n for BINARY/LINEAR
  expiryTimestamp: bigint    // Unix timestamp in seconds
  collateralToken: `0x${string}` // ERC20 address
  oracleAddress?: `0x${string}`
}

export interface MintPositionParams {
  marketAddress: `0x${string}`
  side: Side
  collateralAmount: bigint   // in collateral token's decimals (e.g. 6 for USDT)
}

export interface BreezeSwapConfig {
  indexerUrl: string         // Render API base URL
  rpcUrl: string             // Coston2 RPC
  chainId: number            // 114 for Coston2
}
