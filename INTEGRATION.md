# BreezeSwap TypeScript SDK Integration Guide (`@breezeswap/sdk`)

The `@breezeswap/sdk` package provides complete multi-chain TypeScript utilities for integrating BreezeSwap weather derivatives and vAMM perpetual markets into third-party web apps, trading bots, and analytical dashboards.

---

## 📦 Installation

```bash
npm install @breezeswap/sdk viem
# or
pnpm add @breezeswap/sdk viem
```

---

## ⚙️ Supported Networks & Constants

```typescript
import {
  COSTON2_CHAIN_ID,       // 114
  FLARE_MAINNET_CHAIN_ID,  // 14
  getContractAddresses,
  coston2Chain,
  flareMainnetChain
} from '@breezeswap/sdk'

// Fetch live contract registry for Flare Mainnet (Chain ID 14)
const addresses = getContractAddresses(FLARE_MAINNET_CHAIN_ID)
console.log('Mainnet Factory:', addresses.factory)
console.log('Mainnet Perp Factory:', addresses.perpFactory)
```

---

## 📊 Reading Market Data & Statistics

```typescript
import {
  getMarkets,
  getPerpMarkets,
  getPerpMarketStats,
  getTradeHistory,
  FLARE_MAINNET_CHAIN_ID
} from '@breezeswap/sdk'

const INDEXER_URL = 'https://breezeswap-indexer.onrender.com'

// 1. Fetch live Classic Weather Markets
const classicMarkets = await getMarkets(INDEXER_URL, FLARE_MAINNET_CHAIN_ID)

// 2. Fetch live Perpetual Weather Markets
const perpMarkets = await getPerpMarkets(INDEXER_URL, FLARE_MAINNET_CHAIN_ID)

// 3. Fetch consolidated market stats for a specific perp market
const stats = await getPerpMarketStats(INDEXER_URL, '0x15e309f0434942BDfa0D961E25FaCc4483BABe46', FLARE_MAINNET_CHAIN_ID)
console.log('Mark Price:', stats?.markPrice)
console.log('Funding Rate:', stats?.currentFundingRate)
console.log('Next Funding At:', stats?.nextFundingAt)

// 4. Fetch trade history feed
const trades = await getTradeHistory(INDEXER_URL, '0x15e309f0434942BDfa0D961E25FaCc4483BABe46', FLARE_MAINNET_CHAIN_ID, 20)
```

---

## 📈 Calculating vAMM Quotes & Slippage

```typescript
import { calculatePerpQuote, calculateMarkPrice, type Reserves } from '@breezeswap/sdk'

const reserves: Reserves = {
  collateralReserve: 1_000_000n * 10n ** 18n,
  weatherReserve: 40_000n * 10n ** 18n
}

const collateralInWei = 100n * 10n ** 18n // $100
const leverage = 2                        // 2x leverage
const isLong = true
const tradingFeeBps = 10                  // 0.10%

const quote = calculatePerpQuote(reserves, collateralInWei, leverage, isLong, tradingFeeBps)
console.log('Estimated Entry Price:', quote.entryPrice)
console.log('Trading Fee Amount:', quote.feeAmount)
console.log('Net Margin:', quote.netCollateral)
console.log('Slippage Impact Bps:', quote.priceImpactBps)
```

---

## ⚡ Executing On-Chain Trades

```typescript
import {
  createBreezeWalletClient,
  createBreezePublicClient,
  openPerpPosition,
  closePerpPosition,
  FLARE_MAINNET_CHAIN_ID
} from '@breezeswap/sdk'

// Instantiate Viem clients for connected browser wallet
const publicClient = createBreezePublicClient(FLARE_MAINNET_CHAIN_ID)
const walletClient = createBreezeWalletClient(window.ethereum, FLARE_MAINNET_CHAIN_ID)

// 1. Open a 2x Long position with 50 USDT collateral
const collateralWei = 50n * 10n ** 6n // 6 decimals for USDT
const openTxHash = await openPerpPosition(
  walletClient,
  publicClient,
  '0x15e309f0434942BDfa0D961E25FaCc4483BABe46',
  true,             // isLong
  collateralWei,
  2n                // leverage
)

// 2. Close an existing perp position by positionId
const closeTxHash = await closePerpPosition(
  walletClient,
  publicClient,
  '0x15e309f0434942BDfa0D961E25FaCc4483BABe46',
  1n                // positionId
)
```
