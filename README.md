# BreezeSwap — Weather Derivatives on Flare
<!-- BreezeSwap repository trigger update -->

> Rain in Tokyo, heat in Dubai, drought in Seoul: real risks that people already carry and
> mostly cannot hedge. BreezeSwap turns a weather reading into a tradeable contract that
> settles by formula — no claim, no adjuster, no counterparty to chase.
>
> Live on **Flare Coston2 Testnet (chain 114)**. Not deployed to Flare Mainnet — see
> [Deployment status](#-deployment-status).

| | |
|---|---|
| **Contracts** | 29 Solidity files, 6,016 lines |
| **Tests** | **568 passing / 0 failing** across 54 suites |
| **Products** | Classic markets · vAMM perpetuals · one-sided policies |
| **Stack** | Foundry · TypeScript SDK · Node indexer · Next.js 16 |

---

## Table of contents

1. [The problem](#-the-problem)
2. [What BreezeSwap is](#-what-breezeswap-is)
3. [The three products](#-the-three-products)
4. [Mechanics in detail](#-mechanics-in-detail)
5. [How capital scales](#-how-capital-scales)
6. [Competitors and where we differ](#-competitors-and-where-we-differ)
7. [Testing everything](#-testing-everything)
8. [Demo script for judges](#-demo-script-for-judges)
9. [Deployment status](#-deployment-status)
10. [Hosted deployment](#️-hosted-deployment)
11. [Indexer API](#-indexer-api)
12. [Web application](#️-web-application)
13. [Honest limitations](#-honest-limitations)
14. [Project structure](#project-structure)

---

## 🌧️ The problem

Weather is the largest uninsured risk on earth, and the tools to hedge it are built for
people who least need them.

**Insurance is slow and discretionary.** A farmer whose crop fails to a dry month files a
claim, waits for an adjuster, and argues about causation. The money arrives — if it
arrives — months after the moment it was needed.

**Exchange-traded weather derivatives exist, and are effectively closed.** CME lists over
75 weather contracts across 47 cities, and traded roughly **$2.4 billion notional in
2023**. That sounds large until you notice HDD/CDD futures cover **13 US cities**, in
contract sizes and through clearing relationships built for energy desks. A rice farmer in
Tokyo, a ski resort in Nagano, or a solar operator in Dubai is not a CME participant.

**On-chain parametric insurance solved the settlement problem but not the capital
problem.** Etherisc and Arbol both pay out automatically from verified data — genuinely
better than a claims process. But they are *insurance*: you buy cover, you cannot take
the other side, you cannot exit before expiry, and someone has to underwrite you before
anything clears at all.

The gap is a **market** — two-sided, continuously priced, exitable — for a risk that
today only has policies.

---

## ⚡ What BreezeSwap is

A weather reading becomes a number. That number settles a contract. Everything else is
plumbing.

```
Open-Meteo / FTSO / FDC          the reading
          │
          ▼
   IWeatherOracle                 an int256 on a fixed-point scale
          │
   ┌──────┼──────────────┬─────────────────────┐
   ▼      ▼              ▼                     ▼
Classic  Perpetual   Policy market      StrikeProbabilityOracle
market   market      (one-sided)        (30 years of history)
   │        │              │                     │
   └────────┴──────┬───────┘                     │
                   ▼                             │
        Loss waterfall (3 tiers) ◄────────────────┘
                   │                        prices every product
                   ▼
        Payout, computed on-chain
```

Three things make this different from "an oracle plus an if-statement":

1. **Every product is priced against 30 years of climatology** before it can trade. A
   market that cannot be priced says so on-chain rather than silently offering even money
   on a 90% event.
2. **LP capital sits in a three-tier loss waterfall**, so conservative and aggressive
   capital can hold different claims on the same book.
3. **Exposure is bounded preventively and across correlated markets**, not reactively and
   per-market.

---

## 📦 The three products

Each exists because the one before it fails at a particular scale.

### 1. Classic markets — `BreezeMarket.sol`

Fixed-expiry, pooled, two-sided. Both sides post collateral; at expiry `PayoffCalculator`
splits the pot.

Three payoff shapes:

| Shape | Behaviour |
|---|---|
| `BINARY` | All-or-nothing at the strike |
| `LINEAR` | Proportional above the strike |
| `CAPPED` | Linear ramp between strike and cap, flat outside |

Positions are **ERC-1155**, so they are transferable — you can sell a hedge before expiry
even though the market itself does not clear continuously.

The settlement invariant is exact: `longPayout + shortPayout == notional`, always. The
long side floors, the short side receives the remainder, so rounding never creates or
destroys a wei.

> **Why it is not enough:** an exact counterparty must appear before anyone can hedge. The
> first hedger to arrive waits.

### 2. Perpetual markets — `BreezePerpMarket.sol`

No expiry. A **virtual AMM** quotes both sides continuously against a constant-product
curve, so a trader never waits for a counterparty. Up to **3× leverage**, funding settled
against the oracle.

> **Why it is not enough:** a vAMM produces synthetic exposure, not liquidity. When
> traders are net profitable there is no natural counterparty whose losses fund them. That
> is what the LP vault is for — and what most of the engineering below is about.

### 3. Policy markets — `WeatherPolicyMarket.sol`

One-sided cover sold directly from pooled LP capital. A buyer pays a premium priced off
multi-decade history; the vault underwrites the payout.

**This is the one that works at zero scale.** It clears with a single buyer and a single
LP. The vault earns the premium when the strike is not breached, and that return is
uncorrelated with crypto — which is the actual reason capital shows up.

---

## ⚙️ Mechanics in detail

### The virtual AMM

`VirtualAMM.sol` is a pure library holding no state and no assets. Reserves are synthetic
accounting figures used only for price discovery.

```
mark price = collateralReserve × 1e18 / weatherReserve
k          = collateralReserve × weatherReserve      (invariant)
```

Opening a long adds to the collateral reserve and takes exposure out of the weather
reserve; a short does the reverse. Price impact is the constant-product curve, exactly as
in a spot AMM — but no tokens are ever swapped.

Against the reference Tokyo pool (1,000,000 collateral / 40,000 exposure, mark $25.00),
the frontend's depth ladder computes:

| Order | Long fill | Short fill | Impact |
|---|---|---|---|
| $500 | $25.01 | $24.99 | 0.05% |
| $5,000 | $25.12 | $24.88 | 0.50% |
| $25,000 | $25.62 | $24.38 | 2.50% |

Those numbers are produced by the same `calculatePerpQuote` the trade terminal uses — not
by marketing copy.

### Funding — and why it took three attempts

Funding pulls the mark price toward the oracle. Positive rate: longs pay shorts.

```solidity
deviationBps = (markPrice − oraclePrice) × 10000 / oraclePrice
rate         = clamp(deviationBps, −capBps, +capBps)
```

Two bugs here were found by measurement, not review, and both are documented in the source:

**The scale bug.** A `1e18` mark price was compared against a `6`-decimal oracle reading.
The deviation was astronomically large, so the rate pinned at its cap forever — funding
was a fixed maximum levy on one side rather than a corrective force. *Every existing test
still passed after the fix*, which is the clearest possible evidence that none of them had
asserted funding responds to anything.

**The sandwich.** Funding was keyed off the cumulative index at open, so a position
collected an entire interval's funding however briefly it had existed. Open the largest
permitted position on the favoured side one block before settlement, collect, close.
Twenty rounds of that extracted **43.6% of all LP capital** in simulation.

The first fix — skip the interval a position was only partly present for — closed the
exploit and replaced it with a consistent bias *against* traders: a position present for
99% of an interval was paid for none of it.

The shipped fix is **continuous time-weighted accrual**. Note that scaling the index *at
settlement* does not work: the index would still move in discrete jumps, so a position
opened mid-interval still captures the whole preceding window. The index has to be a
function of time **when it is read**:

```solidity
function effectiveFundingIndex() public view returns (int256) {
    if (currentFundingRate == 0) return cumulativeFundingIndex;
    uint256 elapsed = block.timestamp - lastFundingSettledAt;
    if (elapsed > fundingInterval) elapsed = fundingInterval;
    return cumulativeFundingIndex + (currentFundingRate * int256(elapsed)) / int256(fundingInterval);
}
```

The same scenario now shows the trader losing money and the pool intact.

**Demo vs production presets.** `PerpConstants` carries both, and the distinction is
explicit: 5% per 15 minutes (~480% annualised) exists so funding visibly moves in a
five-minute walkthrough, and is indefensible for real capital. Markets default to the
production values — 0.75% per 8 hours — and the demo preset must be applied deliberately,
so it cannot ship by accident.

### Liquidation

Maintenance margin is **10% of notional**; liquidators earn **2%**.

```solidity
equity = collateral + unrealisedPnl
liquidatable  ⟺  equity < notional × 1000 / 10000
```

The close path settles PnL against the quote taken **while the position is still on the
curve**, then removes it. Reversing that order double-charges slippage — which is exactly
what the third documented bug did, costing up to **69% of collateral** on large positions.

### Pricing — the part most weather protocols skip

Without climatology a weather contract has no price. Both sides posting equal collateral
silently asserts every outcome is a coin flip. If a threshold has been crossed in 27 of
the last 30 years, the "yes" side is being asked to pay even money on a 90% event. That is
a trap, not a market.

`StrikeProbabilityOracle` stores, per (region, variable, strike, month):

- historical breach probability in bps
- **the sample size behind it**, so a consumer can refuse to price against a thin record
  (`MIN_SAMPLE_YEARS = 10`)

It also stores a separate **climatology level** — the expected value of a *single oracle
reading*. That distinction is load-bearing: a perp's index price is one reading, so posting
a monthly total where a daily mean belongs would be wrong by roughly thirty times. Same
class of error as the funding scale bug.

This feeds three gates:

- **Classic markets** publish `fairLongShareBps()` and refuse deposits that push the
  long/short split further from fair odds. **BINARY only** — LINEAR and CAPPED need the
  loss distribution rather than one quantile of it, and are left explicitly *unpriced*
  rather than given a wrong number that looks authoritative.
- **Perp markets** cannot be created at a mark price far from the climatological
  expectation for the month they open into. The month is derived on-chain via `CivilDate`
  rather than declared, so the check cannot be pointed at a convenient season.
- **Policy markets** price the premium off breach probability, with a floored risk load
  (min +5%, default +30%) because underwriting at fair value is a losing business after
  variance.

### Settlement measures what pricing measured

`weather-seed/src/climatology.ts` sums daily precipitation into a **monthly total** and
counts how often that total breached the strike. Settlement used to compare a **single
reading at expiry** against that same threshold.

One day's rainfall is almost always below a monthly total — so drought cover triggered on
nearly every policy while being charged the monthly-total probability. The pricing was
right; the settlement was measuring a different quantity. Policies now carry an
`Aggregation` (`SUM` for rainfall, `AVERAGE` for temperature), snapshotted at purchase so
a later config change cannot reinterpret cover already sold.

---

## 📈 How capital scales

This is where a weather protocol either works or quietly becomes a hedge fund with extra
steps.

### The three-tier loss waterfall

| Tier | Contract | Role |
|---|---|---|
| 1 | `FirstLossReserve` | Protocol-owned, **fee-funded and self-replenishing** — absorbs first |
| 2 | `JuniorTranche` | Subordinated LPs; covers a defined band, earns a bounded multiple of senior yield |
| 3 | `BreezeLiquidityVault` | Senior LPs (ERC-4626); protected, absorbs the residual |

Both upper tiers are **optional**. With neither configured the waterfall collapses to the
single-pool behaviour, and nothing about the LP interface changes.

Three properties came out of *measuring* the waterfall rather than designing it
(`WaterfallMonteCarloTest`):

**Junior capital must be additive.** Holding total LP capital constant and carving junior
out of it, the waterfall beat a flat pool on 4 of 5 seeds but **lost on the mean** — a
senior tranche 25% thinner moves 25% further per unit of residual loss once junior is
exhausted. Tranching redistributes loss; it does not reduce it. Junior therefore counts
toward backing capacity only up to a bounded share, so moving senior LPs into junior buys
no extra capacity while genuinely new subordinated capital does.

**Junior covers a band, not an open-ended slice.** Attachment and exhaustion points give
the layer a per-period aggregate limit, so its exposure is bounded in time and therefore
priceable. Width set by sweep.

**Tier 1 needs its own reserve.** It used to share `InsuranceFund` with the liquidation
backstop, which let the vault starve liquidation — measured at **11% coverage** of a
deficit a dedicated reserve covers in full.

### Capacity is preventive, not reactive

The reactive design accepted a trade, tried to reserve capital for it, then dealt with the
shortfall — meaning the market could reach a state its capital did not cover and only find
out on the way out.

```solidity
maxNotionalCapacity = (marketReserved + reservableByMarket) × 10000 / skewReserveBps
```

`openPosition` refuses anything beyond it **before any token moves**, so under-reserving
is unrepresentable rather than merely detected. `availableNotional(bool)` publishes the
remaining room so a caller can size a trade that will be accepted instead of discovering
the limit by reverting.

Exposure is sized on `worstCaseNotionalExposure()` — the **larger** side, not the
difference. A balanced 100k/100k book has zero skew and would reserve nothing, but the
moment one side closes the imbalance is 100k, and by then the LPs whose capital would have
backed it have already been free to leave.

`skewReserveBps = 5000` (cover a 50% adverse move) is **calibrated, not guessed** —
sweeping {30, 50, 75, 100}% across 3 seeds × 900 actions under the most aggressive funding
parameters the protocol permits:

| Coverage | Result |
|---|---|
| 30% | 28 short-paid closes, one seed drained, 9.9% rejection |
| **50%** | **zero shortfalls, 8.6% rejection ← frontier** |
| 75% | zero shortfalls, 14.2% rejection |
| 100% | zero shortfalls, 21.0% rejection |

Under-reserving is strictly worse on *both* axes: 30% fails to pay traders **and** rejects
more trades, because a drained pool refuses everything.

### Scarcity is priced, not only rationed

A hard cap is a cliff: below it every trade costs the same, at it nothing gets through.
`utilizationFeeBps` scales linearly with capacity utilisation — zero on an empty book, up
to +0.40% of collateral on a full one — charged **only** on flow that raises worst-case
exposure. A trade growing the smaller side consumes no scarce capacity and pays nothing
extra.

The surcharge does **not** replace the cap. The cap is a solvency bound derived from
capital that exists; the surcharge makes the approach to it expensive so the cliff binds
less often.

### Correlation, not contagion

Isolating pools protects unrelated markets from each other. **Weather markets are not
unrelated** — rainfall in Tokyo and rainfall in Osaka can be the same storm system.
Isolation gives an appearance of diversification while the underlying peril is shared.

`PerilExposureRegistry` buckets markets by declared peril and caps exposure across the
group. Measured without it: two correlated rainfall markets committed **599,400 against a
1,000,000 pool — a 50% overshoot** of any single peril's cap.

Exposure is **pulled, not pushed**: the registry reads `requiredVaultReserve()` from each
market when asked. Push accounting would need every open, close and liquidation to update a
mirror of state that already exists, and any missed path leaves it wrong in a way nothing
detects. Pulling cannot desync because there is nothing to sync.

### How this actually helps someone trade

| Who | What they do | What it replaces |
|---|---|---|
| Rice farmer, Tokyo | Buys drought cover for the monsoon month | A crop policy with a 3-month claims cycle |
| Ski resort, Nagano | Shorts a snowfall perp, exits when the forecast turns | Nothing — no instrument exists at this size |
| Solar operator, Dubai | Longs a temperature-linked contract | A bilateral swap needing an ISDA and a bank |
| Yield seeker | Deposits into the senior vault | Crypto-correlated LP yield |
| Risk-seeking LP | Subscribes to the junior tranche at ~2× | — |

The last two matter more than they look. Weather risk is **genuinely uncorrelated with
crypto**, which makes the vault an unusual thing in DeFi: a yield source whose drawdowns
do not arrive at the same moment as everything else's.

---

## 🥊 Competitors and where we differ

| | Settlement | Two-sided? | Exit before expiry? | Priced off history? | Retail-reachable? |
|---|---|---|---|---|---|
| **CME weather futures** | Exchange | ✅ | ✅ | ✅ | ❌ 13 US cities, institutional |
| **[Arbol](https://www.arbol.io/) / dClimate** | Parametric, automatic | ❌ cover only | ❌ | ✅ | ⚠️ institutional agri |
| **[Etherisc](https://etherisc.com/)** | Parametric, automatic | ❌ cover only | ❌ | ⚠️ per-product | ✅ |
| **Traditional crop insurance** | Adjuster | ❌ | ❌ | ✅ actuarial | ✅ slow |
| **BreezeSwap** | Parametric, automatic | ✅ all three products | ✅ perps + ERC-1155 transfer | ✅ on-chain, enforced | ✅ |

**Versus CME.** They have real liquidity and decades of credibility; we do not. What we
have is reach — permissionless market creation for any region the oracle covers, in any
size, without a clearing relationship. CME's 13 HDD/CDD cities is not a limitation of
demand.

**Versus Arbol / Etherisc.** Both are excellent at the thing they do, and both are
insurance. You buy cover, you hold it to expiry, and someone must underwrite you first.
BreezeSwap has a policy product that behaves the same way — *and* a perpetual market where
you can take either side and leave whenever you want. The policy market is our
Arbol-equivalent; the perp is the thing neither of them offers.

**Versus "an oracle and an if-statement".** This is the honest competitor at a hackathon,
and the difference is entirely in the parts that are boring to demo: fair-odds gating,
correlated-peril caps, a calibrated reserve model, a loss waterfall, and continuous
funding accrual that survives a sandwich test. Any of those missing is a protocol that
works in a demo and loses its LPs' money in production.

**Flare-native.** FTSO and FDC adapters exist for oracle sourcing; FAssets are supported
as collateral via `FAssetsCollateralAdapter`, so FXRP can back a weather position. See
[Honest limitations](#-honest-limitations) on how far the oracle adapters actually go.

---

## 🧪 Testing everything

### Prerequisites

```bash
node -v      # ≥ 20
pnpm -v      # 10.5.2
forge --version
```

If Foundry is installed but not on PATH (common on Windows):

```bash
export PATH="$PATH:$HOME/.foundry/bin"
```

### 1. Contracts — the strongest evidence in the repo

```bash
cd contracts && forge test --summary
```

Expect **568 passed, 0 failed** across 54 suites in roughly 50 seconds.

Run the suites that correspond to the claims above:

```bash
# The three documented bugs, each with a regression test
forge test --match-contract PerpFundingScaleTest -vv      # 29 tests — the scale bug
forge test --match-contract PerpCloseAccountingTest -vv   # 4  tests — double slippage
forge test --match-contract EconomicGamesTest -vv         # the funding sandwich

# Capital model
forge test --match-contract WaterfallMonteCarloTest -vv   # tranching measured, not assumed
forge test --match-contract ReserveMonteCarloTest -vv     # where skewReserveBps=5000 comes from
forge test --match-contract FirstLossIsolationTest -vv    # 12 tests — tier 1 vs liquidation

# Exposure controls
forge test --match-contract PerilAggregationTest -vv      # 19 tests — correlated caps
forge test --match-contract PerpCapacityCapTest -vv       # 14 tests — preventive capacity

# Worst cases, by name
forge test --match-contract NightmareScenariosTest -vv

# Invariants: 256 runs × 64 depth
forge test --match-path "test/invariant/*"

# Fuzz: 10,000 iterations
forge test --match-contract PayoffCalculatorFuzzTest
forge test --match-contract VirtualAMMFuzzTest
```

Coverage:

```bash
forge coverage --report summary
```

### 2. Indexer

```bash
cd indexer
cp .env.example .env        # fill in SUPABASE_URL, SERVICE_ROLE_KEY, DATABASE_URL
pnpm install && pnpm build
pnpm start                  # runs migrations, then serves :3001
```

Verify it is healthy and every route the frontend calls returns 200:

```bash
curl -s localhost:3001/api/health | jq
# {"status":"ok","lastIndexedBlock":33693764,...}

for e in markets perp-markets weather/regions protocol/fees/total \
         protocol/insurance-fund protocol/treasury protocol/trade-history \
         admin/audit-log; do
  printf "%-28s %s\n" "$e" \
    "$(curl -s -o /dev/null -w '%{http_code}' "localhost:3001/api/$e?chainId=114")"
done
```

All 19 SDK-called routes are listed under [Indexer API](#-indexer-api).

### 3. Web app

```bash
cd web
cp .env.example .env.local
pnpm dev                    # :3000
```

```bash
pnpm build      # production build — must succeed
npx tsc --noEmit
npx eslint .
```

**Manual checklist:**

| Check | Where | Expect |
|---|---|---|
| Live data reaches the UI | `/markets` | Real Coston2 markets, strikes like `40–48°C` |
| Charts render | `/markets/<address>` | Payoff curve + observed readings side by side |
| Quote maths | `/perp-markets/<addr>` → margin `100`, leverage `2×` | Fee `$0.10`, net `$99.90`, size `$199.80`, liq `$13.89` |
| Liquidation agrees | Compare terminal vs `/portfolio` | Same number both places |
| Sample data is labelled | Any empty panel | Amber **"Sample data"** chip — never silent |
| Nothing overflows | Resize 375px ↔ 1440px | No horizontal page scroll; wide tables scroll inside their panel |
| Colour-blind safe | Any long/short mark | Word **and** arrow present, not colour alone |

Paste into DevTools to check containment at any width:

```js
[...document.querySelectorAll('body *')]
  .filter(el => el.getBoundingClientRect().right > innerWidth + 1)
  .map(el => el.tagName + '.' + el.className)
// → []  at every width
```

### 4. End-to-end on Coston2

```bash
# 1. Get testnet C2FLR
open https://faucet.flare.network/coston2

# 2. Deploy the full stack (simulate first — nothing broadcasts without --broadcast)
cd contracts
PRIVATE_KEY=0x... forge script script/DeployProtocol.s.sol

# 3. Seed climatology, or the pricing gates stay inert
cd ../weather-seed && pnpm seed && pnpm climatology

# 4. Drive a full lifecycle: create → mint both sides → push reading → settle → redeem
cd ../contracts
PRIVATE_KEY=0x... FACTORY_ADDRESS=0x... ORACLE_ADDRESS=0x... USDT_ADDRESS=0x... \
  forge script script/DemoLifecycle.s.sol --rpc-url coston2 --broadcast
```

`DemoLifecycle` creates a market with a **2-minute expiry** specifically so a settlement
can be demonstrated live.

---

## 🎬 Demo script for judges

Twelve minutes, five beats. Have `/perp-markets/<tokyo>` and a block explorer tab open
before you start.

### Beat 0 — Setup (before the clock)

```bash
cd indexer && pnpm start          # terminal 1
cd web && pnpm dev                # terminal 2
export PATH="$PATH:$HOME/.foundry/bin"
cd contracts                      # terminal 3, ready to run tests
```

Wallet on Coston2 with C2FLR and mUSDT.

### Beat 1 — The problem, in one sentence (1 min)

> "CME lists weather futures for thirteen US cities. A rice farmer in Tokyo cannot use
> them. Insurance would take three months and an adjuster. We built the market that
> doesn't exist."

Landing page: the globe shows the five regions feeding one settlement core.

### Beat 2 — Trade something (3 min)

`/perp-markets` → Tokyo → the trade terminal.

- Enter **100** margin, drag leverage to **2×**
- Point at the quote panel: fee **$0.10**, net margin **$99.90**, position **$199.80**,
  estimated entry **$25.00**, price impact **0.04%**, liquidation **$13.89**
- **Say the important thing:** *"That liquidation price is the same formula the portfolio
  uses after you open. They used to disagree — $13.75 versus $13.89 — which is the kind of
  bug that costs someone money."*
- Open the position. Show the tx on the explorer.
- Go to `/portfolio` — same liquidation price, live PnL, risk gauge.

Scroll the depth ladder: **$500 costs 0.05%, $25,000 costs 2.50%** — real constant-product
maths, not a lookup table.

### Beat 3 — Settlement nobody can veto (3 min)

`/markets/<address>` on a market past expiry.

- Payoff curve with the strike and cap marked; observed readings with the payout band
  shaded and *"13 of 30 readings landed in the payout range"*
- Press **Settle market**. Anyone can call it — no privileged settler
- Show the payout on-chain, then redeem from `/portfolio`

> "No claim. No adjuster. The contract computed both payouts from one oracle reading, and
> the button that triggered it is available to anyone."

### Beat 4 — The part that separates this from a weekend project (3 min)

Terminal 3:

```bash
forge test --summary            # 568 passed, 0 failed
```

Then pick **one** story and tell it properly — the funding sandwich is the best:

```bash
forge test --match-contract EconomicGamesTest -vv
```

> "Funding used to pay a full interval however briefly you'd been open. Open the biggest
> position on the favoured side one block before settlement, collect, close. Twenty rounds
> took 43.6% of all LP capital. The first fix broke it the other way — a position open for
> 99% of an interval got paid for none of it. What shipped accrues funding continuously,
> so you're paid for exactly the time you were exposed."

If there is time, one more:

```bash
forge test --match-contract ReserveMonteCarloTest -vv
```

> "The 50% reserve ratio isn't a guess. We swept 30/50/75/100 across three seeds and nine
> hundred actions. Thirty percent drained a seed *and* rejected more trades than fifty,
> because a drained pool refuses everything."

### Beat 5 — Why it scales, and close (2 min)

Whiteboard or `/docs`:

- **Waterfall:** protocol-owned first loss → junior tranche → senior LPs. Junior is
  additive, capped, and earns 2× pro-rata because it takes the whole first loss
- **Correlated caps:** *"Tokyo rain and Osaka rain are the same storm. Without an
  aggregate cap two markets committed 599,400 against a 1,000,000 pool."*
- **Close on the honest bit:** *"The only working oracle today is the mock. FTSO and FDC
  adapters are written and revert on read. Settlement is trusted input, and that's the
  biggest gap between this and production — it's in SECURITY.md, not buried."*

### If something breaks

| Symptom | Fix |
|---|---|
| Panels show "Sample data" | Indexer down or `NEXT_PUBLIC_INDEXER_URL` unset — check `localhost:3001/api/health` |
| Perp pages empty | Perp tables have no rows yet; the fallback is labelled and safe to demo |
| Wallet says wrong network | Red banner has a one-click **Switch to Coston2** |
| Settle button missing | Market has not passed expiry, or is already settled |

### What judges consistently ask

**"Where does the weather data come from?"** Open-Meteo, seeded on-chain through
`MockWeatherOracle`. FTSO and FDC adapters exist and revert on read — say so plainly.

**"What stops oracle manipulation?"** `ORACLE_UPDATER_ROLE`, a 24-hour staleness bound,
and `OracleManipulationSecurityTest` (5 tests). It is still a trusted feed.

**"Who takes the other side?"** Classic: another trader. Perp: the vAMM, backed by the LP
vault. Policy: the vault directly. That progression *is* the architecture.

**"How do you stop LPs getting wiped?"** Three-tier waterfall, preventive capacity caps
derived from actual backing, correlated-peril aggregation, and a reserve ratio calibrated
by sweep. All measured in `test/simulation/`.

---

## 🌐 Deployment status

Live on **Coston2 testnet only**. The SDK, indexer and frontend are genuinely parametrised
by chain ID rather than hardcoded, so a mainnet deployment needs only a registry entry —
but **no mainnet deployment exists**, and nothing here should be read as claiming
otherwise.

| Network | Chain ID | Status |
|---|---|---|
| Flare Coston2 Testnet | 114 | ✅ Deployed & verified |
| Flare Mainnet | 14 | ❌ Not deployed |

### Coston2 (chain 114)

| Contract | Address |
|---|---|
| **BreezeAccessControl** | [`0x3788420A…3853`](https://coston2-explorer.flare.network/address/0x3788420AB4Ef4D2c2dd22c151fd6CB93d2543853) |
| **BreezeMarketFactory** | [`0x699fd810…Bbaf`](https://coston2-explorer.flare.network/address/0x699fd810EC7C0620a9BF01Cd73356770Ae0aBbaf) |
| **BreezePerpFactory** | [`0x05e309f0…Be46`](https://coston2-explorer.flare.network/address/0x05e309f0434942BDfa0D961E25FaCc4483BABe46) |
| **FeeConfig** | [`0xB0D29530…325C`](https://coston2-explorer.flare.network/address/0xB0D295305d653F044E4178bb6966e76FB79f325C) |
| **InsuranceFund** | [`0x96952FC0…a36f`](https://coston2-explorer.flare.network/address/0x96952FC0fBe43AA72E1D08B11daD5cA56c12a36f) |
| **ProtocolTreasury** | [`0xecB7Ff4d…5058`](https://coston2-explorer.flare.network/address/0xecB7Ff4dA80532F5C7803392761643bA4dDe5058) |

> **These addresses predate the capital structure.** The live deployment is the
> pre-waterfall stack — no liquidity vault, junior tranche, first-loss reserve, peril
> registry or policy market, and a single-EOA admin. Everything under
> [How capital scales](#-how-capital-scales) exists in the repository and is deployed by
> `script/DeployProtocol.s.sol`, but is **not** at the addresses above. Redeploying is what
> would change that, and has not been done.

### Deploying

```bash
cd contracts

# Simulate. Every optional variable defaults to DEMO behaviour and says so loudly.
PRIVATE_KEY=0x... forge script script/DeployProtocol.s.sol

# Production. Refuses to run without real collateral and a governance multisig.
PRIVATE_KEY=0x... COLLATERAL_TOKEN=0x... GOVERNANCE_MULTISIG=0x... \
  forge script script/DeployMainnet.s.sol --rpc-url flare_mainnet --broadcast
```

| Variable | Required by | Effect if unset |
|---|---|---|
| `PRIVATE_KEY` | both | script fails |
| `COLLATERAL_TOKEN` | `DeployMainnet` | `DeployProtocol` deploys a **demo** token |
| `GOVERNANCE_MULTISIG` | `DeployMainnet` | deployer keeps every role — **not** production |
| `TIMELOCK_DELAY` | neither | 2 days (floor of 1 day on mainnet) |
| `ORACLE_UPDATER` | neither | defaults to the multisig |

With a multisig configured, `ADMIN_ROLE` moves behind a self-administered
`TimelockController` and the deployer renounces every role. `PAUSER_ROLE` and
`ORACLE_UPDATER_ROLE` stay immediate — a pause that lands in two days is not an emergency
control, and readings are posted continuously.

One test asserts every link in the deployment: `test/integration/DeploymentWiring.t.sol`.

---

## ☁️ Hosted deployment

| Service | Platform | Directory | Config |
|---|---|---|---|
| Web app | Vercel | `web/` | Project settings + `web/.env.example` |
| Indexer API | Railway | `indexer/` | `indexer/railway.json`, `indexer/.env.example` |

### Railway — indexer

`indexer/railway.json` sets build and start commands and points the health check at
`/api/health`. Set the service **root directory** to `indexer` and provide every variable
in `indexer/.env.example`.

`DATABASE_URL` is required, not optional: `pnpm start` runs migrations before booting. A
deploy without it fails fast rather than starting an API whose schema is behind the code —
which is exactly how the perpetual and fee endpoints came to return `500` in production
while every other route worked.

Railway injects `PORT`; the server honours it and falls back to `3001`.

`indexer/Dockerfile` is an alternative to Nixpacks and expects the **repository root** as
its build context, because the pnpm lockfile lives there:

```bash
docker build -f indexer/Dockerfile -t breezeswap-indexer .
```

### Vercel — web

Set the project **root directory** to `web` and enable *Include source files outside of the
Root Directory*, since `web` depends on the `sdk` workspace package
(`"@breezeswap/sdk": "file:../sdk"`). `sdk/dist` is committed, so Vercel resolves it
without a separate SDK build.

Set every variable in `web/.env.example`. `NEXT_PUBLIC_*` values are **inlined at build
time** — changing one in the dashboard does nothing until you redeploy.

`NEXT_PUBLIC_INDEXER_URL` must point at the Railway service. If missing, the app logs a
named warning and falls back to `localhost:3001`, which will not resolve from a browser;
every panel then shows sample data. There is deliberately no remote default, because the
previous one pointed at a retired host and failed silently.

### Database migrations

```bash
cd indexer && pnpm migrate
```

Applied migrations are recorded in `schema_migrations`, so the command is idempotent and
`pnpm start` runs it on every boot.

> **`0001_init.sql` is a destructive bootstrap** — it opens with `DROP TABLE ... CASCADE`.
> The runner skips it whenever BreezeSwap tables already exist and records it as applied
> instead. Only `pnpm migrate --force-bootstrap` replays it, and that erases every indexed
> market, position, settlement and weather reading.

---

## 🔌 Indexer API

Read-only REST under `/api`. Every route the SDK calls, all verified returning `200`.

| Route | Returns |
|---|---|
| `GET /api/health` | Service status and last indexed block |
| `GET /api/markets` | Classic markets for a chain |
| `GET /api/markets/:address` | One classic market |
| `GET /api/markets/:address/positions` | Positions minted in a market |
| `GET /api/users/:address/positions` | A wallet's classic positions |
| `GET /api/users/:address/perp-positions` | A wallet's perpetual positions |
| `GET /api/weather/regions` | Known oracle regions |
| `GET /api/weather/:regionId` | Historical readings for a region |
| `GET /api/perp-markets` | Perpetual markets |
| `GET /api/perp-markets/:address` | One perpetual market |
| `GET /api/perp-markets/:address/stats` | Mark/oracle price, funding, open interest |
| `GET /api/perp-markets/:address/candles` | OHLC mark price candles |
| `GET /api/perp-markets/:address/mark-price-history` | Raw mark price snapshots |
| `GET /api/perp-markets/:address/funding-history` | Settled funding periods |
| `GET /api/perp-markets/:address/trade-history` | Trades on one market |
| `GET /api/perp-markets/:address/positions` | Open positions on one market |
| `GET /api/protocol/trade-history` | Protocol-wide trade feed |
| `GET /api/protocol/fees/total` | Cumulative fees collected |
| `GET /api/protocol/insurance-fund` · `/treasury` | Reserve balances |
| `GET /api/admin/audit-log` | Role and pause events |

All routes accept `?chainId=` and default to `114`. SDK read failures resolve to an empty
result rather than throwing, so a degraded indexer downgrades the UI to its sample-data
fallback instead of breaking a page.

---

## 🖥️ Web application

Next.js 16 App Router. Everything below the wallet layer reads through `@breezeswap/sdk`,
so the same calls work from a third-party integration.

### Design system

One dark canvas, one accent. Cyber Yellow (`#fde047`) is unreadable on a light surface —
roughly 1.2:1 against cream — so it can only ever be a background block there. On
`#0a0b0e` it reaches 14.8:1 and works as an accent, a chart series and a focus ring. Every
token clears WCAG AA against the canvas.

The accent is a **spotlight, not a coat of paint**: one yellow element per section, being
either the primary action or the single number that matters.

Component classes live in `app/globals.css` inside `@layer components`, so Tailwind
utilities always win over them. (They previously sat outside any layer, which silently
defeated every utility applied alongside them — `pl-9` on a `.field` resolved to the
component's own padding.)

### Charts

All Recharts, driven by `web/lib/chartTheme.ts` and framed by
`components/charts/ChartCard.tsx`. The frame fixes each plot's pixel height, which is what
stops a responsive SVG from widening its grid column and, through it, the page.

Long and short are the only two-series pairing. The pair was **validated, not eyeballed** —
10.2:1 and 5.4:1 contrast, ΔE 12.0 separation under deuteranopia — and every long/short
mark also carries its word and a directional arrow, so identity never rests on hue alone.

### Sample-data fallback

Where the indexer returns nothing, surfaces fall back to a seeded generator in
`web/lib/demoData.ts` and render a visible **"Sample data"** chip. Deterministic per market
address, so demos reproduce. Live data always takes precedence.

---

## ⚠️ Honest limitations

Read [SECURITY.md](SECURITY.md) for the full list. The ones that matter most:

**The only functioning weather oracle is `MockWeatherOracle`.** The FTSO and FDC adapters
revert on read. Settlement is trusted input regardless of how the protocol is deployed.
This is the largest gap between this repository and a production system.

**The live Coston2 addresses predate the capital structure.** The waterfall, peril
registry and policy market exist in the repo and deploy from `DeployProtocol.s.sol`, but
are not at the published addresses.

**LINEAR and CAPPED classic markets are unpriced.** Fair-odds gating covers BINARY only.
The others need the loss distribution, not one quantile of it, and are flagged unpriced
on-chain rather than given an authoritative-looking wrong number.

**The reserve calibration has a known hole.** 40% is untested, so the failure boundary is
only located between 30% and 50%.

**No professional audit.** Mainnet is gated on one.

---

## Project structure

```
breezeswap/
  contracts/            # Foundry — 29 contracts, 568 tests
    src/core/           #   Classic markets, factory, ERC-1155 positions
    src/perp/           #   vAMM perpetuals, funding, peril registry
    src/policy/         #   One-sided cover sold from LP capital
    src/vault/          #   Three-tier loss waterfall
    src/oracle/         #   Weather + climatology oracles, FTSO/FDC adapters
    src/settlement/     #   PayoffCalculator — the zero-sum invariant
    test/simulation/    #   Monte Carlo: reserve model, waterfall
    test/stress/        #   Named worst cases
    script/             #   DeployProtocol · DeployMainnet · DemoLifecycle
  sdk/                  # TypeScript SDK (@breezeswap/sdk), dist committed
  indexer/              # Event watchers + REST API (Railway)
    db/migrations/      #   Ordered SQL, tracked in schema_migrations
    scripts/migrate.js  #   Idempotent runner, bootstrap-guarded
  web/                  # Next.js App Router (Vercel)
    lib/chartTheme.ts   #   Shared Recharts theme and formatters
    lib/demoData.ts     #   Seeded fallback, always badged
  weather-seed/         # Open-Meteo seeder + 30-year climatology
  docs/                 # SUBMISSION.md · DEMO_SCRIPT.md
```

---

## Further reading

- 🏗️ **[ARCHITECTURE.md](ARCHITECTURE.md)** — contract-by-contract breakdown
- 🛡️ **[SECURITY.md](SECURITY.md)** — invariants, the three bugs in full, disclosed limitations
- 🔌 **[INTEGRATION.md](INTEGRATION.md)** — SDK integration guide
- 📜 **[docs/SUBMISSION.md](docs/SUBMISSION.md)** — hackathon framing and roadmap
- 🎬 **[docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)** — extended multi-wallet test protocol

---

<sub>Sources for market context: [CME Group — Overview of Weather Markets](https://www.cmegroup.com/education/lessons/overview-of-weather-markets) ·
[Arbol](https://www.arbol.io/post/how-blockchain-technology-will-transform-the-weather-insurance-industry) ·
[Etherisc](https://etherisc.com/) ·
[Tokenized Weather Derivatives Could Finally Reach Main Street](https://blockchainreporter.net/tokenized-weather-derivatives-could-finally-reach-main-street)</sub>
