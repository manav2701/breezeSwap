# BreezeSwap Security Architecture & Emergency Procedures

## 1. Access Control & Role Hierarchy

All administrative actions across Classic and Perpetual markets are permissioned via `BreezeAccessControl`:

- **`DEFAULT_ADMIN_ROLE`**: Can grant and revoke all protocol roles.
- **`ADMIN_ROLE`**: Can authorize perpetual markets on the `InsuranceFund`, update fee rates via `FeeConfig`, and withdraw team revenue from `ProtocolTreasury`.
- **`PAUSER_ROLE`**: Can trigger emergency pauses (`pauseOpens()`, `pauseFactory()`).
- **`ORACLE_UPDATER_ROLE`**: Can post verified weather readings to `MockWeatherOracle`.
- **`MARKET_CREATOR_ROLE`**: Required to deploy new perpetual weather markets via `BreezePerpFactory`.

---

## 2. Emergency Pause Matrix

| Function | Gated by `whenNotPaused`? | Rationale |
|---|---|---|
| `openPosition()` | ✅ YES | Halts new leverage exposure during market anomalies. |
| `closePosition()` | ❌ NO | Traders can ALWAYS withdraw collateral even during emergency pause. |
| `liquidate()` | ❌ NO | Liquidators can ALWAYS process undercollateralized positions to protect solvency. |
| `createPerpMarket()` | ✅ YES | Halts new market creation when factory is paused. |

---

## 3. Perpetual Risk Model Parameters

- **Max Leverage**: 3x ($300\%$)
- **Maintenance Margin**: $10\%$ of position notional
- **Liquidation Penalty**: $2\%$ reward to liquidator, remaining collateral to `InsuranceFund`
- **Minimum Position**: 1 token (`minCollateral`, admin-settable up to 10,000). Dust positions
  are unliquidatable in practice, since a 2% reward on a trivial position does not cover the gas
  to claim it.
- **Max Concurrent Open Positions**: 1,000 per market, so the obligations loop is bounded.
- **Coverage Ratio** (`skewReserveBps`): $50\%$ of worst-case notional exposure, set by
  simulation — see the calibration evidence in §8.
- **Capacity Surcharge** (`utilizationFeeBps`): up to $0.40\%$ of collateral, scaled linearly
  with how full the book is against its capacity. Charged only on opens that raise worst-case
  exposure, never on balancing flow and never on closes. Ceiling 200 bps, so the worst
  combination of both fee knobs is 3% of collateral on a completely full book.

### Funding parameters — two presets

Funding is configured **per market**, and the contract default is the production preset. The
demo preset must be applied explicitly via `setFundingParams`, so it can no longer ship by
accident.

| | Interval | Rate cap | Annualised at cap |
|---|---|---|---|
| **Production (default)** | 8 hours | 75 bps | ~2.7%/day |
| Demo preset (opt-in) | 15 minutes | 500 bps | ~480% |

The demo values exist so funding visibly moves during a short walkthrough. They were the
default for the whole life of the project, and while the oracle-scale defect (§6b) was live they
were also the only rate any market ever charged — which is how a figure that absurd went
unremarked. Bounds: interval 15 minutes to 1 day; rate cap 1 to 500 bps, so nothing more
aggressive than the demo preset can ever be configured.

Funding accrues **continuously**, not in per-interval jumps — see §6c.

---

## 4. Fee Bounds & Revenue Security

- **Hard-Capped Fee Ceiling**: `FeeConfig.MAX_FEE_BPS` is hard-coded to **1.00% (100 BPS)** and is immutable. No admin action can raise fees above 1.00%.
- **Fee Floor**: `FeeConfig.MIN_FEE_BPS` is hard-coded to **0.01% (1 BPS)**.
- **Default Fee Rate**: Set to **0.10% (10 BPS)**.
- **Classic Markets Fee Scope**: Classic Options Markets do not currently charge a trading fee; Perpetual vAMM Markets do. This asymmetry is intentional for v1 given hackathon time constraints and is a documented roadmap item.

### Revenue split — three destinations, not two

Every fee divides three ways, and the third leg was added to fix a measured defect rather than
to add a feature.

| Destination | Share | Purpose |
|---|---|---|
| `InsuranceFund` | 50% | Liquidation backstop — clears bad debt when a position's equity goes negative |
| `FirstLossReserve` | 30% | Waterfall tier 1 — absorbs vault loss before any LP capital |
| `ProtocolTreasury` | 20% | Protocol revenue |

Previously the split was 80/20 and the waterfall's tier 1 drew the **same** `InsuranceFund`
balance the perp market draws for liquidation bad debt. One pot, two unrelated consumers, no
ordering between them — so the vault could drain the reserve liquidation depends on. See §8,
"Tier 1 was competing with the liquidation backstop", for the measurement.

The split is admin-settable within bounds. `MIN_INSURANCE_SHARE_BPS = 3000` stops governance
recreating the same inversion from the other direction by routing everything to tier 1;
`MAX_TREASURY_SHARE_BPS = 3000` stops fees being redirected out of risk capital and into
revenue. A market that has not been wired to a `FirstLossReserve` folds the first-loss leg into
the liquidation backstop, reproducing the original 80/20 behaviour exactly, so the tier is
opt-in rather than a migration requirement.

**ABI note**: `FeeCollected` gained a `firstLossShare` field and `FeeConfig.calculateFeeSplit`
now returns four values. The indexer ABI and the `fee_events` table were updated together
(`indexer/db/migrations/0005_first_loss_leg.sql`); an unchanged consumer would silently stop
matching the event topic rather than fail loudly.

---

## 5. Formal Verification & Testing Snapshot

- **Passing Test Suite**: 568/568 Tests Passed (100% Pass Rate across 54 Test Suites).
- **Core Line Coverage**: 100% VirtualAMM, 100% CollateralVault, 100% FundingRateEngine, 96.83% BreezeMarket.
- **Invariant Solvency Guarantees**: 14 invariants held across 256 runs × 64 depth, covering vault
  solvency, `k` preservation, open-interest consistency, authorised withdrawals, and the LP vault's
  reservation and share-claim properties.

---

## 6. Resolved Vulnerability — vAMM Close-Path Double Slippage

**Severity: critical. Found and fixed during the post-Phase-12 audit. Testnet only; no
mainnet deployment existed and no real funds were at risk.**

`BreezePerpMarket._executeClose` and `_executeLiquidation` updated `reserves` to the
post-close curve *before* calling `calculateUnrealizedPnl`, which re-quoted the same
`virtualSize` against reserves the position had already been removed from. Each closing
trade therefore had its own price impact applied twice.

Loss scaled as approximately `2 × notional² / collateralReserve`, so it grew with the
square of position size:

| Position | Leverage | Round-trip loss, no price movement |
|---|---|---|
| 1,000 units | 1x | 0.22% of collateral |
| 1,000 units | 3x | 1.81% of collateral |
| 50,000 units | 3x | **69.23% of collateral** |

A trader opening and immediately closing a large position lost most of their collateral
to an accounting error rather than to the market.

**Fix**: PnL is now computed from the quote taken while the position is still on the
curve, then the curve is updated. Regression coverage lives in
`test/security/PerpCloseAccounting.t.sol`.

**Why the existing 122 tests missed it**: no test performed an open-then-close round trip
and asserted the trader came out flat. Every perp test either checked a single leg or
asserted against values computed the same wrong way. This was a coverage gap, not a
wrong assertion — none of the 122 tests changed behaviour when the bug was fixed.

---

## 6b. Resolved Vulnerability — Funding Rate Pinned at the Cap

**Severity: high. Found while building the loss-waterfall simulation, not by a test.
Testnet only; no mainnet deployment existed and no real funds were at risk.**

`settleFunding` passed a raw oracle reading straight into
`FundingRateEngine.calculateFundingRate` alongside `reserves.markPrice()`. Mark price is
1e18-scaled. Oracle readings carry 6 decimals (`ORACLE_DECIMALS` in the SDK, which the
indexer and the climatology seeder both follow). Nothing reconciled the two.

The deviation was therefore of order 1e12 basis points on **every single call**, so the
rate was clamped to `MAX_FUNDING_RATE_PER_PERIOD` in the same direction forever. Funding
was not pulling mark toward index. It was a fixed 5%-per-15-minutes levy on one side that
no market condition could alter — roughly 480% annualised, charged unconditionally.

Two things made this hard to notice. First, nothing failed: funding accrued, positions
paid, no call reverted, and the funding index moved in a plausible-looking straight line.
Second, the `IWeatherOracle` NatSpec documented readings as `value * 100`, which no
component in the repository actually produced — so reading the interface confirmed the
wrong belief rather than correcting it. **Every existing test still passed after the fix**,
which is the clearest possible evidence that no test had ever asserted funding responded
to anything.

A second defect sat in the same expression. `uint256(reading.value)` on a negative reading
wraps to ~2^256, which reads as an astronomically high index price and pins funding at the
cap in the *opposite* direction. Temperature in °C goes negative routinely, so this was
reachable in ordinary operation on a frost market.

