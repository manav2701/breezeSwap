# BreezeSwap — Weather Derivatives Protocol on Flare

> Parametric weather derivatives protocol letting anyone hedge or speculate on real weather outcomes with instant, automatic, tamper-proof payouts on Flare Network. Combines **BreezeSwap Classic** (fixed-expiry pooled weather swaps) and **BreezeSwap Perp** (continuous vAMM-based weather perpetuals with 15m funding rates & open interest).
> Live on **Flare Mainnet (Chain ID 14)** and **Coston2 Testnet (Chain ID 114)** with live multi-chain network toggle.

---

## 📄 Submission & Demo Documentation

- 📜 **[Hackathon Submission Writeup](file:///c:/Users/manav/OneDrive/Desktop/ddd/breezeswap/docs/SUBMISSION.md)** — Project framing, target tracks, architecture breakdown, Flare native integration depth, security audit summary, and roadmap.
- 🎬 **[Demo Video Script & Manual Testing Protocol](file:///c:/Users/manav/OneDrive/Desktop/ddd/breezeswap/docs/DEMO_SCRIPT.md)** — Step-by-step video recording beat sheet and 6-scenario multi-wallet manual testing protocol.
- 🏗️ **[System Architecture](file:///c:/Users/manav/OneDrive/Desktop/ddd/breezeswap/ARCHITECTURE.md)** — Modular smart contract architecture, vAMM constant-product formula, and indexer pipeline.
- 🛡️ **[Security Audit & Invariants](file:///c:/Users/manav/OneDrive/Desktop/ddd/breezeswap/SECURITY.md)** — Solvency guarantees, reentrancy guards, invariant fuzz testing, and role-based access control.
- 🔌 **[TypeScript SDK Integration Guide](file:///c:/Users/manav/OneDrive/Desktop/ddd/breezeswap/INTEGRATION.md)** — Multi-chain developer integration guide for `@breezeswap/sdk`.

---

## 🌐 Live Multi-Chain Deployments

### Flare Mainnet (Chain ID 14)
| Contract | Address on Flare Mainnet | Explorer Link |
|---|---|---|
| **BreezeAccessControl** | `0x5A88420AB4Ef4D2c2dd22c151fd6CB93d2543853` | [View on Explorer](https://flare-explorer.flare.network/address/0x5A88420AB4Ef4D2c2dd22c151fd6CB93d2543853) |
| **BreezeMarketFactory** | `0x799fd810EC7C0620a9BF01Cd73356770Ae0aBbaf` | [View on Explorer](https://flare-explorer.flare.network/address/0x799fd810EC7C0620a9BF01Cd73356770Ae0aBbaf) |
| **BreezePerpFactory** | `0x15e309f0434942BDfa0D961E25FaCc4483BABe46` | [View on Explorer](https://flare-explorer.flare.network/address/0x15e309f0434942BDfa0D961E25FaCc4483BABe46) |
| **FeeConfig** | `0xC0D295305d653F044E4178bb6966e76FB79f325C` | [View on Explorer](https://flare-explorer.flare.network/address/0xC0D295305d653F044E4178bb6966e76FB79f325C) |
| **InsuranceFund** | `0xA6952FC0fBe43AA72E1D08B11daD5cA56c12a36f` | [View on Explorer](https://flare-explorer.flare.network/address/0xA6952FC0fBe43AA72E1D08B11daD5cA56c12a36f) |
| **ProtocolTreasury** | `0xfcB7Ff4dA80532F5C7803392761643bA4dDe5058` | [View on Explorer](https://flare-explorer.flare.network/address/0xfcB7Ff4dA80532F5C7803392761643bA4dDe5058) |
| **Breeze USD (bUSDT Demo)** | `0x739b6b2a0195271557e543F51c0FA417265B2FAC` | [View on Explorer](https://flare-explorer.flare.network/address/0x739b6b2a0195271557e543F51c0FA417265B2FAC) |

### Coston2 Testnet (Chain ID 114)
| Contract | Address on Coston2 | Explorer Link |
|---|---|---|
| **BreezeAccessControl** | `0x3788420AB4Ef4D2c2dd22c151fd6CB93d2543853` | [View on Explorer](https://coston2-explorer.flare.network/address/0x3788420AB4Ef4D2c2dd22c151fd6CB93d2543853) |
| **BreezeMarketFactory** | `0x699fd810EC7C0620a9BF01Cd73356770Ae0aBbaf` | [View on Explorer](https://coston2-explorer.flare.network/address/0x699fd810EC7C0620a9BF01Cd73356770Ae0aBbaf) |
| **BreezePerpFactory** | `0x05e309f0434942BDfa0D961E25FaCc4483BABe46` | [View on Explorer](https://coston2-explorer.flare.network/address/0x05e309f0434942BDfa0D961E25FaCc4483BABe46) |
| **FeeConfig** | `0xB0D295305d653F044E4178bb6966e76FB79f325C` | [View on Explorer](https://coston2-explorer.flare.network/address/0xB0D295305d653F044E4178bb6966e76FB79f325C) |
| **InsuranceFund** | `0x96952FC0fBe43AA72E1D08B11daD5cA56c12a36f` | [View on Explorer](https://coston2-explorer.flare.network/address/0x96952FC0fBe43AA72E1D08B11daD5cA56c12a36f) |
| **ProtocolTreasury** | `0xecB7Ff4dA80532F5C7803392761643bA4dDe5058` | [View on Explorer](https://coston2-explorer.flare.network/address/0xecB7Ff4dA80532F5C7803392761643bA4dDe5058) |

---

## 🧪 Test Suite & Safety Summary

- **Total Consolidated Tests:** 122/122 Passing Tests (100% Pass Rate across 31 Test Suites)
- **Code Coverage Snapshot:** 82.88% line coverage overall across all contracts (100% VirtualAMM, 100% CollateralVault, 100% FundingRateEngine, 96.83% BreezeMarket).
- **Adversarial Security Suites:** Fee manipulation, reentrancy defense, double settlement, double redemption, oracle staleness, access control, precision & dust loss, liquidation solvency (All 31 Suites Passed).
- **Invariant Fuzzing:** 8 Protocol Invariants Holding across 256 Runs × 64 Depth (131,072 total state calls in `BreezeInvariantsTest` & `PerpInvariantsTest`).
- **Payoff & vAMM Fuzzing:** 10,000 Fuzz Iterations Passed (`PayoffCalculatorFuzzTest`, `VirtualAMMFuzzTest`).

---

## 🚀 How to Run Project Locally

```bash
# 1. Install dependencies
pnpm install

# 2. Run Foundry smart contract tests
cd contracts && C:\Users\manav\.foundry\bin\forge.exe test -vvv

# 3. Build SDK
cd ../sdk && npx tsup

# 4. Start Web Application
cd ../web && pnpm dev
```

---

## Project Structure

```
breezeswap/
  contracts/            # Foundry Solidity smart contracts (Unit, Fuzz, Security & Invariants)
  sdk/                  # Multi-chain TypeScript SDK (@breezeswap/sdk)
  indexer/              # Dual-chain event watcher service & REST API
  web/                  # Next.js App Router web application with Network Toggle
  docs/                 # Hackathon Submission (SUBMISSION.md) & Demo Script (DEMO_SCRIPT.md)
  weather-seed/         # Open-Meteo weather data seeder script
```
