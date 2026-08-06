# BreezeSwap — Weather Derivatives Protocol on Flare

> Parametric weather derivatives protocol letting anyone hedge or speculate on real weather outcomes with instant, automatic, tamper-proof payouts on Flare Network. Combines **BreezeSwap Classic** (fixed-expiry pooled weather swaps) and **BreezeSwap Perp** (continuous vAMM-based weather perpetuals with 15m funding rates & open interest).
> Deployed on **Flare Coston2 Testnet (Chain ID 114)**. Not deployed to Flare Mainnet — see [Deployment status](#-deployment-status).

---

## 📄 Submission & Demo Documentation

- 📜 **[Hackathon Submission Writeup](docs/SUBMISSION.md)** — Project framing, target tracks, architecture breakdown, Flare native integration depth, security audit summary, and roadmap.
- 🎬 **[Demo Video Script & Manual Testing Protocol](docs/DEMO_SCRIPT.md)** — Step-by-step video recording beat sheet and 6-scenario multi-wallet manual testing protocol.
- 🏗️ **[System Architecture](ARCHITECTURE.md)** — Modular smart contract architecture, vAMM constant-product formula, and indexer pipeline.
- 🛡️ **[Security Audit & Invariants](SECURITY.md)** — Solvency guarantees, reentrancy guards, invariant fuzz testing, role-based access control, and disclosed limitations.
- 🔌 **[TypeScript SDK Integration Guide](INTEGRATION.md)** — Developer integration guide for `@breezeswap/sdk`.

---

## 🌐 Deployment Status

BreezeSwap is live on **Coston2 testnet only**. The SDK, indexer, and frontend are
genuinely parametrised by chain ID rather than hardcoded, so a mainnet deployment
requires only a registry entry — but **no mainnet deployment exists today**, and
nothing in this repository should be read as claiming otherwise.

| Network | Chain ID | Status |
|---|---|---|
| Flare Coston2 Testnet | 114 | ✅ Deployed & verified on-chain |
| Flare Mainnet | 14 | ❌ Not deployed |

Mainnet deployment is gated on a professional security audit — see
[SECURITY.md](SECURITY.md) for the full list of disclosed limitations.

### Coston2 Testnet (Chain ID 114)
| Contract | Address on Coston2 | Explorer Link |
|---|---|---|
| **BreezeAccessControl** | `0x3788420AB4Ef4D2c2dd22c151fd6CB93d2543853` | [View on Explorer](https://coston2-explorer.flare.network/address/0x3788420AB4Ef4D2c2dd22c151fd6CB93d2543853) |
| **BreezeMarketFactory** | `0x699fd810EC7C0620a9BF01Cd73356770Ae0aBbaf` | [View on Explorer](https://coston2-explorer.flare.network/address/0x699fd810EC7C0620a9BF01Cd73356770Ae0aBbaf) |
| **BreezePerpFactory** | `0x05e309f0434942BDfa0D961E25FaCc4483BABe46` | [View on Explorer](https://coston2-explorer.flare.network/address/0x05e309f0434942BDfa0D961E25FaCc4483BABe46) |
| **FeeConfig** | `0xB0D295305d653F044E4178bb6966e76FB79f325C` | [View on Explorer](https://coston2-explorer.flare.network/address/0xB0D295305d653F044E4178bb6966e76FB79f325C) |
| **InsuranceFund** | `0x96952FC0fBe43AA72E1D08B11daD5cA56c12a36f` | [View on Explorer](https://coston2-explorer.flare.network/address/0x96952FC0fBe43AA72E1D08B11daD5cA56c12a36f) |
| **ProtocolTreasury** | `0xecB7Ff4dA80532F5C7803392761643bA4dDe5058` | [View on Explorer](https://coston2-explorer.flare.network/address/0xecB7Ff4dA80532F5C7803392761643bA4dDe5058) |

> **These addresses predate the capital structure.** The live deployment is the
> pre-waterfall stack — no liquidity vault, junior tranche, first-loss reserve, peril
> registry or policy market, and a single-EOA admin. Everything described below under
> [Capital structure](#capital-structure) exists in the repository and is deployed by
> `script/DeployProtocol.s.sol`, but is **not** at the addresses above. Redeploying is
> what would change that, and has not been done.

---

## 🧪 Test Suite & Safety Summary

- **Total Consolidated Tests:** 568/568 Passing Tests (100% Pass Rate across 54 Test Suites)
- **Code Coverage Snapshot:** 100% VirtualAMM, 100% CollateralVault, 100% FundingRateEngine, 96.83% BreezeMarket.
- **Adversarial Security Suites:** Fee manipulation, reentrancy defense, double settlement, double redemption, oracle staleness, access control, precision & dust loss, liquidation solvency, close-path accounting, notional capacity caps, capacity pricing, funding-rate scale, first-loss reserve isolation, correlated-peril aggregation, period settlement, climatology pricing.
- **Invariant Fuzzing:** 14 Protocol Invariants Holding across 256 Runs × 64 Depth (`BreezeInvariantsTest`, `PerpInvariantsTest`, `VaultInvariantsTest`).
- **Reserve Model Simulation:** 3,000-action Monte Carlo (40 traders, 6 LPs, random weather/liquidations) plus a coverage-ratio sweep — see [SECURITY.md](SECURITY.md) calibration evidence.
- **Loss Waterfall Simulation:** multi-seed four-arm comparison measuring whether tranching actually protects senior capital rather than only appearing to, plus a layer-width calibration sweep (`WaterfallMonteCarloTest`).
- **Deterministic Stress Scenarios:** five named worst cases — 100 traders all max long, every LP exiting at the first legal moment, the largest weather move the oracle can express, every position liquidatable in one update, and a maximal position opened immediately before settlement (`NightmareScenariosTest`).
- **Payoff & vAMM Fuzzing:** 10,000 Fuzz Iterations Passed (`PayoffCalculatorFuzzTest`, `VirtualAMMFuzzTest`).

> Three serious bugs were found and fixed during this audit, each documented in full:
>
> - **Critical — vAMM close-path double slippage** ([§6](SECURITY.md)). Closing trades applied
>   their price impact twice, costing up to 69% of collateral on large positions.
> - **High — funding rate pinned at the cap** ([§6b](SECURITY.md)). A 1e18 mark price was
>   compared against a 6-decimal oracle reading, so funding was a fixed maximum levy on one side
>   rather than a corrective force. *Every existing test still passed after the fix* — the
>   clearest evidence none had asserted funding responded to anything.
> - **High — profitable funding-settlement sandwich** ([§6c](SECURITY.md)). A position collected
>   a full interval of funding however briefly it had been open. Twenty rounds of open-settle-close
>   extracted **43.6% of all LP capital**. Fixed with continuous time-weighted accrual; the same
>   scenario now shows the trader losing money and the pool intact.

### Capital structure

LP capital sits in a three-tier loss waterfall rather than one undifferentiated pool, so
conservative and aggressive capital can hold different claims on the same book:

| Tier | Contract | Role |
|---|---|---|
| 1 | `FirstLossReserve` | Protocol-owned, fee-funded, self-replenishing — absorbs first, drawn only by the vault |
| 2 | `JuniorTranche` | Subordinated LPs; covers a defined band of the loss distribution and earns a bounded multiple of senior's yield per unit of capital |
| 3 | `BreezeLiquidityVault` | Senior LPs; protected, absorbs the residual |

Both upper tiers are optional and the waterfall degrades cleanly to a single tranche without them.

Three properties came out of measuring the waterfall rather than designing it:

- **Junior capital must be additive.** Simulation showed that carving junior out of a fixed total
  leaves senior thinner without reducing total loss — tranching redistributes loss, it does not
  reduce it. Junior therefore counts toward backing capacity only up to a bounded share, so
  moving senior LPs into the junior tranche buys no extra capacity while genuinely new
  subordinated capital does.
- **Junior covers a band, not an open-ended slice.** Attachment and exhaustion points give the
  layer a per-period aggregate limit, so its exposure is bounded in time and therefore priceable.
  The width is set by sweep.
- **Tier 1 has its own reserve.** It used to share `InsuranceFund` with the liquidation backstop,
  which let the vault starve liquidation — measured at 11% coverage of a deficit that a dedicated
  reserve covers in full.

Market exposure is bounded **preventively**: `maxNotionalCapacity()` derives from existing
backing what the market may carry, and `openPosition` refuses anything beyond it before any
token moves. `availableNotional(bool)` publishes the remaining room. Approaching that limit is
also **priced** — a utilisation-scaled surcharge on exposure-increasing opens, retained for LPs —
so the cap is a solvency backstop rather than the only signal that capacity is scarce.

Exposure is capped **across correlated markets**, not only per market. `PerilExposureRegistry`
buckets markets by declared peril, so two rainfall markets on regions that see the same storm
cannot each fill their own allowance against one weather event. Measured without it: two such
markets committed 599,400 of capital against a 1,000,000 pool, a 50% overshoot of any single
peril's cap.

### Pricing

Every product consults the historical record before it can be traded:

- **Policies** are priced off multi-decade climatology (`StrikeProbabilityOracle`) and now
  **settle on the same statistic they were priced on** — the whole covered period aggregated,
  not the single reading at expiry. Previously a wet month at 60mm settled as a drought against
  a 40mm monthly strike, because one day's rainfall is always below a monthly total.
- **Classic markets** publish `fairLongShareBps()` — the share of the pool the long side must
  hold for the odds to be fair — and refuse deposits that push the split further from it.
  BINARY payoffs only; LINEAR and CAPPED need the loss distribution rather than one quantile of
  it, and are left explicitly unpriced rather than given a wrong number that looks authoritative.
- **Perp markets** cannot be created at a mark price far from the climatological expectation for
  the month they open into. The month is derived on-chain (`CivilDate`) rather than declared, so
  the check cannot be pointed at a season that happens to admit the desired price.

---

## 🚀 How to Run Project Locally

```bash
# 1. Install dependencies
pnpm install

# 2. Run Foundry smart contract tests
cd contracts && forge test -vvv

# 3. Build SDK
cd ../sdk && npx tsup

# 4. Start Web Application
cd ../web && pnpm dev
```

### Deploying

One script stands up the whole protocol, and one test asserts every link in it
(`test/integration/DeploymentWiring.t.sol`). Simulate first — nothing broadcasts without
`--broadcast`:

```bash
cd contracts

# Simulate. Every optional variable defaults to DEMO behaviour and says so loudly.
PRIVATE_KEY=0x... forge script script/DeployProtocol.s.sol

# Production. Refuses to run without real collateral and a governance multisig.
PRIVATE_KEY=0x... COLLATERAL_TOKEN=0x... GOVERNANCE_MULTISIG=0x...   forge script script/DeployMainnet.s.sol --rpc-url flare_mainnet --broadcast
```

| Variable | Required by | Effect if unset |
|---|---|---|
| `PRIVATE_KEY` | both | script fails |
| `COLLATERAL_TOKEN` | `DeployMainnet` | `DeployProtocol` deploys a **demo** token |
| `GOVERNANCE_MULTISIG` | `DeployMainnet` | deployer keeps every role — **not** production |
| `TIMELOCK_DELAY` | neither | 2 days (floor of 1 day on mainnet) |
| `ORACLE_UPDATER` | neither | defaults to the multisig |

With a multisig configured, `ADMIN_ROLE` moves behind a self-administered `TimelockController`
and the deployer renounces every role. `PAUSER_ROLE` and `ORACLE_UPDATER_ROLE` stay immediate —
a pause that lands in two days is not an emergency control, and readings are posted
continuously.

After deploying, post climatology (`weather-seed`) before relying on the pricing gates: the
fair-odds and opening-mark checks bind only where the data exists.

> **The only functioning weather oracle is `MockWeatherOracle`.** The FTSO and FDC adapters
> revert on read, so settlement is trusted input regardless of how the protocol is deployed.
> This is the largest gap between this repository and a production system.

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