**Fix**: `oracleValueScale` (default 1e6, admin-settable for adapters of other precisions,
bounded at 1e18) normalises the reading onto the mark price's scale via `indexPrice()`.
Non-positive readings are refused with `NonPositiveIndexPrice` rather than cast — markets
on a variable that can go negative must use an offset encoding. `currentIndexPrice()`
publishes the normalised index so the mark/index gap is externally checkable; a funding
mechanism nobody can verify is one nobody notices has broken. The stale interface comment
has been corrected. Regression: `test/security/PerpFundingScale.t.sol`.

---

## 6c. Resolved Vulnerability — Profitable Funding-Settlement Sandwich

**Severity: high. Found by the S5b stress scenario written in this pass. Directly
exploitable for profit. Testnet only; no mainnet deployment existed.**

Funding was keyed off `cumulativeFundingIndex` at the moment a position opened, so a
position received the **full next settlement** regardless of how briefly it had been open.
Combined with the 500 bps per-interval cap and a capacity limit measured in notional, that
made the following loop directly profitable:

1. Read the oracle index — it is public before `settleFunding` is called.
2. Open the largest position the capacity cap permits, on the side funding will favour.
3. Call `settleFunding`. Collect a full interval of capped funding, ~5% of notional.
4. Close immediately. Repeat.

Measured, deterministically, over 20 rounds against a 1,000,000 pool:

| | Before fix | After fix |
|---|---|---|
| Single sandwich (S5) | **+32,822** | **−444** |
| 20 rounds (S5b) | **+434,752** | **−5,997** |
| Pool after 20 rounds | **563,864** (−43.6%) | **1,000,000** (intact) |

The trader extracted 43.6% of all LP capital in twenty transactions, paying only fees and
slippage for the privilege. Nothing about it required special access or a mispriced oracle —
only the ability to read a public value and transact before a settlement.

**Fix — continuous time-weighted funding.** Funding accrues per second rather than in
discrete jumps. `effectiveFundingIndex()` adds the portion of the current rate earned since
the last settlement, so the index is a function of time when READ, and a position accrues
funding for exactly the time it was open. `settleFunding` commits the outgoing rate's accrual
before adopting the new one, so an elapsed window is never repriced at a rate that was not in
force during it.

**The first attempt at this fix was epoch-based** — skip the interval a position was only
partly present for — and it is worth recording why it was replaced. It closed the exploit but
introduced a consistent bias against traders: a position present for 99% of an interval was
paid for none of it. Continuous accrual removes both problems at once.

Note also what does NOT count as the exploit. Holding through a full interval on the
favourable side of funding *is* profitable, and should be — that is the mechanism working, and
the pool is the counterparty to a one-sided book by design. What must not be profitable is
collecting an interval's funding without bearing an interval's exposure.

**Why the earlier tests missed it**: no test had ever opened a position, settled funding, and
closed within a single interval while checking the trader's net. The Monte Carlo did open and
close positions across settlements, but sampled randomly — it never constructed the specific
adjacency the attack depends on. This is precisely the gap deterministic scenarios exist to
cover, and the scenario that found it is the one written for that purpose.

**A caution about the first version of this test.** It was named
`..._does_not_compound_into_a_drain`, asserted only loss *ordering* between tranches, and
**passed while the 43.6% drain was happening**. A test that passes while the thing it is
named after occurs is worse than no test. It now asserts the whale's PnL is negative and the
pool is intact. Regression: `test_S5b_repeated_settlement_sandwich_is_not_profitable`,
`test_briefly_held_position_accrues_negligible_funding`,
`test_half_the_holding_time_earns_half_the_funding`, and — equally important —
`test_position_held_a_full_interval_accrues_the_whole_rate`, which proves the fix did not
simply disable funding altogether.

---

## 7. Underwriting Risk Controls

The vault is a pooled underwriter, so its failure modes are insurance failure modes, not
just smart-contract ones. Four controls address the ways a naive pool bleeds out.

### Premium is earned when the risk resolves, not when it is sold
Crediting premium the moment it arrives makes share price jump on sale. An LP could deposit
one block before, withdraw one block after, and capture the entire premium having carried
none of the risk — leaving the remaining term of that exposure with everyone else.

Two layers address this. `WeatherPolicyMarket` holds premium as `unearnedPremium` on its own
balance and only remits it to the vault, via `absorbProfit`, when the policy settles — so LPs
cannot be paid for a risk period that has not started, let alone one that has not finished.
Once remitted, `BreezeLiquidityVault` still recognises it gradually: it is held as
`lockedProfit` and decays linearly over `profitUnlockPeriod` (7 days default, bounded 1–90
days), with `totalAssets()` excluding the unvested portion, so a deposit timed around
settlement gains nothing either.

Claims draw on the vault's full token balance, and unvested profit is the *first* thing a
claim consumes, because that profit was collected for exactly that risk. Because premium is
held outside the vault until settlement, refunding a voided policy is a plain transfer rather
than a draw on LP capital for a risk the LPs were never paid to carry.

### Cover cannot be bought inside the forecast window
Historical frequency is an *unconditional* probability. A buyer who can see a forecast for
the period being covered knows the conditional probability and will only buy when it exceeds
the price — draining the pool through selection rather than bad luck. This is the single most
common way parametric insurance fails. `minLeadTime` (45 days default, floored at 21) requires
the covered period to begin beyond meaningful forecast skill, mirroring the sales closing
dates used in conventional crop insurance.

### Correlated exposure is capped per region-month
A dry August triggers every Tokyo August drought policy simultaneously. Counting those as
separate risks makes a concentrated book look diversified. `perilExposure` buckets
outstanding payout by `(regionId, monthOfYear)` and caps each at `maxPerilExposureBps`
(20% of vault assets, ceiling 40%).

### Underwriting halts above a solvency floor
`maxUnderwritingUtilizationBps` (70%) sits deliberately below the vault's own 80% reservation
ceiling, so the pool stops writing cover while it still holds a buffer rather than committing
its last unit of capital. Pricing also responds to scarcity: `effectiveRiskLoadBps` adds a
utilisation surcharge, so cover costs more as the pool fills. The base risk load is floored at
5% (`MIN_RISK_LOAD_BPS`) so no admin action can set LP compensation to zero.

---

## 8. Independent Adversarial Review — Findings

An independent review agent was given the vault, policy market, pricing oracle, and perp
market with a brief to break them, writing Foundry probes to prove each claim. It found nine
defects; all nine were fixed. A second review of those fixes found further defects in the
two newest mechanisms, listed below — the withdrawal cooldown in particular did not work as
first written and had to be rebuilt.

The fixes were verified against the reviewer's own probes rather than only against new tests:
after the D1 and D2 repairs, precisely the four probes written to demonstrate those defects
stopped reproducing them.

### Fixed

**D1 (critical) — cover was systematically under-collateralised.**
`_collectAndReserve` locked `payout − premium`, on the reasoning that the premium was paid
into the vault and so covered the rest. That reasoning was wrong: premium enters as vault
profit and becomes withdrawable LP value once vested, on a schedule unrelated to the policy
term. A claim therefore came up short by exactly the premium paid. The effect scaled with
strike probability — on a 70% strike the premium is most of the payout, so a buyer paying
91,000 against a 100,000 payout could be reserved only 9,000 and receive 9,000. In the limit
(`premium = payout − 1`) the reserve was 1 wei. **Fixed:** cover is now collateralised to its
full gross limit, as a catastrophe bond is. Regression:
`test_claim_is_paid_in_full_even_after_every_lp_exits`,
`test_high_probability_strike_is_still_fully_collateralised`.

**D2 (high) — the skew cap blocked the trades that repair the imbalance.**
`_enforceSkewCap` tested only the resulting skew. Closes carry no skew check, so ordinary
activity could leave the book above the cap; from there every new trade reverted, including
imbalance-*reducing* ones, freezing the market one-way. Lowering `maxSkew` caused the same
deadlock. The code contradicted its own comment. **Fixed:** a trade is rejected only if it
leaves the book over the cap *and* made the imbalance worse. Regression:
`test_counterflow_still_allowed_when_book_is_over_cap`,
`test_lowering_the_cap_does_not_freeze_rebalancing`.

**D3 (partial, high) — `sweepSurplus` counted a live winner's profit as surplus.**
Obligations were `totalLongOpenInterest + totalShortOpenInterest`, i.e. posted collateral
only. A position sitting on unrealised profit is owed collateral *plus* that profit.
**Fixed:** `openPositionObligations()` now sums `max(collateral + unrealisedPnl, 0)` per open
position. **Still open:** `BreezePerpMarket` never calls `vault.reserve()`, so swept funds
remain fully withdrawable by LPs — see below.

**D4 (medium) — an unusable oracle locked LP capital permanently.**
`settlePolicy` was the only path calling `release()` and reverts while the oracle is unusable,
so a silent region trapped the capital behind that policy forever — the same harm the pause
discipline exists to prevent, by another route. **Fixed:** `voidUnsettleablePolicy` is
permissionless after a 30-day grace, releases the reservation, and refunds premium. It
reverts if the policy can still be settled properly.

**CEI ordering** in `absorbProfit` was inverted (transfer before state update), leaving a
window where `totalAssets()` counted incoming tokens that `lockedProfit` did not yet exclude.
Fixed, and `nonReentrant` added to `absorbProfit`, `reserve`, and `coverLoss`.

