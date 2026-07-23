# BreezeSwap — Full Implementation Plan

Weather derivatives protocol on Flare. This document is the complete build spec — phases, stack, infra, contracts, backend, frontend, APIs, testing, and deployment (testnet + mainnet). Hand this to your AI coding agent alongside Flare's developer docs.

Here's BreezeSwap in plain English, no jargon.

## The problem

Weather affects real money — a farmer's crop yield, an energy company's heating costs, an event organizer's rain risk — but most people and businesses have no simple way to financially protect themselves against bad weather. Traditional weather insurance is slow, involves claims adjusters, and can take weeks to pay out. And the weather data insurers rely on isn't always trustworthy or transparent.

## What we're building

A marketplace where two people can take opposite sides of a bet on real, measurable weather — like "will this region get more or less than 80mm of rain this month" — and get paid out **automatically and instantly** based on what the official weather reading actually says, with no claims process, no paperwork, no waiting.

Think of it like this: instead of buying insurance from a company that might argue about your claim, you're entering a straightforward agreement with someone else who has the opposite view of what the weather will do. If it rains a lot, one side wins. If it doesn't, the other side wins. A trusted, tamper-proof data source (powered by Flare's oracle network) settles it automatically — nobody can dispute it or delay it.

## Why it's actually useful, not just a bet

- **A farmer** worried about drought can take the "low rainfall" side — if the drought happens, they automatically get paid, cushioning their real financial loss, exactly when they need it most.
- **An energy company** planning for a mild winter (which hurts their heating revenue) can hedge the same way.
- **Anyone** who thinks they understand weather patterns better than the market can take the other side and potentially profit.

It behaves less like gambling and more like real insurance or a financial hedge — the payout scales smoothly with how far the actual weather deviated from the threshold, not a random all-or-nothing coin flip.

## Why it's trustworthy

The whole system runs on Flare, a blockchain network that specializes in bringing real-world data (like weather readings) on-chain in a way that can't be faked, hidden, or changed after the fact. This matters a lot right now because Flare recently partnered with Kweather, a major South Korean weather data company, specifically to build "weather finance" products like this. We're building ahead of that curve — creating the actual usable product while the official data partnership is still getting set up.

## What makes it "real," not just a demo

- It runs on a live, public blockchain testnet (and eventually a small real deployment), not just a mockup
- Positions are represented as tokens people can hold, transfer, or sell — like a tradable financial instrument, not a locked-in bet
- All the settlement logic and money-handling code is heavily tested against people deliberately trying to break it, the same rigor real financial protocols use
- It's built to plug directly into Flare's real weather data feed the moment it goes live — no rebuild required

## The one-sentence pitch

**BreezeSwap lets anyone hedge or speculate on real weather outcomes, with instant, automatic, tamper-proof payouts — no insurance company, no claims process, no waiting.**


---

## 0. Principles Governing Every Decision Below

- **Budget ceiling: $10-30 total**, spent only on FLR gas for mainnet contract deployment and a handful of real transactions. Everything else (hosting, APIs, data) must be free tier.
- **Real data, not fake demo data.** The mock weather oracle pulls from a real free weather API so numbers are genuine, even though Kweather's official feed isn't live yet.
- **Testnet first, mainnet second.** Coston2 is where all development and testing happens. Mainnet gets one clean, audited-as-possible deployment near the end, funded with a small real FLR amount, used for a small number of real demo transactions — not a full trading environment.
- **No Binance API, no CEX price feeds needed.** This product doesn't need crypto spot prices as an input. If you want to display FLR/XRP/FXRP fiat value anywhere in the UI (e.g. "your collateral is worth ~$X"), use CoinGecko's free public API — no key required for basic endpoints, generous rate limit. Binance API is unnecessary here and adds a dependency with no product justification.

---

## 1. Tech Stack (Your Existing Preferences, Mapped to Roles)

| Layer | Tool | Role |
|---|---|---|
| Smart contracts | Foundry (Solidity) | Core protocol |
| Contract testing | Foundry (forge test, fuzz, invariant) | All test tiers |
| Frontend | Next.js (App Router) | UI, deployed on Vercel |
| Backend/indexer | Node.js/TypeScript service | Watches chain events, writes to DB |
| Database | Supabase (Postgres) | Markets, positions, users, historical settlement data |
| Cache/queues | Redis (Railway-hosted) | Rate limiting, job queue for indexer, hot-read cache |
| Hosting — frontend | Vercel | Next.js app |
| Hosting — backend/indexer | Railway | Long-running Node process + Redis |
| CI/CD | GitHub Actions | Contract tests on every push, deploy pipelines |
| Containerization | Docker | Indexer service, for Railway deploy consistency |
| SDK | TypeScript + viem | Published as an npm package, consumed by frontend itself |
| Charts | Recharts | Client-side rendering of your own indexed data — no external chart API needed |
| Wallet connection | wagmi + viem + RainbowKit (or ConnectKit) | Free, standard EVM wallet connect |
| Weather data (realism) | Open-Meteo API | 100% free, no API key, no rate-limit auth — used to seed/ground your mock oracle with real rainfall numbers |
| Fiat price display (optional) | CoinGecko public API | Free, no key needed for basic price endpoints |
| Error monitoring | Sentry (free tier) | Frontend + backend error tracking |
| Contract verification | Flare block explorer (Blockscout-based) | Free, standard `forge verify-contract` |

**Nothing here requires a paid API.** Your $10-30 budget goes entirely to FLR gas.

---

## 2. Repo Structure

```
breezeswap/
  contracts/                  # Foundry project
    src/
      core/
        BreezeMarketFactory.sol
        BreezeMarket.sol
        PositionToken.sol       # ERC1155
      oracle/
        IWeatherOracle.sol
        MockWeatherOracle.sol   # seeded from Open-Meteo, mirrors FTSO/FDC shape
        FtsoWeatherAdapter.sol  # real FTSO integration point
        FdcWeatherAdapter.sol   # real FDC integration point (secondary path)
      settlement/
        PayoffCalculator.sol    # pure math, isolated for testing
      vault/
        CollateralVault.sol
      periphery/
        FAssetsCollateralAdapter.sol  # accept FXRP as collateral
    test/
      unit/
      fuzz/
      invariant/
      security/                # adversarial "try to break X" tests
      fork/                    # live Coston2 / mainnet fork tests
    script/
      DeployTestnet.s.sol
      DeployMainnet.s.sol
    foundry.toml

  sdk/                         # published npm package
    src/
      client.ts
      markets.ts
      positions.ts
      types.ts
    package.json

  indexer/                     # backend service
    src/
      watchers/                # chain event listeners
      jobs/                    # Redis-backed queue jobs
      db/                      # Supabase client + schema
      api/                     # thin REST/GraphQL read layer
    Dockerfile
    railway.toml

  web/                         # Next.js app
    app/
      page.tsx                 # landing
      markets/
      markets/[id]/
      portfolio/
      docs/
      admin/ (optional)
    lib/                       # SDK consumption, wagmi config

  weather-seed/                # small script: Open-Meteo → mock oracle seeding
  docs/
    README.md
    ARCHITECTURE.md
    SECURITY.md
    INTEGRATION.md
    API.md
  .github/workflows/
    contracts-ci.yml
    indexer-deploy.yml
    web-deploy.yml
```

---

## 3. System Design — How It All Talks

```
Open-Meteo API ──(fetch real rainfall/temp)──> weather-seed script
                                                       │
                                                       ▼
                                          MockWeatherOracle (Coston2/mainnet)
                                                       │
                                          (later: FtsoWeatherAdapter — swap-in path)
                                                       │
                                                       ▼
User Wallet ──mint/redeem──> BreezeMarket ──reads──> Oracle ──settles──> PositionToken (ERC1155)
                    │
                    ▼
              Chain Events (Mint, Settle, Redeem)
                    │
                    ▼
         Indexer (Railway, Node.js) ──writes──> Supabase (Postgres)
                    │                                  │
                    ▼                                  ▼
              Redis (cache/queue)              Indexer REST API
                                                        │
                                                        ▼
                                          Next.js frontend (Vercel) ── SDK ──> Contracts directly for writes
```

Key design decision: **reads go through the indexer+DB (fast, queryable), writes go directly through the SDK to the contracts (non-custodial, no backend in the trust path for money movement).** The backend never holds funds or signs transactions on a user's behalf.

---

## 4. Phase-by-Phase Plan

### Phase 0 — Scaffolding (Day 1-2)
- Set up monorepo (pnpm workspaces or Turborepo) with the structure above
- Foundry project init, GitHub Actions running `forge test` on every push from commit #1
- Supabase project created, initial schema migration (markets, positions, settlements, users tables)
- Railway project created (indexer service placeholder + Redis instance)
- Vercel project linked to `web/`
- Get Coston2 testnet FLR from the faucet; confirm RPC connectivity

### Phase 1 — Core Contracts (Day 3-7)
Build in this order, with tests written alongside each, not after:
1. `PositionToken.sol` (ERC1155) — one tokenId per market+side
2. `IWeatherOracle.sol` interface + `MockWeatherOracle.sol`
3. `CollateralVault.sol` — pooled accounting, deposit/withdraw internal logic
4. `PayoffCalculator.sol` — pure functions only, no state, so it's trivially unit-testable: binary, linear, and capped/tiered payoff curves
5. `BreezeMarket.sol` — ties it together: mint position, hold collateral, settle at expiry, allow redemption
6. `BreezeMarketFactory.sol` — permissionless market creation + registry

**Exit criteria for this phase:** full mint → wait → settle → redeem cycle passes on local Anvil with 100% of core-path unit tests green.

### Phase 2 — Real-World Data Grounding (Day 8-9)
- Build `weather-seed/` script: pulls real historical + forecast rainfall/temperature for a chosen region from Open-Meteo (free, no key)
- Feed that into `MockWeatherOracle` so your demo markets settle against real measured weather, not invented numbers — this is your strongest "real life ready" claim
- Stub `FtsoWeatherAdapter.sol` and `FdcWeatherAdapter.sol` — document clearly that these are the swap-in points for when Flare/Kweather's real feed goes live; write a test showing the interface is satisfied by both mock and stub adapters identically (proves the abstraction actually works)

### Phase 3 — Differentiating Features (Day 10-14)
- Capped/tiered payoff curve (should already exist from Phase 1's `PayoffCalculator`, now wired fully into `BreezeMarket`)
- `FAssetsCollateralAdapter.sol` — accept FXRP as collateral alongside a stablecoin
- Pick ONE stretch feature: early exit at mark-to-model price, OR a second market type (temperature), OR basket/index markets. Don't attempt more than one given the budget/time constraints.

### Phase 4 — Security Hardening (Day 15-17)
- `test/security/`: reentrancy attempts, oracle staleness exploitation, double-redemption, rounding/precision attacks at settlement boundaries, expiry edge cases (settling exactly at expiry, before, long after)
- `test/invariant/`: total collateral in == total payout out; no value creation; no permanently stuck funds. Run with `FOUNDRY_INVARIANT_RUNS=256+`
- `test/fork/`: fork Coston2 (and later mainnet) state, test real FTSO/FDC reads if you wire the real adapters at all, even read-only
- Write `SECURITY.md` as you go — bug class → defense, and explicitly what's NOT hardened yet (be honest, e.g. "owner is a single EOA, no timelock/multisig — documented risk, roadmap item")

### Phase 5 — Backend / Indexer (Day 15-18, parallel to Phase 4)
- Node.js service in `indexer/`, watches `BreezeMarketFactory` and `BreezeMarket` events via viem's event watching
- Writes normalized data to Supabase: markets table, positions table, settlements table
- Redis used for: job queue (so event processing survives restarts), and caching hot reads (e.g. "list active markets") to avoid hammering Supabase
- Expose a thin REST API (`GET /markets`, `GET /markets/:id`, `GET /markets/:id/positions`, `GET /users/:address/positions`) — this is also what your SDK's read functions call
- Dockerize it, deploy to Railway, connect to Railway Redis + Supabase
- GitHub Action: on push to `indexer/`, build Docker image and deploy to Railway

### Phase 6 — SDK (Day 18-19)
- `sdk/` package: typed functions wrapping both writes (direct contract calls via viem) and reads (calls to your indexer API)
- Publish to npm (free, public package) — or at minimum have it installable via `npm install` from GitHub if you don't want to publish publicly
- Frontend consumes this SDK — don't duplicate the logic in `web/`

### Phase 7 — Frontend (Day 18-20, overlapping)
Build in Next.js App Router. Pages and what belongs on each (content only — design is yours):

**`/` — Landing**
- What BreezeSwap is, one-line pitch (weather derivatives, not insurance)
- How it works, 3-4 step visual summary (deposit → mint position → weather resolves → redeem)
- Live stats pulled from indexer: total markets, total value locked, total settled
- CTA to `/markets`

**`/markets` — Market list**
- Table/grid of all markets: location, weather variable (rainfall/temp), threshold, expiry, current oracle reading, status (open/settled)
- Filter by status, region, variable type
- "Create Market" CTA (if permissionless creation is enabled in your UI, not just via SDK)

**`/markets/[id]` — Market detail**
- Full market parameters, payoff curve visualization (Recharts — plot the capped/tiered curve so users can see exactly how payout scales)
- Current oracle value vs. threshold, live if pre-expiry, final if settled
- Mint position form: choose side (long/short), collateral amount, collateral asset (stablecoin or FXRP)
- List of open positions in this market (aggregate, not necessarily per-user unless you want a leaderboard feel)
- Historical weather chart for the underlying region/period (Recharts, sourced from your Open-Meteo-seeded data)

**`/portfolio` — User positions**
- Connect wallet (wagmi/RainbowKit)
- List of the connected user's open and settled positions, current value, redeemable amount
- Redeem button per settled position

**`/docs`**
- Rendered version of your `ARCHITECTURE.md` / `INTEGRATION.md` / `SECURITY.md` — this is a strong touch, makes documentation feel like part of the product rather than a separate file nobody opens
- Contract addresses (testnet + mainnet), links to block explorer

**`/create` (optional, if you expose market creation in UI, not just via SDK/admin script)**
- Form: region (with a location picker, could just be a dropdown of pre-supported regions rather than a full map to save time), weather variable, threshold(s) for the payoff curve, expiry date
- Preview of the resulting payoff curve before submitting

### Phase 8 — Testnet Full Cycle (Day 8-9 initial deploy, continuous after)
- Deploy full contract suite to Coston2 as early as Phase 1 completes (don't wait)
- Run real mint → settle → redeem cycles with real (testnet) transactions throughout every subsequent phase, not just once at the end
- Verify all contracts on the Coston2 block explorer

### Phase 9 — Mainnet Deployment (Day 20-21, budget-conscious)
- Buy a small amount of real FLR (a few dollars' worth is enough for deployment gas on Flare, which has low fees) — stay well within your $10-30 ceiling
- Deploy the SAME audited/tested contract bytecode that ran on Coston2 — no last-minute changes
- Create 1-2 real mainnet markets with small real collateral amounts (a few dollars each) so you can show a genuinely live mainnet transaction, not just a testnet screenshot
- Verify contracts on Flare mainnet explorer
- Point the indexer at mainnet in addition to (or instead of) Coston2; frontend gets a network switcher if you show both

### Phase 10 — Documentation & Submission (Day 21-22)
- Finalize `README.md`, `ARCHITECTURE.md`, `SECURITY.md`, `INTEGRATION.md`, `API.md`
- Record demo video: testnet AND mainnet transactions shown live
- Submission writeup: problem, what's newly built, explicit scope cuts, roadmap, contract addresses (both networks), test summary numbers

---

## 5. CI/CD (GitHub Actions)

- `contracts-ci.yml`: on every push — `forge build && forge test` (fail the build if any test fails, this is non-negotiable discipline)
- `indexer-deploy.yml`: on push to `main` affecting `indexer/` — build Docker image, deploy to Railway
- `web-deploy.yml`: Vercel handles this natively via its GitHub integration, no custom Action needed — just connect the repo

---

## 6. Database Schema (Supabase/Postgres) — Starting Point

```sql
markets (
  id, contract_address, chain_id, region, weather_variable,
  threshold_low, threshold_high, expiry_timestamp,
  status, final_oracle_value, created_at
)

positions (
  id, market_id, token_id, holder_address, side,
  collateral_asset, collateral_amount, minted_at,
  redeemed, redeemed_amount, redeemed_at
)

settlements (
  id, market_id, oracle_value, settled_at, tx_hash
)

weather_readings (
  id, region, variable, value, reading_timestamp, source
)
```

---

## 7. Budget Breakdown ($10-30 ceiling)

| Item | Cost |
|---|---|
| Coston2 testnet FLR | $0 (faucet) |
| Mainnet FLR for contract deployment | ~$5-10 (Flare gas is cheap) |
| Mainnet demo transactions (1-2 small markets) | ~$5-15 in real collateral you post yourself |
| Supabase | $0 (free tier) |
| Railway | $0-5 (free tier covers small services; may need starter tier for always-on Redis + indexer) |
| Vercel | $0 (free tier) |
| Open-Meteo, CoinGecko | $0 (free, no key) |
| Sentry | $0 (free tier) |
| npm package publish | $0 |

Stay near the low end by keeping mainnet demo collateral small (a few dollars per position is enough to prove it's real).

---

## 8. What to Explicitly Tell Your AI Agent Before It Starts

Paste this framing at the top of your first prompt to the agent, alongside the Flare dev docs:

> Build BreezeSwap exactly to this phased plan. Do not skip the testing phase to move faster — every contract change needs a corresponding test in the same work session. Testnet (Coston2) deployment happens as early as Phase 1 is complete, not at the end. Mainnet deployment only happens once all Phase 6 security tests pass. Budget for all on-chain actions (testnet + mainnet combined) must stay under $30 in real FLR. Use only free-tier services — no paid APIs anywhere in the stack.