# BreezeSwap System Architecture

BreezeSwap is a decentralized weather derivative protocol built on Flare Network (Coston2 Testnet). It supports both **Classic Pooled Binary/Linear/Capped Weather Option Markets** and **vAMM Perpetual Weather Derivative Markets**.

---

## 1. System Overview

```
                      +-----------------------------+
                      |    BreezeAccessControl      |
                      |   (Shared Role Registry)    |
                      +--------------+--------------+
                                     |
           +-------------------------+-------------------------+
           |                                                   |
+----------v----------+                             +----------v----------+
| BreezeMarketFactory |                             |  BreezePerpFactory  |
|  (Classic Options)  |                             |   (vAMM Perps)      |
+----------+----------+                             +----------+----------+
           |                                                   |
+----------v----------+                             +----------v----------+
|    BreezeMarket     |                             |   BreezePerpMarket  |
| (Expiry-based Pool) |                             | (Constant-Product)  |
+---------------------+                             +----------+----------+
                                                               |
                             +---------------------------------+---------------------------------+
                             |                                 |                                 |
                  +----------v----------+          +-----------v---------+          +------------v--------+
                  |    InsuranceFund    |          |  FirstLossReserve   |          |   ProtocolTreasury  |
                  |   (50% Fee Share)   |          |   (30% Fee Share)   |          |   (20% Fee Share)   |
                  |  liquidation debt   |          |  waterfall tier 1   |          |      team ops       |
                  +---------------------+          +---------------------+          +---------------------+
```

The first two are deliberately **separate balances**. They shared one until the vault was measured
draining the reserve that liquidation depends on — see SECURITY.md §8.

---

## 2. Smart Contract Components

### Phase 7 Shared Governance
- **`BreezeAccessControl.sol`**: Centralized role registry mapping `ADMIN_ROLE`, `PAUSER_ROLE`, `ORACLE_UPDATER_ROLE`, and `MARKET_CREATOR_ROLE`.
- **`MockWeatherOracle.sol`**: Shared weather reading oracle gated by `ORACLE_UPDATER_ROLE`.

### Phase 8 vAMM Perpetual Markets
- **`PerpConstants.sol`**: Protocol constants (Max leverage 3x, 10% maintenance margin, 2% liquidation reward, 8-hour production funding interval, 75bps funding cap).
- **`VirtualAMM.sol`**: Pure library implementing synthetic reserve constant product pricing ($x \cdot y = k$).
- **`FundingRateEngine.sol`**: Pure library calculating zero-sum funding rates in Basis Points.
- **`InsuranceFund.sol`**: Shared bad debt coverage pool funded by liquidations and protocol reserves.
- **`BreezePerpMarket.sol`**: vAMM perpetual market supporting `openPosition()`, `closePosition()`, `liquidate()`, and `settleFunding()`.
- **`BreezePerpFactory.sol`**: Pausable perpetual market factory gated by `MARKET_CREATOR_ROLE`.

### Phase 9 Fee Mechanism & Protocol Revenue Distribution
- **`FeeConfig.sol`**: Single shared fee registry with immutable bounds ($0.01\% \le \text{fee} \le 1.00\%$, default $0.10\%$).
- **`ProtocolTreasury.sol`**: Separate team operational revenue vault receiving $20\%$ of collected trading fees.