### Also fixed, in a follow-up pass

**D5 — withdrawals could drive utilisation to 100%.** `maxUtilizationBps` was enforced only
when reserving, so LPs could withdraw until `totalAssets() == totalReserved`, erasing exactly
the buffer the cap exists to hold. `availableLiquidity()` is now derived from
`minRequiredAssets()` — the smallest pool consistent with the cap given what is reserved — so
the constraint holds from both directions. The invariant added alongside it immediately caught
that flooring the division let utilisation exceed the cap (severely at small reserve sizes);
`minRequiredAssets` now uses `Math.ceilDiv`, making the cap a real bound rather than an
approximate one. Regression: `test_withdrawals_cannot_breach_the_utilisation_cap`,
`invariant_withdrawing_all_available_keeps_utilization_in_bounds`.

**D7 — premium vested before the risk began.** Tuning `profitUnlockPeriod` would not have
fixed this; the model was wrong. Premium is no longer paid to the vault at purchase at all.
`WeatherPolicyMarket` holds it as `unearnedPremium` and remits it via `absorbProfit` only when
the policy settles, so LPs cannot be paid for a risk period that has not started, let alone
one that has not finished. This also makes voiding an unresolvable policy a plain refund of
funds still held, rather than a draw on LP capital for a risk the LPs were never paid for.
Regression: `test_premium_is_held_unearned_until_the_risk_resolves`,
`test_lp_share_value_does_not_move_when_a_policy_is_sold`,
`test_voiding_refunds_premium_without_touching_lp_capital`.

**D9 — no aggregate exposure cap.** `totalOutstandingPayout` was written and never read.
`maxAggregateExposureBps` (60% of vault assets, ceiling 80%) now bounds the whole book, since
per-peril caps limit each bucket but say nothing about their sum.

### Closed in a third pass

**D3b — the perp market now reserves against skew.** `marketReserved[perpMarket]` was
permanently zero, so capital swept to the vault stayed withdrawable while backing open
positions.

The reserve is sized on **unmatched** open interest, `|longOI − shortOI| × skewReserveBps`.
Matched open interest is self-funding — a long's gain is the short's loss and both sides'
collateral is already held by the market — so only the unmatched remainder needs LP capital
behind it. This is `O(1)` (no iteration over positions, so no gas-DoS surface), reuses the
existing skew machinery, and is **counter-cyclical**: the requirement rises exactly as the book
becomes one-sided.

Two alternatives were considered and rejected. Sizing the reserve on *weather volatility* would
measure the wrong variable — mark price here moves on order flow, not on weather, so a whale can
shift it on a calm day — and would be **pro-cyclical**, shrinking capital during quiet periods,
which is when tail exposure accumulates and is the mechanism behind 2008-style capital failures.
Weather has fat tails: Dubai's April 2024 floods delivered roughly two years of rain in a day
after decades of near-zero, and a reserve calibrated on "normal afternoon" variance would not
have survived it. Splitting the vault into fixed LP/reserve buckets was also rejected as a fix
for *this* defect: it does not change the fact that the backing capital is withdrawable, though
its loss-waterfall idea remains a good separate improvement (see tranching, below).

`_syncVaultReserve` runs on open, close, and liquidate. A trade that worsens the imbalance is
refused if the vault cannot back it; a trade that improves the imbalance is never blocked.

**D6 — withdrawal cooldown.** LPs call `requestWithdrawal()` and wait `withdrawalCooldown`
(3 days, hard-capped at 14) before exiting, so an LP who reads a triggering oracle value cannot
exit ahead of `settlePolicy`. `maxWithdraw`/`maxRedeem` report zero during the wait, so ERC4626
consumers are never quoted an amount that would revert.

**The first version of this did not work, and a second review broke it two ways.** Keying the
wait to the share owner is not sufficient: shares are ordinary ERC20 and `requestWithdrawal`
cost nothing, so an empty address could be warmed in advance, be handed shares later, and
redeem in the same block the depositor arrived. Separately, requests never expired, so every
rational LP would request once on deposit and hold a permanent standing exit — precisely the
freedom the cooldown exists to remove. Both were demonstrated end to end.

The mechanism now binds a request to the share balance held **at request time**, cancels it on
any outbound share transfer (`_update`), and expires it `WITHDRAWAL_WINDOW` (2 days) after it
matures. Shares acquired after a request are not covered by it. Partial exits draw the claim
down rather than voiding it, so an LP is not forced into repeated waits for capital that a
utilisation cap withheld. The cooldown in force is snapshotted per request, so a later admin
increase cannot retroactively freeze someone already waiting.

This delays exit; it never blocks it. An expired request can always be renewed
(`test_expired_request_can_always_be_renewed`), and pausing does not extend it.

**Bricking surfaces found alongside these and fixed.** Liquidation could be blocked by a thin
market balance — its positive-equity branch transferred unclamped and never drew on the vault —
which is intolerable because liquidation is what keeps the market solvent. Closing could be
blocked because fee legs transferred real tokens *before* the vault top-up, in a market designed
to run below its obligations. Every vault call on the close and liquidation paths is now
failure-tolerant, and fee collection is clamped to the balance actually held: revenue is
subordinate to being able to exit a position at all. Revoking a market's vault authorisation no
longer freezes its traders, and repointing the vault now releases the outgoing reservation
instead of stranding it permanently.

**D8 — the vesting clock resets on every profit or loss.** A third party can defer LP profit
recognition by repeatedly triggering small absorbs. Bounded in practice, but a griefing vector.

### Reserve sizing, redesigned around notional exposure

The first two attempts sized backing reactively off collateral skew. Both properties were
wrong, and the review proved it. The model is now:

```
exposure = max(longNotional, shortNotional)          // worst-case directional book
required = exposure × skewReserveBps                 // adverse move covered
```

**Notional, not collateral.** Collateral is not a measure of risk — a 3x long against a 1x
short of equal collateral nets to zero collateral-skew while carrying a large directional
position. `totalLongNotional` / `totalShortNotional` track `collateral × leverage`, which is
what actually moves with price.

**`max`, not `|difference|`.** Sizing on current skew is reactive: a balanced 100k/100k book
has zero skew and would reserve nothing, but the instant one side closes the imbalance is
100k — and the LPs whose capital should have backed it were free to leave in the meantime.
Taking the larger side prices the exposure the book can reach *without a single new position
being opened*, so capital is present before it is needed rather than after. This is what
closes the reactive-withdrawal window.

**`skewReserveBps` is an explicit leverage choice, and its value was set by simulation.**
It is the adverse move the protocol commits to covering, capped at 100% (the
catastrophe-bond posture: fully collateralised against a total loss on the directional book).

### Calibration evidence

`test/simulation/ReserveMonteCarlo.t.sol` runs a continuous 3,000-action market — 40 traders
at 1–3x leverage, 6 LPs entering and leaving underneath live positions, random weather moves
driving funding, and liquidations — then sweeps the coverage ratio. Foundry resets state
between invariant runs, so a dedicated continuous run is used rather than per-run counters,
which would only ever describe a 64-call fragment.

The figure has been derived twice. The original sweep put the frontier at 75%; after the two
funding defects were fixed (§6b oracle scale, §6c continuous accrual) it was re-derived and the
frontier moved to **50%**. Both rounds are recorded, because the reason it moved is itself the
point.

**Current calibration — 3 seeds × 900 actions, aggressive funding preset:**

| Coverage | Short-paid closes | Worst shortfall | Mean rejection | Seeds drained |
|---|---|---|---|---|
| 30% | **28** | **100% of owed** | 9.9% | **1 of 3** |
| **50%** | **0** | — | **8.6%** | 0 |
| 75% (previous default) | 0 | — | 14.2% | 0 |
| 100% | 0 | — | 21.0% | 0 |

**The decisive finding survives re-derivation: under-reserving is strictly worse on both axes.**
At 30% the protocol both fails to pay traders *and* rejects more trades than 50% does. The
mechanism is a death spiral — under-reserving lets payouts drain the pool, and a drained pool
refuses everything. Capital efficiency is not traded against solvency here; insolvency destroys
capacity.

**What changed, and why.** 50% now dominates 75% on both axes, where previously 75% was the
frontier. The funding fixes removed a systematic mispricing that had been driving PnL swings far
larger than real exposure justified: the rate was pinned at its cap in one direction, and
positions collected whole intervals they had not been open for. With funding proportional to
actual exposure time, the reserve requirement is genuinely lower. The default is now **5000**,
buying 5.5pp of capacity over 75% at no measured solvency cost.

**Calibrated against the aggressive preset deliberately.** Under production funding parameters
(8-hour interval, 0.75% cap) *every* ratio including 30% shows zero shortfalls — that regime
cannot discriminate between them. It shows the protocol is comfortable in normal conditions, not
that 30% is safe. Reserve capital is sized on the tail, and the aggressive preset remains
reachable since `setFundingParams` permits it and the demo deployment uses it.

**Two methodological traps found while re-deriving this**, both of which had made an earlier
version of the sweep report safety it had not tested for:

