# BreezeSwap Architecture

## System Overview

```
Open-Meteo API ──(Real rainfall & temp)──> weather-seed script
                                                  │
                                                  ▼
                                      MockWeatherOracle (Coston2)
                                                  │
                                                  ├── FtsoWeatherAdapter (Swap-in FTSOv2 path)
                                                  └── FdcWeatherAdapter  (Swap-in FDC path)
                                                  │
                                                  ▼
User Wallet ──mint/redeem──> BreezeMarket ──reads──> Oracle ──settles──> PositionToken (ERC1155)
                    │
                    ├── CollateralVault (USDT / Stablecoin)
                    └── FAssetsCollateralAdapter (FTestXRP / FXRP USD normalization)
```

## Oracle Abstraction Architecture

BreezeSwap implements a unified `IWeatherOracle` interface satisfied by:
1. `MockWeatherOracle`: Seeded with real Open-Meteo weather measurements for testnet/demo markets.
2. `FtsoWeatherAdapter`: Swap-in adapter ready to read from Flare's FTSOv2 registry once official Kweather weather feeds go live.
3. `FdcWeatherAdapter`: Swap-in adapter ready to verify Merkle attestation proofs from Flare Data Connector.

## FAssets (FXRP) Collateral Flow

To support non-stablecoin collateral natively on Flare:
1. Users deposit `FTestXRP` / `FXRP` into `CollateralVault`.
2. `FAssetsCollateralAdapter` queries Flare's FTSOv2 `FXRP/USD` price feed.
3. Collateral is normalized to USD equivalent prior to position token minting.

## Data Availability (DA) Note

Raw high-frequency weather sensor data is kept off-chain (accessed via Open-Meteo / FDC attestations) to optimize gas efficiency. Only the verified settled observation reading and payout ratios are persisted on-chain upon market resolution.
