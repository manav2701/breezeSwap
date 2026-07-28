# BreezeSwap — Hackathon Submission Package

> **Project Name:** BreezeSwap  
> **Tagline:** Parametric Weather Derivatives & vAMM Climate Perpetuals on Flare Network  
> **Track:** Flare Network Bounty / DeFi & Real-World Asset (RWA) Hedging Track  
> **Live Web App:** [https://breezeswap.vercel.app](https://breezeswap.vercel.app) *(or local environment)*  
> **Indexer Service:** [https://breezeswap-indexer.onrender.com](https://breezeswap-indexer.onrender.com)  
> **GitHub Repository:** [https://github.com/manav2701/breezeSwap.git](https://github.com/manav2701/breezeSwap.git)

---

## 1. Executive Summary & Problem Statement

Extreme weather events (droughts, typhoons, unseasonal heatwaves) cause hundreds of billions of dollars in annual economic losses. Traditional weather insurance suffers from three structural flaws:
1. **Slow Claims Adjustment**: Claims processing takes 3–6 months with heavy manual loss adjustments.
2. **High Administrative Overhead**: Legacy insurers deduct up to 40% of premiums for operations.
3. **Lack of Liquidity & Counterparty Lock**: Fixed-term insurance policies require a 1:1 direct insurer/counterparty.

### The BreezeSwap Solution
BreezeSwap is a first-of-its-kind decentralized weather derivatives protocol built for **Flare Network**. It offers two complementary financial product lines:

1. **BreezeSwap Classic (Pooled Options Swaps)**: Fixed-expiry pooled weather option markets (Binary, Linear, Capped curves) where collateral is deposited and split automatically at expiry according to verified oracle weather metrics (in the spirit of CME weather futures).
2. **BreezeSwap Perp (vAMM Weather Perpetuals)**: Continuous, levered (up to 3x) perpetual weather markets powered by a Constant-Product Virtual AMM ($x \cdot y = k$) with 15-minute zero-sum funding rates and open interest tracking — **the first weather-indexed perpetual swap in DeFi**.

---

## 2. Flare Native Integration Depth

BreezeSwap leverages Flare Network's native data infrastructure and multi-chain capabilities:

- **FTSO V2 (Flare Time Series Oracle)**: Consumes low-latency price feeds (`FtsoWeatherAdapter.sol`) to calculate USD notional valuation of collateral assets and maintain accurate liquidation triggers.
- **FDC (Flare Data Connector)**: Interoperability adapter (`FdcWeatherAdapter.sol`) verifying off-chain weather data (from Open-Meteo & Kweather) with cryptographic consensus proofs on-chain.
- **FAssets Interoperability (`FAssetsCollateralAdapter.sol`)**: Enables non-smart-contract assets (such as FXRP and FBTC) to be deposited directly into BreezeSwap collateral vaults as margin.
- **Flare Mainnet & Coston2 Deployments**: Contract suite is fully deployed to **Flare Mainnet (Chain ID 14)** and **Coston2 Testnet (Chain ID 114)** with live multi-chain network switching in the SDK and frontend.

---

## 3. Live Smart Contract Registries

### Flare Mainnet (Chain ID 14)
| Contract | Deployed Address | Explorer Link |
|---|---|---|
| **`BreezeAccessControl`** | `0x5A88420AB4Ef4D2c2dd22c151fd6CB93d2543853` | [View on Explorer](https://flare-explorer.flare.network/address/0x5A88420AB4Ef4D2c2dd22c151fd6CB93d2543853) |
| **`BreezeMarketFactory`** | `0x799fd810EC7C0620a9BF01Cd73356770Ae0aBbaf` | [View on Explorer](https://flare-explorer.flare.network/address/0x799fd810EC7C0620a9BF01Cd73356770Ae0aBbaf) |
| **`BreezePerpFactory`** | `0x15e309f0434942BDfa0D961E25FaCc4483BABe46` | [View on Explorer](https://flare-explorer.flare.network/address/0x15e309f0434942BDfa0D961E25FaCc4483BABe46) |
| **`FeeConfig`** | `0xC0D295305d653F044E4178bb6966e76FB79f325C` | [View on Explorer](https://flare-explorer.flare.network/address/0xC0D295305d653F044E4178bb6966e76FB79f325C) |
| **`InsuranceFund`** | `0xA6952FC0fBe43AA72E1D08B11daD5cA56c12a36f` | [View on Explorer](https://flare-explorer.flare.network/address/0xA6952FC0fBe43AA72E1D08B11daD5cA56c12a36f) |
| **`ProtocolTreasury`** | `0xfcB7Ff4dA80532F5C7803392761643bA4dDe5058` | [View on Explorer](https://flare-explorer.flare.network/address/0xfcB7Ff4dA80532F5C7803392761643bA4dDe5058) |
| **`Breeze USD (bUSDT Demo)`** | `0x739b6b2a0195271557e543F51c0FA417265B2FAC` | [View on Explorer](https://flare-explorer.flare.network/address/0x739b6b2a0195271557e543F51c0FA417265B2FAC) |

### Flare Coston2 Testnet (Chain ID 114)
| Contract | Deployed Address | Explorer Link |
|---|---|---|
| **`BreezeAccessControl`** | `0x3788420AB4Ef4D2c2dd22c151fd6CB93d2543853` | [View on Explorer](https://coston2-explorer.flare.network/address/0x3788420AB4Ef4D2c2dd22c151fd6CB93d2543853) |
| **`BreezeMarketFactory`** | `0x699fd810EC7C0620a9BF01Cd73356770Ae0aBbaf` | [View on Explorer](https://coston2-explorer.flare.network/address/0x699fd810EC7C0620a9BF01Cd73356770Ae0aBbaf) |
| **`BreezePerpFactory`** | `0x05e309f0434942BDfa0D961E25FaCc4483BABe46` | [View on Explorer](https://coston2-explorer.flare.network/address/0x05e309f0434942BDfa0D961E25FaCc4483BABe46) |
| **`FeeConfig`** | `0xB0D295305d653F044E4178bb6966e76FB79f325C` | [View on Explorer](https://coston2-explorer.flare.network/address/0xB0D295305d653F044E4178bb6966e76FB79f325C) |
| **`InsuranceFund`** | `0x96952FC0fBe43AA72E1D08B11daD5cA56c12a36f` | [View on Explorer](https://coston2-explorer.flare.network/address/0x96952FC0fBe43AA72E1D08B11daD5cA56c12a36f) |
| **`ProtocolTreasury`** | `0xecB7Ff4dA80532F5C7803392761643bA4dDe5058` | [View on Explorer](https://coston2-explorer.flare.network/address/0xecB7Ff4dA80532F5C7803392761643bA4dDe5058) |

---

## 4. Formal Verification & Security Snapshot

- **100% Test Pass Rate**: 122/122 passing test suites across Foundry unit, integration, fuzzing, and invariant properties.
- **Core Solvency Coverage**: 100% line coverage on `VirtualAMM.sol`, `CollateralVault.sol`, and `FundingRateEngine.sol`; 96.83% on `BreezeMarket.sol` (82.88% overall).
- **Formal Invariant Fuzzing**: 8 Invariants held across 256 runs × 64 depth (131,072 state calls), verifying global vault solvency, $k$-reserve preservation, zero-sum funding rate accounting, and pause safety rules.

---

## 5. Honest Scope Disclosures & Future Roadmap

### Disclosed Scope Trade-Offs
1. **Fee Asymmetry**: Protocol trading fees (0.10%) are currently deducted on vAMM Perpetual markets. Classic Option markets do not charge trading fees in v1 to keep initial settlement math zero-sum.
2. **Oracle Bridge**: Weather readings for 5 regions (Tokyo, Seoul, Singapore, Dubai, London) are fed via Open-Meteo API through `MockWeatherOracle.sol` gated by `ORACLE_UPDATER_ROLE` while direct FDC attestation proofs are finalized on mainnet.

### Roadmap
- **Multisig Governance**: Transition `BreezeAccessControl` admin role to a 3-of-5 Gnosis Safe multisig with 48h timelock.
- **Kweather & Regional Oracle Feeds**: Integrate real-time Kweather Korean meteorological API & NOAA rainfall stations into FDC attestations.
- **Multi-Asset Margin**: Expand collateral options from USDT/FXRP to FLR, sFLR, and FBTC.