- **Run length matters as much as seed count.** At 450 actions per seed every ratio including
  30% showed zero shortfalls; at 900 the 30% setting produced 28. A short run has not
  accumulated enough exposure to stress the reserve at all.
- **The rejection metric had gone blind.** `ExceedsNotionalCapacity` — the new preventive
  refusal, and now the dominant one — was not in the classifier, so the sweep reported a 0%
  rejection rate while roughly a tenth of opens were being refused.

**Limits of this figure, stated plainly.** 40% is untested, so the failure boundary is located
only between 30% and 50%. Three seeds is enough to reject 30% (a failure on any path is a
failure) and enough to prefer 50% over 75% given it wins on both axes, but it is not a tail
estimate. The loss waterfall now sits beneath this as a second line of defence, which it did not
during the first calibration.

### Deterministic stress scenarios

Monte Carlo samples the middle of the distribution. It runs thousands of plausible histories
and, precisely because they are plausible, almost never constructs the specific adversarial
arrangement that breaks something. Those states are built on purpose by an adversary, so they
have to be written down rather than waited for. `test/stress/NightmareScenarios.t.sol` names
five and states the property each must not violate.

| Scenario | What must survive it |
|---|---|
| **S1** 100 traders, max leverage, all long | Refusal is the pass condition — 15m of one-sided notional against a 1m pool must be capped, exposure must stay inside `maxNotionalCapacity()`, and everything accepted must remain exitable |
| **S2** every LP exits at the first legal moment | The utilisation floor still binds across both tranches, so live positions are never left backed by nothing; positions stay closable afterwards |
| **S3** the largest weather move the oracle can express | Funding saturates at the documented cap rather than propagating an unbounded number into every position's PnL; an extreme index must not make positions unexitable. **S3b** — a negative reading is refused, not wrapped |
| **S4** every position liquidatable in one update | Every liquidatable position is actually liquidatable — with the market paused *and* the insurance fund drained, since liquidation is what keeps the book solvent and is the one path that must never be blockable |
| **S5** largest possible position opened immediately before settlement | A single maximal trade cannot escape the capacity cap, and the sandwich must be a *losing* strategy. **S5b** — 20 repeated rounds must leave the trader down and the pool intact. **This scenario found §6c.** |

Measured outcomes at the current parameters:

| Scenario | Result |
|---|---|
| S1 | 4 of 100 accepted, 96 refused; exposure 599,400 against a 666,666 capacity |
| S2 | 8 of 8 senior LPs exit; backing floors at exactly 224,775 (= 179,820 ÷ 0.8) |
| S3 | Single-interval funding move clamped to 500 bps in both directions |
| S4 | 7 of 7 liquidatable positions liquidated, with the market paused |
| S5 / S5b | Whale nets −444 on one round, −5,997 over twenty; pool unchanged at 1,000,000 |