### Underwriting Capital & Loss Waterfall
- **`BreezeLiquidityVault.sol`**: ERC4626 senior tranche. Pooled LP capital standing as counterparty to trader flow. Owns reservation accounting (`reserve` / `release`), the utilisation cap, locked-profit vesting, the withdrawal cooldown, and the loss waterfall itself.
- **`JuniorTranche.sol`**: ERC4626 subordinated tranche. Absorbs loss ahead of senior capital and earns a bounded multiple of senior's per-unit yield in exchange. Counts toward backing capacity, so it enlarges what the markets can support rather than only redistributing risk. Longer withdrawal cooldown than senior, by design.
- **`FirstLossReserve.sol`**: Protocol-owned capital dedicated to waterfall tier 1 and nothing else, funded by its own fee leg and drawn only by addresses on `authorizedDrawers` (in practice, the vault alone). No shares, no depositors, nothing withdrawable by anyone — capital that arrives is committed to absorbing loss. It exists because tier 1 used to be `InsuranceFund`, which the perp market also draws for liquidation bad debt; sharing one balance let the vault starve liquidation.
- **`IFirstLossFund.sol` / `IJuniorTranche.sol`**: Interfaces holding the waterfall together. The senior vault depends only on these, so it carries no dependency on the perp module and the dependency between the tranches runs one way.
- **`StrikeProbabilityOracle.sol`**: Historically-derived strike probabilities with a bounded risk load, plus climatological expected **levels**. Two distinct feeds for two distinct jobs: a breach probability prices a binary claim (policies, Classic BINARY markets), while an expected level says where a continuous series should sit (a perp market's opening mark). The level's unit is the expected value of a **single oracle reading** — mean daily rainfall, not the monthly total the probabilities are derived from.
- **`CivilDate.sol`**: UTC calendar month from a timestamp. Every priced strike is per-month because weather is seasonal, so anything consulting the pricing oracle needs a month — deriving it rather than accepting it as a parameter removes the possibility of a market being pointed at a season whose climatology flatters it.
- **`WeatherPolicyMarket.sol`**: One-sided parametric cover sold straight from the vault — clears with a single buyer and no counterparty. Enforces the forecast-window lead time and per-peril exposure caps, and settles on the **whole covered period** aggregated by the same statistic the premium was priced on (`SUM` for rainfall totals, `AVERAGE` for temperature means).
- **`PerilExposureRegistry.sol`**: Aggregate exposure caps across perp markets sharing a peril. Each market's own capacity bounds it against the pool; nothing bounded the correlated set, so two rainfall markets on regions seeing the same storm could each fill their allowance. Exposure is **pulled** from registered markets rather than mirrored in registry state, so it cannot desync; the loop is bounded by `MAX_MARKETS` and only admin can grow it.
- **`IPerilExposureRegistry.sol`**: The interface the perp market holds, so it carries no dependency on the registry's view of the vault or of its peers.

**Loss waterfall.** A loss is drawn in a fixed order, and each tier's contribution is emitted
in `LossWaterfall` so the ordering is verifiable from outside:

```
                    market cannot fund a payout
                                │
                                ▼
                  BreezeLiquidityVault.coverLoss()
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
  tier 1                   tier 2                  tier 3
  FirstLossReserve         JuniorTranche           senior LPs
  protocol-owned,          subordinated LPs,       protected,
  fee-funded,              boosted yield,          absorbs the
  vault-only               covers a band           residual
```

Tiers 1 and 2 pull capital *into* the senior vault before the senior tier is measured, so
senior share value falls only by the residual the upper tiers could not absorb. Both upper
tiers are optional; with neither configured the waterfall collapses to single-tranche
behaviour and the senior LP interface is unchanged.

Tier 2 is a **layer**, not a bucket. `attachmentBps` / `exhaustionBps` express it as fractions of
total backing, and the width becomes a per-period aggregate limit: past it, loss belongs to senior
even though junior still holds capital. Junior capital also counts toward backing capacity only up
to `maxJuniorBackingShareBps`, so shifting senior LPs into the junior tranche buys no additional
capacity — only genuinely new subordinated capital enlarges the protocol. Both figures are set by
simulation; see SECURITY.md §8.

**Capacity is preventive, not reactive.** `BreezePerpMarket.maxNotionalCapacity()` derives from
existing backing the largest worst-case notional the market may carry, and `openPosition`
refuses anything beyond it before any token moves — so an under-reserved state is
unrepresentable rather than merely detectable. Exits are never gated by capacity.

**Capacity is also priced.** `utilizationFeeBps` adds a surcharge that scales with how full the
book is, charged only on opens that raise worst-case exposure and retained in the market so
`sweepSurplus` remits it to LPs. The cap stays as a solvency bound; the surcharge makes the
approach to it expensive so the cliff binds less often.

**Capacity is bounded across correlated markets too.** `effectiveNotionalCapacity()` is the
tighter of a market's own capacity and what its peril group leaves it, so correlated markets
cannot each fill their allowance against one weather event. Both limits refuse a trade only when
it actually raises worst-case exposure, so a book pushed over its cap by a tightened parameter or
an LP withdrawal stays repairable, and exits are never gated.

---

## 3. Fee Revenue Distribution Flow

```
Trader Trade (openPosition / closePosition)
            │
            ▼
    [ FeeConfig.sol ] ── Calculate split (Default 0.10%)
            │
      ┌─────┴──────────────┬──────────────┐
      ▼                    ▼              ▼
50% Fee Share       30% Fee Share   20% Fee Share
      │                    │              │
      ▼                    ▼              ▼
[InsuranceFund]   [FirstLossReserve] [ProtocolTreasury]
 (Liquidation      (Waterfall         (Team Ops)
  bad debt)         tier 1)
```

The first two are separate balances by design; they shared one until the vault was measured
draining the reserve liquidation depends on. A market not wired to a `FirstLossReserve` folds
that leg into the liquidation backstop, reproducing the original 80/20 split exactly, so the
tier is opt-in rather than a migration requirement.

Opens that raise worst-case exposure also pay a **utilisation surcharge** (up to 0.40% of
collateral, scaling with how full the book is). It is not routed through `FeeConfig` — it is
retained in the market, which puts the balance above open-position obligations so `sweepSurplus`
remits it to LPs. It compensates the capital actually bearing the tail exposure, so LPs are the
correct destination rather than protocol revenue.

---

## 4. Deployment & Governance

`script/BreezeDeployer.sol` is the only place that knows how the protocol is wired. Both
deployment scripts and `test/integration/DeploymentWiring.t.sol` call it, which is the point of
it existing: every tier of the capital stack is optional by design, so a missed wiring call
produces a protocol that works perfectly and silently has no junior tranche. The scripts had in
fact drifted that far — they stood up the pre-waterfall stack, and nothing failed.

```
DeployProtocol.s.sol   any network; demo defaults, loudly announced
DeployMainnet.s.sol    production; refuses to run without real collateral + a multisig
        │
        └── BreezeDeployer.deploy(config, deployer)
                 deploy → wire → hand over governance → builder renounces everything
```

The builder contract holds every role for the duration and gives all of them up before
returning. That is load-bearing rather than tidy: every wiring call is `onlyAdmin` and
`msg.sender` for those calls is the builder, not the externally owned account running the
script — granting the initial roles to the deployer produces a deployment that reverts on its
first `setFirstLossFund`.

**Governance splits by how fast each role has to act**, not by how powerful it is:

| Role | Holder | Rationale |
|---|---|---|
| `ADMIN_ROLE`, `DEFAULT_ADMIN_ROLE` | `TimelockController` | Economically potent; visible for the delay before landing |
| `MARKET_CREATOR_ROLE` | `TimelockController` | Listing a mis-priced market is what the climatology gate guards |
| `PAUSER_ROLE` | Multisig, directly | A pause that lands in two days is not an emergency control |
| `ORACLE_UPDATER_ROLE` | Operational key | Readings are continuous; a delay stops all settlement |

The timelock is self-administered, so its own delay cannot be shortened without serving it.

---

## 5. Security & Invariant Guarantees

1. **Vault Solvency Invariant**: Market collateral balance + Insurance Fund reserves >= aggregate open position equity.
2. **$k$ Reserve Preservation**: Synthetic reserves satisfy $k = x \cdot y$ across all opens and closes.
3. **Zero-Sum Funding**: Cumulative funding payments strictly balance between Long and Short position holders.
4. **Pause Safety Rule**: Pausing halts `openPosition()` only. `closePosition()` and `liquidate()` remain un-gated to prevent trapped user collateral during emergency pauses.
5. **Immutable Fee Cap**: `FeeConfig` hard-caps trading fees at $1.00\%$ (100 BPS), preventing unbounded fee manipulation.
