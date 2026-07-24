# Integrating BreezeSwap

This guide covers interacting with BreezeSwap smart contracts and SDK functions.

## 1. Create a Market (Factory)

```typescript
import { parseUnits, keccak256, toHex } from 'viem';

const regionId = keccak256(toHex('TOKYO_RAINFALL'));
const expiry = Math.floor(Date.now() / 1000) + 7 * 86400; // 7 days

// Create Market via BreezeMarketFactory
const hash = await walletClient.writeContract({
  address: FACTORY_ADDRESS,
  abi: BreezeMarketFactoryAbi,
  functionName: 'createMarket',
  args: [
    regionId,
    0, // WeatherVariable.RAINFALL
    5000n, // thresholdLow (50.00 mm * 100)
    15000n, // thresholdHigh (150.00 mm * 100)
    BigInt(expiry),
    ORACLE_ADDRESS,
    COLLATERAL_TOKEN_ADDRESS,
    2 // PayoffType.CAPPED
  ]
});
```

## 2. Mint a Position (Long or Short)

```typescript
// Approve Market Vault first
await walletClient.writeContract({
  address: COLLATERAL_TOKEN_ADDRESS,
  abi: erc20Abi,
  functionName: 'approve',
  args: [MARKET_VAULT_ADDRESS, parseUnits('100', 18)]
});

// Mint Long Position (side = 0 for Long, 1 for Short)
const hash = await walletClient.writeContract({
  address: MARKET_ADDRESS,
  abi: BreezeMarketAbi,
  functionName: 'mintPosition',
  args: [0, parseUnits('100', 18)]
});
```

## 3. Settle a Market (Permissionless)

```typescript
// Settle post-expiry
const hash = await walletClient.writeContract({
  address: MARKET_ADDRESS,
  abi: BreezeMarketAbi,
  functionName: 'settle',
  args: []
});
```

## 4. Redeem Position Tokens

```typescript
// Redeem settled position tokens for collateral payout
const hash = await walletClient.writeContract({
  address: MARKET_ADDRESS,
  abi: BreezeMarketAbi,
  functionName: 'redeem',
  args: [tokenId, parseUnits('100', 18)]
});
```

## 5. Swap Oracle Path (Flare FTSOv2 / FDC)

To point a market to official Flare FTSOv2 weather feeds, pass `FtsoWeatherAdapter` address when creating a market via `BreezeMarketFactory`.

## 6. FXRP Collateral (FAssets)

To use `FTestXRP` / `FXRP` as collateral, pass `FAssetsCollateralAdapter` for price normalization before position minting.