Every scenario asserts it actually *happened* before asserting what it proves —
`assertGt(refused, 0)`, `assertGt(exited, 0)`, `assertGt(liquidatable, 0)`,
`assertGt(juniorLoss + seniorLoss, 0)`. This is not decoration. Three drafts in this pass
passed vacuously: the one-sided-loss test produced zero loss, S2 reported zero senior exits
because every senior request had silently lapsed (the warp used junior's longer cooldown, past
senior's 2-day window), and S5b passed while the pool was being drained 43.6%. **A stress test
that cannot fail is indistinguishable from one that is not there.**

### What the simulation does not yet answer

Rejection at ~25% and idle capital at ~61% are both high. Neither is a solvency problem, but
both say the pool is under-capitalised relative to the exposure traders want, and that a
single shared pool serves them inefficiently. That is the case for capacity caps and pool
isolation rather than for lowering the coverage ratio — the sweep shows lowering it is the one
change that makes everything worse. Leverage above 3x is untested because
`PerpConstants.MAX_LEVERAGE` forbids it; a higher ceiling would need re-calibration.

### The loss waterfall — implemented

Loss is drawn in a stated order rather than shared equally, so conservative and aggressive
capital can hold different claims on the same book. This is how catastrophe-bond and ILS
capital is structured, and it is what lets a pool attract capital that would refuse
first-loss exposure at any yield.

```
tier 1   FirstLossReserve     protocol-owned, fee-funded, drawn only by the vault
tier 2   JuniorTranche        subordinated LPs, boosted yield, covers a defined band
tier 3   BreezeLiquidityVault senior LPs, protected, absorbs the residual
```

Both upper tiers are optional. With neither configured the waterfall collapses to exactly
the single-tranche behaviour that preceded it, and the senior LP interface is unchanged.

**Ordering is real, not cosmetic.** Tiers 1 and 2 pull capital *into* the senior vault before
the senior tier is measured, so senior `totalAssets` falls only by the residual the upper
tiers could not absorb. `LossWaterfall` emits the per-tier attribution, because "senior lost
nothing" is otherwise unverifiable from outside the contract.

**Junior capital enlarges the protocol rather than merely resegmenting it — up to a bounded
share.** It counts toward `totalBackingAssets()`, so it raises the notional the markets can
support. Excluding it would mean adding first-loss capital made the protocol safer without
letting a single extra trade through. Both tranches then draw on one shared headroom
(`freeBackingAssets()`), so neither can withdraw capital the other is relying on — every
withdrawal shrinks the figure a later caller sees. The share cap is covered below under
"Junior capital must be additive".

**The compensation formula is weighted, and the obvious version of it was wrong.** The first
implementation took junior's pro-rata share and multiplied it. That breaks once the junior
tranche grows: at a 2x multiplier a junior tranche holding half the capital claims
2 × 50% = 100% of profit, driving senior yield to exactly zero while senior risk stays
where it was — so every senior LP leaves and the protection has nothing left to protect. A
unit test on equal capital caught it. Weighting the two tranches instead (`junior × multiplier`
against `senior × 1`) means the denominator grows with the numerator, so junior's share
approaches but never reaches the whole. The property that matters becomes exact rather than
approximate: **junior earns the multiplier times senior per unit of capital at every possible
ratio of the two**, because the capital term cancels. That is the number an LP choosing
between tranches actually needs. Bounded to 1x–3x — never below pro-rata, since junior
carries strictly more risk, and never unbounded, since the boost is paid out of senior's
share.

**Junior exit discipline is stricter by design** — a 7-day cooldown against senior's 3. First-loss
capital that can leave as fast as protected capital is not first-loss capital; whoever noticed
trouble first would simply be senior in practice.

**What the simulation showed, and how it changed the design.**
`test/simulation/WaterfallMonteCarlo.t.sol` runs the same seeded trader flow through four
capital structures. Arms A–C hold the **same total** LP capital, which is what makes them
comparable — a structure that is safer because it is simply larger has demonstrated nothing
about tranching. Arm D deliberately does not, and that is the point of it.

| Arm | Structure | Mean worst senior price | Beat arm A |
|---|---|---|---|
| A | flat pool, 400k senior | 0.917 | — |
| B | + dedicated first-loss reserve | 0.930 | 4 of 5 |
| C | 300k senior + 100k junior, **carved out** | 0.962 | 4 of 5 |
| D | 400k senior + 100k junior, **added** | **1.000** | **5 of 5** |

5 seeds × 250 actions, senior's worst intra-run share price, start = 1.0.

Arm D shows no senior drawdown on any seed. That is the strongest claim in the suite and the
only one asserted per-seed rather than on the mean: with junior funded by new capital there is
no thinning effect to trade against, so a seed where senior did worse would mean the tier
ordering itself was broken.

**The first pass of this simulation is what argued for the two changes below.** Measured with
junior carved out of a fixed total, the waterfall beat the flat pool on 4 of 5 seeds but lost on
the *mean*: carving 100k out of 400k leaves senior 25% thinner, so below the attachment point
senior is untouched where the flat pool bleeds, and above it the residual lands on less capital
and moves further. One seed wiped junior entirely and took senior down 98.7%.

**Tranching redistributes loss; it does not reduce it.** Reading the waterfall as "senior is now
safer" without the attachment-point caveat is the wrong model.

### Junior capital must be additive

A vault cannot see where a depositor's money came from, so "additive" cannot be enforced at the
point of deposit. What it *can* control is whether junior capital **buys capacity**.

`maxJuniorBackingShareBps` (default 3333) caps junior's contribution to counted backing at a
third of the total. A protocol that funds its junior tranche by moving senior LPs into it gets no
extra capacity for the exercise; one that attracts genuinely new subordinated capital does. The
ceiling is 5000, because a "subordinated" layer as large as the layer it protects is not a
first-loss position — it is a coin flip over which half absorbs first.

Excess junior capital is neither rejected nor trapped. It still absorbs loss, and
`juniorUncreditedBacking()` stays withdrawable **on top of** the shared headroom, because
capital excluded from `totalBackingAssets` cannot be holding any of it up. The cost is stated
plainly: that capital does protect senior while present, so letting it leave reduces protection
the protocol never counted on. Trapping it would make the cap punitive rather than
incentive-aligned and would deter exactly the additive capital the cap exists to encourage.

Junior is still paid on its **full** balance, not the credited portion. It bears first loss on
the whole amount, so withholding yield from the uncredited part would take the risk and decline
to pay for it.

**A defect the cap introduced, and the fix.** Once junior is oversubscribed, credited junior
capital is `senior × k` — a *function* of senior assets. So a senior withdrawal of `W` removes
`W` of senior backing **and** up to `W × k` of credited junior backing. Sizing senior's exit off
`freeBackingAssets()` let a bank run drain counted backing by roughly 1.5× the headroom that
existed, straight through the utilisation floor. `NightmareScenariosTest.test_S2` caught it.
`minRequiredSeniorAssets()` now solves for the senior floor directly, taking the larger of the
two per-regime candidates — which is exact rather than merely conservative, because the two
coincide at the regime boundary. Measured on the reproducing case: the naive figure allowed
29,992 and breached the 120,000 floor; the corrected figure allows 19,996 and lands exactly on it.

### Junior covers a defined band, not an open-ended first slice

`attachmentBps` / `exhaustionBps` express the layer as fractions of total backing, and
`exhaustionBps − attachmentBps` becomes a hard **per-period aggregate limit** on what the tranche
can be asked for. Beyond it, loss passes to senior even though junior still holds capital.

Why bound it at all, when junior can never lose more than it holds: without a limit, "absorbs
until empty" means a long series of small losses grinds the tranche to nothing, so junior's
exposure is its entire capital with no bound in time. That is not a priceable risk, and a layer
nobody can price is a layer nobody funds. Reinsurance solves this with an annual aggregate limit;
this is that.

The basis is **snapshotted** at the start of each period rather than read live, because a live
basis shrinks as the layer pays — a limit that tightens exactly when it is being used. The vault
calls `pokeLayer()` at the top of `coverLoss` so the snapshot is taken before tier 1 transfers
its contribution *into* the vault; without it the layer came out marginally wider than
`layerLimit()` reported an instant earlier, on the first loss of a period only, which is
precisely the kind of discrepancy that makes a published view untrustworthy.

`attachmentBps` is **reported, not enforced**, and the distinction is deliberate. In a
catastrophe bond the retention below the attachment point is the sponsor's own capital,
contractually present. Here the equivalent is tier 1, which is fee-funded and may legitimately
be empty. A tranche that *refused* to pay below its attachment point would push first loss onto
senior whenever tier 1 was thin — inverting the subordination the tranche exists to provide. So
junior pays immediately after tier 1 is exhausted wherever that happens to be, and the
attachment point is published as the size tier 1 is expected to hold
(`FirstLossReserve.targetSize` describes the same boundary from the other side).

**Calibration, including a result that did not survive the next change.** The width sweep
(`test_calibrate_layer_band_*`, aggressive funding preset, 3 seeds × 600 actions):

| Exhaustion | Band width | Senior worst | Junior end | Absorbed | Band bound |
|---|---|---|---|---|---|
| 1000 bps | 8% | 0.771 | 119,871 | 26,667 | 2 of 3 |
| **2500 bps** | **23%** | **0.886** | 66,412 | 69,024 | 0 of 3 |
| 5000 bps | 48% | 0.886 | 66,412 | 69,024 | 0 of 3 |
| 10000 bps | 98% | 0.886 | 66,412 | 69,024 | 0 of 3 |

A clean two-sided trade-off: the wider band leaves senior better off and junior worse off. The
three wide columns are identical because from 2500 bps upward the band no longer binds — junior's
*assets* run out first — so widening further changes nothing. That saturation confirms the sweep
measured the right variable, and it makes 2500 the narrowest width buying senior the full
benefit. The arm comparison agrees, which is what makes the figure defensible rather than chosen.

Two cautions worth more than the table. **This ranking is not stable across configurations**: an
earlier run of the same sweep, before capacity was priced, put 1000 bps ahead on *both* axes.
Narrow bands protect against many moderate losses and wide bands against one large one, so the
winner depends on the loss distribution, and adding the capacity surcharge changed that
distribution enough to flip the order. Anyone re-tuning the fee model must re-run this sweep
rather than trusting the numbers above. And 3 seeds over-reads — the same lesson `skewReserveBps`
taught, where a single-seed run put the frontier 25pp from where 3 seeds put it. The boundary
between 1000 and 2500 is unlocated.

Open: a bounded band raises a pricing question the sweep does not answer, since junior's exposure
is now capped below its capital while it is still paid a 2× multiplier. A **per-occurrence** limit
alongside the aggregate one would let the layer be narrow against a single event and wide in
aggregate, which is the shape that satisfies both regimes instead of picking between them.

### Tier 1 was competing with the liquidation backstop

Tier 1 was originally `InsuranceFund`, which `BreezePerpMarket._executeLiquidation` also draws
directly to clear bad debt. One balance, two unrelated consumers, no ordering — so the vault
could drain the reserve liquidation depends on.

The two failures are not symmetric, which is what makes this a **priority inversion** rather than
a tie. Liquidation failing to clear bad debt leaves the deficit on the market's own balance, which
reduces what is available to pay other closing positions, which produces further vault draws that
land on senior. It compounds. Senior capital absorbing a loss is exactly what the senior tier is
for; it does not.

Measured in `WaterfallMonteCarloTest`: enabling the shared fund as tier 1 left senior LPs *worse*
off on 2 of 5 seeds than having no tier 1 whatsoever. The assertion that arm B beats arm A failed,
and the honest response at the time was to delete it and record the finding rather than tune seeds
around it.

**The fix is `FirstLossReserve`** — protocol-owned capital dedicated to tier 1 and nothing else,
funded by its own fee leg (§4), drawn only by addresses on `authorizedDrawers`. The perp market
funds it and can never draw it; authorising a market there would rebuild the contention. Nothing
in the contract is withdrawable by anyone, including admin: capital that arrives is committed to
absorbing loss.

`FirstLossIsolationTest` proves the mechanism **deterministically**, which is where a mechanism
claim belongs. The same vault drain and the same liquidation, run through both structures:

| Tier 1 | Deficit the backstop was asked for | Actually paid |
|---|---|---|
| Shared `InsuranceFund` | 1,825.7 | **200.8** (11%) |
| Dedicated `FirstLossReserve` | 1,825.7 | **1,825.7** (100%) |

Note the shared figure is not zero. The pot refills from ordinary fee flow, which is exactly why
the defect is easy to miss in a busy market and dangerous in a quiet one.

The stochastic test now asserts only the weakest claim it can support — tier 1 does not hurt
senior on a majority of paths (4 of 5). Its *mean* is still not assertable, and the reason
changed: tier 1 moves the vault balance by a few hundred tokens against 400k of senior capital,
which is enough to push `maxNotionalCapacity` across the threshold for one trade, and from the
first differing accept/reject the arms face entirely different books. One catastrophic path
dominating a 5-seed mean is a property of the harness, not of the tier.

Verified in `test/unit/LossWaterfall.t.sol` (34), `test/unit/JuniorLayer.t.sol` (20),
`test/security/FirstLossIsolation.t.sol` (12) and
`test/simulation/WaterfallMonteCarlo.t.sol` (7).

### Capacity caps — implemented

Backing is now preventive. `maxNotionalCapacity()` derives, from the backing that already
exists, the largest worst-case notional the market may carry; `openPosition` refuses anything
beyond it **before any token moves**. This inverts the question the market asks — from
"accept the trade, then try to reserve for it" to "only accept what the capital already
supports" — which makes an under-reserved state unrepresentable rather than merely detected.

`availableNotional(bool)` publishes the remaining room so a caller can size a trade that will
be accepted instead of discovering the limit by reverting.

Two properties are preserved deliberately. Capacity refuses a trade only when it actually
*raises* worst-case exposure: exposure can sit above capacity with no trade having done
anything wrong, since LPs withdrawing or an admin raising the coverage ratio both shrink
capacity under a book that was compliant when built. A bare "resulting > cap" rule would then
reject the balancing trades that are the only thing able to repair it. And closing is never
gated by capacity — an exit is unconditional.

The failure-tolerant `try/catch` wrappers **remain** on the close and liquidation paths.
Earlier notes suggested capacity caps would let them be removed; that was wrong. They exist so
an exit cannot be blocked by the state of the backing pool — a de-authorised market, a
repointed vault — and the preventive cap on the *open* path does nothing about any of that.

Verified in `test/security/PerpCapacityCap.t.sol`.

### Capacity is priced as well as capped

A cap on its own is a cliff: below it every trade costs the same, at it nothing gets through. That
shape neither discourages the marginal trade that fills the last of the book nor pays LPs more for
the tail exposure they take as it fills. `WeatherPolicyMarket` already prices its capacity through
`utilizationLoadBps`; the perp markets only rationed.

`utilizationFeeBps` adds a surcharge scaled linearly with `capacityUtilizationBps()` — zero on an
empty book, the full rate on a full one. Three properties are deliberate:

- **Charged only on flow that raises worst-case exposure.** A trade growing the smaller side
  consumes no scarce capacity and pays nothing extra, which is the same treatment the skew and
  notional caps already give balancing flow. Closes are never surcharged; charging an exit for
  scarcity would discourage the only action that relieves it.
- **Retained, not routed.** Surcharge tokens simply stay in the market, which puts the balance
  above `openPositionObligations()`, so the existing `sweepSurplus()` remits them to LPs as
  profit. An explicit transfer would add an external call, and a failure mode, to the open path
  for no gain.
- **It does not replace the cap.** The cap is a solvency bound derived from backing that actually
  exists; the surcharge only makes the approach to it expensive so the cliff binds less often.
  Removing the cap and relying on price would mean accepting exposure the capital cannot support
  at any fee.

**What this does and does not demonstrate.** The mechanics are verified — the surcharge tracks the
published rate, spares balancing flow, and reaches LPs. What a random-agent simulation *cannot*
show is the effect that motivated it: rejection falls only if demand is price-sensitive, and
simulated traders are not. The claim that pricing beats rationing rests on the mechanism being
correct and on how scarce capacity is priced everywhere else, not on a measured drop in the
rejection rate.

Two approximations are knowingly accepted. The "does this raise exposure" test uses notional
measured *before* the surcharge is deducted, which is mildly circular; the error is a fraction of a
basis point and errs toward charging, so it favours LPs. And a trade crossing from the smaller side
to the larger pays on its whole collateral rather than on the portion that adds exposure — blunt,
but pro-rating would make the fee a function of where the book sat at that instant, which is harder
to quote than it is worth.

Verified in `test/security/PerpCapacityPricing.t.sol` (15 tests).

### Settlement measures what the premium was priced on

**This was a mispricing, not a rounding issue, and it ran systematically against LPs.**

`weather-seed/src/climatology.ts` sums daily precipitation into a **monthly total** and counts
how often that total breached the strike. So a 40mm threshold means "40mm across the month",
and a 20% probability is the frequency of a *month* coming in dry. `settlePolicy` compared the
**single reading at expiry** against that threshold. One day's rainfall is essentially always
below a monthly total, so drought cover triggered on almost every policy while being charged
the monthly-total probability. The pricing was correct; the settlement was measuring a
different quantity.

`PolicyPeriodSettlementTest` states it as arithmetic rather than as history: 2mm every day for
30 days is a **wet** month at 60mm, comfortably above a 40mm drought strike — and under point
settlement it paid the claim in full.

Settlement now aggregates the covered period:

- **`Aggregation`** is `SUM` (rainfall totals, what the climatology computes) or `AVERAGE`
  (temperature means). It is a property of the **variable**, set by admin and snapshotted onto
  each policy — never a buyer input. Letting a buyer choose the statistic would decouple
  settlement from the probability the premium came from, which is the whole defect reintroduced
  as a feature. An unconfigured variable cannot be sold at all, because the enum's zero value
  is `SUM` and a temperature policy priced on monthly means would otherwise have settled on the
  monthly total — off by a factor of thirty.
- **Readings are sampled on an exact grid** anchored at `coverageStart`, one per
  `samplingInterval`. Exactness matters: `getReading` falls back to the latest value when the
  requested timestamp is absent, which is right for a point query and would silently
  double-count in a sum. `Reading.timestamp` reports where a value actually came from, so a
  fallback is detectable without changing the oracle interface. Coverage must start on a grid
  boundary, or every sample would come back missing.
- **Gaps are skipped, not interpolated**, and bounded by `minSampleCoverageBps = 9300` — which
  at a 30-sample term permits exactly 2 missing readings, the same tolerance the climatology
  script applies when it drops an incomplete month. The bound has to be tight in this direction
  specifically: a missing sample under-counts a `SUM`, which biases `triggerBelow` cover toward
  paying out, so the error favours the buyer and it is the LPs who need protecting.
- **The term is bounded by `MAX_SAMPLES = 62`.** Settlement gas scales with the covered period,
  and a policy that cannot be settled cannot release its vault reservation — the same
  liveness trap the obligations loop was. Measured at the maximum term: **233,062 gas**.
- **`voidUnsettleablePolicy` asks the same question.** If settlement refused for thin coverage
  while the void path refused because *some* reading existed, a policy would be neither
  settleable nor voidable and its reservation would be locked forever — precisely the trap the
  void path exists to prevent. Both now go through `hasSettleableIndex`.

Known limit, stated because the protocol cannot check it: `samplingInterval` is a claim about
the oracle's publication cadence, and nothing on-chain can verify it. Sampling a daily feed
weekly would under-count a monthly total sevenfold. It is admin-only and bounded, but it is
trusted configuration.

Verified in `test/integration/PolicyPeriodSettlement.t.sol` (19 tests).

### Correlated markets are capped in aggregate

`maxNotionalCapacity()` bounds each perp market against the shared backing pool. Nothing bounded
the correlated **set**. Two rainfall markets on regions that see the same storm could each take
their full allowance, and the pool would look diversified while holding one large bet.

Measured in `PerilAggregationTest`: without a registry, two markets on correlated regions
committed **599,400** of capital against a pool of 1,000,000 — a 50% overshoot of any single
peril's 40% cap. With one, the second trade is refused.

`PerilExposureRegistry` buckets markets by a declared peril group, keyed by **region** so two
markets on the same region are grouped automatically. Caps are expressed in **reserve capital**
rather than notional, because notional is not comparable across markets running different
coverage ratios, whereas `requiredVaultReserve()` is the capital each market's exposure actually
consumes — the same denominator `WeatherPolicyMarket.maxPerilExposureBps` uses.

Three design choices carry the weight:

- **Exposure is pulled, not pushed.** Markets report nothing; the registry reads
  `requiredVaultReserve()` from each registered market when asked. Push accounting would need
  every open, close and liquidation to update a mirror of state that already exists, and any
  missed path leaves the mirror wrong in a way nothing detects. Pulling cannot desync because
  there is nothing to sync. The loop that makes it affordable is bounded by `MAX_MARKETS` and
  only admin can grow it — the mistake `openPositionObligations` made was iterating something
  users could inflate.
- **An unconfigured region maps to group zero**, putting every undeclared market in *one*
  bucket. Unknown correlation is treated as full correlation, so forgetting to declare a peril
  tightens the book rather than silently removing the cap.
- **Degradation is permissive, and that is a stated limit.** A registry that reverts, or a
  registered address that cannot report its reserve, counts as unconstrained or as zero. A
  misconfiguration must not be able to halt trading in every market at once — but it means this
  is a control on *declared* correlation, not a proof of total correlation.

One defect the tests found: `try/catch` does **not** catch failures decoding a successful call's
return data, and a call to an address with no code succeeds with empty data. So `try` alone let a
codeless registry entry revert the entire aggregation, and through it every open in every
registered market. Both the registry and the market now check `code.length` first.

Verified in `test/security/PerilAggregation.t.sol` (19 tests).

### Markets can no longer be created at odds unrelated to their climatology

Two defects with the same shape, on the two market types the policy market did not cover.

**Classic markets had no odds.** A long's payout is `totalLongPayout / totalLongSupply`, so an
evenly split pool pays even money — regardless of whether the strike has historically been
breached in 27 of the last 30 years. Nothing in the contract knew the difference between a coin
flip and a near-certainty, and whichever side did not know the climatology lost by construction.

A market now resolves its fair odds at construction and publishes them. `fairLongShareBps()` is
the share of the pool the long side must hold for the odds to be fair — which is exactly the
breach probability, since the expected value of a unit deposited long is
`P × totalCollateral / totalLongSupply` and that breaks even when the long side holds `P` of the
pool. `mintPosition` refuses a deposit that pushes the split further from fair once it is
already outside `fairOddsToleranceBps`, and **always** permits one that moves it closer, even
from far outside the band — a rule keyed on the resulting state alone would reject exactly the
deposits able to repair an imbalance, the same trap the skew and capacity caps had to avoid.

Two limits stated rather than glossed:

- **BINARY only.** A breach probability determines the fair split of a binary claim exactly. It
  does not determine the fair split of a LINEAR or CAPPED payoff, which depends on where inside
  the range the reading lands — that needs the distribution, not one quantile of it. Pricing
  those off a breach probability would produce a number that looks authoritative and is wrong.
  Non-binary markets are left explicitly unpriced.
- **Unpriced markets still deploy.** Gating creation on climatology that has not been posted yet
  would make listing a new region impossible until the seeder had run — an operational deadlock,
  not a safety property, and this factory is permissionless by design. `isPriced` is recorded
  on-chain so an unpriced market is *flagged* rather than indistinguishable from a priced one.

**Perp markets opened at an arbitrary price.** Initial reserves fix the opening mark, and nothing
compared it against the climate the market tracks. `BreezePerpFactory` now refuses a market whose
opening mark sits more than `maxInitialMarkDeviationBps` (default ±50%) from the climatological
expectation for the month it opens into. Wide deliberately: a perpetual has no expiry, so its
fair mark legitimately drifts across seasons and a tight band would refuse reasonable markets.
The purpose is to catch a mark wrong by an order of magnitude, which is the error that actually
happens — a mis-scaled reserve ratio, or a figure copied from another region.

Two things make it correct rather than approximately correct:

- **The month is derived, not declared.** `CivilDate.monthOfYear` computes it from the timestamp.
  Passing it in would make the pricing depend on the creator naming the season honestly, and a
  wrong declaration would price a market against the wrong climatology while looking fully
  priced.
- **The comparison runs through the market's own `indexPrice()`**, so it uses that market's
  `oracleValueScale`. Converting in the factory against an assumed 1e6 would have reintroduced
  the mark/index scale mismatch of §6b one layer further out.

`StrikeProbabilityOracle` gained an expected-**level** feed for this, and the unit is the
expected value of a **single oracle reading** — for a daily rainfall feed, mean daily millimetres,
*not* the monthly total the strike probabilities are derived from. A perp's index price is one
reading, so posting a monthly total would compare a daily-scale mark against a monthly-scale
level and be wrong by roughly thirty times. That is the same class of error as §6b and as the
policy settlement above, which is why the seeder computes the two figures separately and the
NatSpec says so at the point of use.

Verified in `test/unit/ClimatologyPricing.t.sol` (25 tests), including `CivilDate` against known
dates, leap days, and the 400-year rule.

### Pool isolation — assessed, deliberately not built

`WEATHER_VARIABLES` defines two variables (rainfall, temperature) and the climatology seeder
populates **rainfall only**. On the stated rule — build isolated pools when several variables
run concurrently — this is not yet warranted, and building it now would add a coordinator,
per-pool accounting and a second withdrawal surface to serve one live variable.

There is a stronger reason to hold off, and it is worth stating because it changes what the
eventual fix should be. **Pool isolation is the wrong tool for weather risk.** Isolation
protects unrelated markets from each other's losses. Weather markets are not unrelated:
rainfall in Tokyo and rainfall in Osaka can be the same storm system, so isolating them
gives an appearance of diversification while the underlying peril is shared. The binding
constraint for a weather book is *correlation*, not contagion, and the control for
correlation is a per-peril aggregate cap — which `WeatherPolicyMarket` already has
(`perilExposure` bucketed by region-month, capped at 20% of vault assets, with a 60%
aggregate ceiling over the whole book).

What partial isolation already exists: `MAX_SINGLE_MARKET_BPS` caps any one market at 50% of
the pool, and each market's exposure is independently bounded by its own notional capacity.
Per-peril bucketing has since been **extended to the perp markets** through
`PerilExposureRegistry` — see "Correlated markets are capped in aggregate" above. The remaining
recommendation is to tighten `MAX_SINGLE_MARKET_BPS` when a second market goes live, and to
revisit isolated pools only if genuinely uncorrelated variables are ever listed together.

### Correctness pass — bounded loops, vesting, concentration

Three defects were closed alongside the funding work. None was found by review; each came out of
building the tests for something else.

**An unbounded loop that would have stopped LP yield on a timer.**
`openPositionObligations()` iterated `nextPositionId` — every position the market had ever
created — and ran a vAMM quote on each, skipping closed ones only after paying to load them. It
is the sole input to `sweepSurplus()`, so once the loop outgrew the block gas limit, realised
trader losses could never again be remitted to LPs. Nothing in the suite could catch it, because
catching it needs more positions than any functional test has reason to open.

Now iterated over an `EnumerableSet` of *open* positions, so cost tracks live exposure and
shrinks again as positions close. Measured: 19,860 gas with 5 open and no history, 19,865 with 5
open and 200 closed — flat, where the old loop grew ~40x. Bounded from above by
`MAX_OPEN_POSITIONS`, with `minCollateral` making a slot cost real capital so the bound cannot
be filled cheaply.

An exact O(1) figure is not available and it is worth recording why: obligations are
`Σ max(0, collateral + pnl)`, and the per-position `max(0, ·)` cannot be aggregated because an
underwater position is owed nothing and its deficit must not offset a winner's claim. Aggregate
constant-product PnL *is* computable in one curve evaluation, but that gives a LOWER bound, and
under-stating obligations over-sweeps into money open positions have a claim on.

**The vesting clock reset on every absorb.** `lastProfitAt = block.timestamp` on each
`absorbProfit`/`coverLoss` restarted the full period for profit already part-way through
recognition, so anyone could defer LP profit indefinitely with trivial absorbs — and the junior
tranche had duplicated the pattern, doubling the surface. Recognition now carries an explicit
`unlockEnd` that is a **value-weighted blend** of the outgoing deadline and the new one. A
separate slot is necessary rather than incidental: with a single start time, keeping the
recognised level continuous across an absorb forces the window to be exactly one period long,
which *is* the reset.

**The concentration cap was enforced from one side only.** `MAX_SINGLE_MARKET_BPS` was checked
inside `reserve()`, so a market could pass it and then drift past 50% of the pool as LPs
withdrew or the pool took a loss. `minRequiredAssets()` now takes the larger of the aggregate
utilisation floor and a per-market concentration floor, so the limit holds in both directions.
The market list is an enumerable set bounded by `MAX_AUTHORIZED_MARKETS` and only admin can grow
it — deliberately not user-inflatable, which is the mistake the obligations loop made.

Verified in `test/security/PerpObligationsGas.t.sol` and
`test/unit/VestingAndConcentration.t.sol`.

### Still open — structural work not yet done

A second independent review confirmed the skew reservation's **bookkeeping** is sound — it could
not be made to ratchet, leak, underflow, desync, or deadlock across interleaved
open/close/liquidate sequences, and `release` provably cannot underflow.

Its **risk metric** was not, and the two defects that review named have since been closed:
skew is now tracked in notional (`totalLongNotional` / `totalShortNotional`) rather than
collateral, and the reactive lock has been replaced by the preventive capacity cap described
above. The liquidation path likewise now has both a vault fallback and a payout clamp.

What remains:

**Markets compete for one pool.** One market taking its full `MAX_SINGLE_MARKET_BPS` share can
cause another market's opens to revert for want of capacity, and a trader can move an LP's
`maxWithdraw` by opening one-sided flow. The latter costs real fees and slippage, so it is
griefing rather than free, but both are real. See the pool-isolation assessment above for why
the answer is per-peril aggregation rather than per-market pools.

**The pool is under-capitalised for the exposure traders want.** Rejection runs ~8.6% at the
current coverage ratio under stressed funding and average utilisation ~40%, so roughly 60% of LP
capital sits idle. This is much improved on the ~25% rejection the first calibration measured —
most of that gap was the mispriced funding rather than genuine scarcity — but it is not solved.
It is not a solvency defect either; it is the honest consequence of a small pool facing levered
demand, and it caps what the product can be at current size.

Scarce capacity is now **priced** rather than only rationed (see "Capacity is priced as well as
capped"), which is the design answer. What has not been demonstrated is the effect: rejection
falls only if demand responds to price, and a random-agent simulation cannot show that. The
rejection figure above is unchanged by the surcharge and should be expected to stay unchanged
until it is measured against real, price-sensitive flow.

**The deployment scripts had drifted, and now share one wiring implementation.** They stood up
the pre-waterfall stack: no liquidity vault, no junior tranche, no first-loss reserve, no peril
registry and no policy market. Two phases of capital-structure work were unreachable from any
deployment path and nothing failed, because every tier is optional by design.

`BreezeDeployer` is now the only place that knows how the protocol is wired, and both the scripts
and `test/integration/DeploymentWiring.t.sol` call it — the test asserts each link individually
rather than checking that deployment "succeeded", because a missed `setJuniorTranche` produces a
protocol that works perfectly and silently has no junior tranche. The older scripts are marked
superseded and kept only so the existing Coston2 addresses stay reproducible.

Still true: **the live Coston2 deployment predates all of it.** The addresses in README.md are the
pre-waterfall stack.

**Leverage above 3x is untested**, because `PerpConstants.MAX_LEVERAGE` forbids it. A higher
ceiling would require re-running the coverage-ratio calibration, not just raising the constant.

**Tier 1 and the liquidation backstop contend for the same capital.** `InsuranceFund` is drawn
directly by `_executeLiquidation` for bad debt AND, when configured as waterfall tier 1, by the
vault for routine cover. The vault can therefore drain the reserve liquidation depends on; bad
debt then lands on the market's balance, leaving less to pay other closing positions, which
produces more vault draws that land on senior. The waterfall simulation measured this: enabling
tier 1 left senior *worse off* on 2 of 5 seeds.

This is a priority inversion. Liquidation must have first claim, because liquidation failure
cascades into insolvency whereas senior absorbing a loss is precisely what tier 3 exists for.
The fix is a dedicated first-loss reserve funded by its own fee share, so the two uses do not
compete — not a reserved floor with an arbitrary constant. Deferred to the economics phase.

### A structural point the review surfaced

Writing the obligations test exposed that a perp market routinely owes open positions **more
than it holds** — in one case 136,431 against a balance of 119,988. This is not a bug: vAMM
profit is minted by the curve, not funded by a losing counterparty. It is the structural
under-collateralisation the LP vault exists to backstop, and it means `sweepSurplus` is
correctly a no-op most of the time.

---

## 9. Disclosed Limitations

Stated plainly rather than left to be discovered.

### Not deployed to mainnet
BreezeSwap runs on Coston2 testnet only. Earlier revisions of this repository claimed a
Flare Mainnet deployment and listed mainnet addresses; **those addresses held no code and
the claim was false.** It has been removed. Mainnet is gated on a professional audit.

### No professional audit
No third-party security audit has been performed. The test suite is thorough but
self-authored.

### Oracle integrations are stubs, not live
`MockWeatherOracle` is the only oracle that returns readings. `FtsoWeatherAdapter` and
`FdcWeatherAdapter` implement `IWeatherOracle` and document their swap-in points, but both
revert on `getReading()` — no weather feed exists on FTSO or FDC today. They read no live
data. The abstraction is real; the integrations are not yet. **This is the single largest gap
between this protocol and a deployable one**: every settlement is trusted input until a real
feed exists, and no amount of on-chain correctness compensates for that.

One inconsistency in the stubs was fixed rather than left: both reported `isStale() == false`
while `getReading()` reverted — a dead feed claiming to be fresh. Every consumer guards on
staleness, so a caller that read `isStale` and branched on it concluded the feed was usable and
then hit an unhandled revert; `WeatherPolicyMarket.settlePolicy` checks in exactly that order.
They now report `true`. A stub should fail the way an outage fails, through the normal guard.

### Governance: timelocked, but only if deployed that way
A timelocked handover now exists and is exercised, but whether it is *used* is a deployment
choice, so the limitation is conditional rather than removed.

`BreezeDeployer` splits the roles by how fast each one has to act:

| Role | Holder after handover | Why |
|---|---|---|
| `ADMIN_ROLE`, `DEFAULT_ADMIN_ROLE` | `TimelockController` | The economically potent knobs. Visible for the delay before they land. |
| `MARKET_CREATOR_ROLE` | `TimelockController` | Listing a market with mis-set reserves is what the climatology check guards; a delay is a feature. |
| `PAUSER_ROLE` | Multisig, **directly** | A pause that lands in two days is not an emergency control. |
| `ORACLE_UPDATER_ROLE` | Operational key | Readings are posted continuously; a delay would stop the protocol resolving anything. |

The timelock is **self-administered** (`admin = address(0)`), so its own delay cannot be
shortened without serving it — an admin key able to set the delay to zero is the same as no
timelock. The deployer renounces every role, `DEFAULT_ADMIN_ROLE` last, because it is the role
that grants the others.

Putting `PAUSER_ROLE` outside the timelock is a deliberate trade and worth stating plainly: a
compromised multisig can pause deposits immediately. That is bounded on purpose — withdrawals,
settlement, closes and liquidations are all deliberately unpausable, so the worst case is that
new business stops.

**What remains a limitation.** `GOVERNANCE_MULTISIG` is optional in `DeployProtocol`, and unset
means the deployer keeps every role. That default is loud (the script prints a warning and the
test asserts the outcome) and `DeployMainnet` refuses to run without it, but a deployment made
the easy way is still single-key. The live Coston2 deployment predates all of this and is
single-EOA.

The knob count is also worth naming, because it grew through phases B and C: `setFeeSplit`,
`setMaxJuniorBackingShareBps`, `setLayerParams`, `setUtilizationFeeBps`, `setSamplingInterval`,
`setVariableAggregation`, `setPerilGroup`, `setExposureCaps`, `setDrawerAuthorization`, two
`setPricingOracle`s, and `setOracleValueScale`. Every one is bounded — the fee split cannot
starve the liquidation backstop, the junior share cannot exceed parity, the band cannot be
inverted, the surcharge and sampling interval are capped — so no single call is catastrophic.
But that is a lot of surface for one key, which is what the timelock is for.

### The funding rate is bounded, but still not zero-sum
`FundingRateEngine` applies a shared index to each position's own notional. When long and
short open interest are unequal — the normal state for weather, where hedging demand is
structurally one-directional — total funding paid does not equal total funding received.
The difference is absorbed by the market's collateral balance and, past that, by the LP
vault.

**Partially mitigated.** `BreezePerpMarket` now enforces a skew ceiling (`maxSkew`,
defaulting to 25% of the initial virtual collateral reserve) that rejects new positions
which would push `|longOI − shortOI|` past the cap. Trades that *reduce* the imbalance are
always permitted, so the market can never deadlock. `matchedOpenInterest()` exposes the
portion of open interest that genuinely nets long-against-short.

This **bounds** the mismatch rather than eliminating it. The correct fix is to charge
funding only on `matchedOpenInterest()` and to bill the unmatched remainder a separate
skew fee payable to the LP vault, which is the counterparty it actually faces. That is
not yet implemented.

### Trader profit can still exceed available capital
`BreezeLiquidityVault` backs payouts the market cannot fund from posted collateral, but the
vault is finite. If both the market and the vault are exhausted, `_executeClose` clamps the
payout to the available balance and emits `PayoutShortfall`. A winning trader can still be
paid less than they are owed in the tail case. The clamp is now observable rather than
silent, but the underlying exposure remains.

### Classic Markets have no liquidity mechanism
Classic Markets are peer-matched with no market maker and no price discovery. A market
only fills if an exact counterparty appears. In practice most Classic Markets will sit
empty, and this is not fixed.

`WeatherPolicyMarket` is the answer for small scale: cover is sold one-sided straight
from the LP vault at a historically-derived premium, so it clears with a single buyer and
a single LP and needs no counterparty at all. Classic Markets remain as-is.

### Classic and Perp pricing is bounded, not complete
Both market types now consult `StrikeProbabilityOracle` — see "Markets can no longer be created
at odds unrelated to their climatology" above — but neither is fully priced and the gaps are
specific.

Classic markets are priced for **BINARY payoffs only**. LINEAR and CAPPED payoffs depend on where
inside the range the reading lands, which needs the loss distribution rather than one quantile of
it, so they are left explicitly unpriced rather than given an authoritative-looking wrong number.
Their odds remain whatever the supply split happens to be.

Perp markets are checked only at **creation**, and only against a ±50% band. A perpetual has no
expiry, so its fair mark drifts across seasons and nothing re-checks it afterwards; funding is
what pulls mark toward index during the market's life. The band catches an opening price wrong by
an order of magnitude, not one wrong by a third.

And **unpriced markets still deploy** in both cases, flagged rather than refused, because gating
creation on climatology that has not been posted would make listing a new region impossible until
the seeder had run.

### Strike probabilities are trusted input
`StrikeProbabilityOracle` stores figures computed off-chain by `weather-seed/climatology.ts`
and posted by `ORACLE_UPDATER_ROLE`. The contract validates bounds (≤100%, ≥10 years of
sample) but cannot verify the computation. A compromised updater key could mis-price every
policy. Deriving these on-chain, or attesting them through FDC, would remove that trust
assumption.

### Historical frequency is not a forecast
Pricing assumes the last 30 years are representative of the next term. Climate change makes
that assumption progressively weaker, and it is exactly wrong for trending variables — a
drought strike priced off 1996-2025 will under-price drought risk in a warming region. No
trend adjustment or forward-looking model is applied. The forecast-window rule limits
*buyer* information advantage; it does nothing about a mispriced base rate.

### The vault is tranched, but only into two layers
`JuniorTranche` and `BreezeLiquidityVault` give subordinated and protected claims on the same
book, behind a fee-funded first-loss reserve. That is three tiers, against the many-layered
structures used in real ILS deals.

The layer boundaries are now attachment/exhaustion driven rather than "absorb until empty", but
two gaps remain against how an institutional cat bond is specified. **The attachment point is
reported, not enforced** — junior pays as soon as tier 1 is exhausted wherever that falls,
because refusing to pay below a nominal attachment point would push first loss onto senior
whenever the fee-funded retention was thin. And **the limit is aggregate only**: there is no
per-occurrence limit, so the layer cannot be narrow against a single event and wide across a
period, which is the shape the two calibration regimes disagree about. There is also no mechanism
for a tranche to *decline* a particular risk — see the next limitation.

### LPs cannot price risk individually
Depositors accept whatever `riskLoadBps` and peril caps the admin has set. There is no
per-cover staking or signalling mechanism (as in Nexus Mutual) that would let capital express
a view on which risks it is willing to back and at what price. Bounds and floors limit the
damage, but LPs are trusting a parameter, not choosing one.

### Skew and peril caps are static, not risk-weighted
All of them — the policy market's per-peril cap, the perp registry's group and aggregate caps,
and the skew ceiling — are flat fractions of pool assets. A genuinely risk-weighted system would
size limits by the variance and correlation structure of each peril, so a volatile monsoon region
and a near-deterministic desert region would not share the same cap.

Peril **membership** is likewise declared, not measured. `PerilExposureRegistry.perilGroupOf` is
set by admin, so the correlation structure is an assertion rather than something derived from the
historical record — two regions could be grouped that are uncorrelated, or left ungrouped when
they share a weather system. The default direction is safe (an undeclared region is treated as
fully correlated with every other undeclared one), but the caps enforce declared correlation
rather than actual correlation.

### Basis risk is not addressed
Settlement uses a single regional reading. A hedger whose actual exposure is geographically
distant from the reference point can suffer a loss while their contract pays nothing. This
is the primary real-world failure mode of parametric weather products and no gridded or
multi-station index is implemented.

### Regulatory posture
Weather derivatives are regulated instruments in most jurisdictions (CFTC in the US).
Nothing here constitutes a legal opinion, and permissionless deployment does not confer
regulatory compliance.
