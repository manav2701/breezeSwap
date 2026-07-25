# BreezeSwap Architecture

## System Overview

```
                                          BreezeAccessControl
                                      (Shared Role Registry)
                                                 │
          ┌──────────────────────────────────────┼──────────────────────────────────────┐
          │ (ORACLE_UPDATER_ROLE)                │ (PAUSER_ROLE)                        │ (ADMIN_ROLE)
          ▼                                      ▼                                      ▼
MockWeatherOracle (Coston2)            BreezeMarketFactory                   FAssetsCollateralAdapter
          │                                      │                                      │
          ├── FtsoWeatherAdapter                 ▼                                      ▼
          └── FdcWeatherAdapter            BreezeMarket ──reads──> Oracle      CollateralVault (mUSDT / FXRP)
                                                 │
                                                 ▼
                                        PositionToken (ERC1155)
```

## Role-Based Access Control Architecture (Phase 7)

BreezeSwap decouples permission logic from individual contract ownership by utilizing a single, central registry (`BreezeAccessControl.sol`):

1. **`BreezeAccessControl`**: Manages standard OpenZeppelin role hashes (`ADMIN_ROLE`, `PAUSER_ROLE`, `ORACLE_UPDATER_ROLE`, `MARKET_CREATOR_ROLE`).
2. **Contract Modifiers**: Protocol contracts (`MockWeatherOracle`, `BreezeMarketFactory`, `BreezeMarket`, `FAssetsCollateralAdapter`) store an immutable reference to `BreezeAccessControl` and enforce permission checks via `require(accessControl.hasRole(ROLE, msg.sender), "BreezeSwap: unauthorized")`.
3. **Emergency Circuit Breaker**:
   - `BreezeMarketFactory.pauseFactory()` / `unpauseFactory()` (gated by `PAUSER_ROLE`) halts new market deployment.
   - `BreezeMarket.pauseMarket()` / `unpauseMarket()` (gated by `PAUSER_ROLE`) halts new `mintPosition()` minting.
   - **`settle()` and `redeem()` remain un-gated**, guaranteeing users can always claim settled funds.

## Oracle Abstraction Architecture

BreezeSwap implements a unified `IWeatherOracle` interface satisfied by:
1. `MockWeatherOracle`: Seeded with real Open-Meteo weather measurements for testnet/demo markets (gated by `ORACLE_UPDATER_ROLE`).
2. `FtsoWeatherAdapter`: Swap-in adapter ready to read from Flare's FTSOv2 registry once official weather feeds go live.
3. `FdcWeatherAdapter`: Swap-in adapter ready to verify Merkle attestation proofs from Flare Data Connector.

## FAssets (FXRP) Collateral Flow

To support non-stablecoin collateral natively on Flare:
1. Users deposit `FTestXRP` / `FXRP` into `CollateralVault`.
2. `FAssetsCollateralAdapter` queries Flare's FTSOv2 `FXRP/USD` price feed.
3. Collateral is normalized to USD equivalent prior to position token minting.
4. Fallback oracle pricing is gated strictly by `ADMIN_ROLE`.

## Data Availability (DA) Note

Raw high-frequency weather sensor data is kept off-chain (accessed via Open-Meteo / FDC attestations) to optimize gas efficiency. Only the verified settled observation reading and payout ratios are persisted on-chain upon market resolution.
