# Known issues

Open defects, written down rather than fixed, with enough detail to act on later. Anything
here is deliberately **not** in the demo path; see `DEMO_RUNBOOK.md` §4.

---

## 1. Classic BINARY markets price on monthly totals and settle on one reading

**Status:** open, diagnosed, fix designed and reverted.
**Severity:** high. The fair-odds gate is not merely inert, it points the wrong way.

### What happens

`BreezeMarket.settle()` reads a single value:

```solidity
IWeatherOracle.Reading memory reading = oracle.getReading(regionId, expiryTimestamp);
```

But `fairLongShareBps` comes from `StrikeProbabilityOracle`, and `weather-seed/src/climatology.ts`
computes those probabilities as *P(**monthly total** > strike)*. Tokyo, August, above 40mm is
9333 bps because 28 of 30 Augusts exceeded 40mm **across the whole month**.

A single day almost never reaches a monthly total. On the seeded record, above 40mm happens
on roughly 1 day in 43, about 2.3%. So the protocol asserts the long side wins 93.33% of the
time on an event that occurs about 2% of the time, and `_checkFairOdds` then refuses deposits
that move the pool *away* from a 93.33/6.67 split. It actively pushes capital onto the losing
side. That is worse than having no gate.

Reproduce on the live market `0x822e063702bb814aa140c827b414becded8dae71`:

```bash
cast call 0x822e063702bb814aa140c827b414becded8dae71 "fairLongShareBps()(uint256)" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc     # 9333
```

Then open the same market in the UI: *"1 of 43 readings landed in the payout range."*

### Why no test caught it

`ClimatologyPricingTest` asserts the gate behaves correctly **given** a probability.
`PayoffCalculatorTest` asserts payouts are correct **given** an oracle value. Neither asserts
that the probability and the settlement measure the same physical quantity. The defect lives
in the seam between two individually correct components, which is also where the identical
bug in `WeatherPolicyMarket` lived.

### The fix, and why it was deferred

`WeatherPolicyMarket` already solves this: it records an `Aggregation` (`SUM` for rainfall
totals, `AVERAGE` for temperature means) at purchase and settles on the whole covered period.
`BreezeMarket` needs the same treatment:

1. `CivilDate` gains `civilFromTimestamp`, `monthStart` and `daysInMonth`.
2. `BreezeMarket` derives `coverageStart` and `sampleCount` from the calendar month **ending
   at** expiry, and settles on the aggregate rather than one reading.
3. `_resolveFairOdds` returns unpriced when expiry falls mid-month, because a partial month
   is not the quantity the probability describes. Unpriced is the honest answer and matches
   how LINEAR and CAPPED are already treated.
4. Require ~93% sample coverage, matching the tolerance the climatology script applies when
   it discards incomplete months.

This was implemented and reverted, for three reasons worth recording:

- **32 of 569 tests fail**, all legitimately. About 23 seed a single reading and would need a
  month; 7 fair-odds tests use mid-month expiries and correctly become unpriced. Mechanical
  but not small.
- **The currently-seeded data cannot satisfy it.** The seeder wrote 30 days back and 14
  forward, roughly 12 July to 25 August. A market covering all of August needs 31 days and
  has 25, which is 80.6% against a 93% floor, so settlement reverts with
  `InsufficientSampleCoverage`.
- **It needs a redeploy.** `PositionToken` is owned by the current factory, so a new factory
  needs a new position token. Redeploy plus re-seeding the missing days plus recreating
  markets is roughly 8 C2FLR, and the faucet grants about 100 per day.

### Do this when picking it up

Land the contract change and the test fixtures first, with no gas spent. Then, on a day with
a fresh faucet grant: seed a **complete** calendar month for at least one region, redeploy
`PositionToken` + `BreezeMarketFactory`, update `deployments/coston2.json`,
`sdk/src/constants.ts` and Render's `FACTORY_ADDRESS`, and create a market expiring on a
month boundary so it comes out priced.

---

## 2. `skewReserveBps` is probably set too low

**Status:** open, measured, documented in the whitepaper.
**Severity:** medium.

`ReserveMonteCarloTest` sweeps the coverage ratio across three seeds and 900 actions each
under the most aggressive funding preset the protocol permits:

| Coverage | Shortfall events | Worst shortfall | Mean rejection |
|---|---|---|---|
| 30% | 38 | 100% of amount owed | 18.09% |
| **50% (shipped)** | **1** | **30.9%** | **10.70%** |
| 75% | 0 | 0 | 11.18% |
| 100% | 0 | 0 | 21.70% |

75% eliminates the remaining shortfall for 0.48 percentage points more trade rejection. The
failure boundary is also only located between 30% and 50%, because 40% was never tested.

The repository README still quotes the older figures for this sweep, which showed zero
shortfalls at 50%. The numbers above are what the suite produces today.

---

## 3. The weather oracle adapters revert on read

**Status:** open by design, disclosed everywhere.
**Severity:** high for production, none for the demo.

`FtsoWeatherAdapter` and `FdcWeatherAdapter` implement `IWeatherOracle` and both revert on
`getReading`. Settlement runs on `MockWeatherOracle`, where an address holding
`ORACLE_UPDATER_ROLE` writes readings directly. The readings themselves are real Open-Meteo
observations, but nothing on-chain verifies that.

Both stubs correctly report `isStale() == true`, so consumers refuse them through the normal
guard rather than an unhandled revert. That is the right behaviour for a stub, and it is not
a substitute for the integration.

This is the largest single gap between the repository and a production system, and no amount
of capital modelling compensates for it.

---

## 4. Cosmetic

- **`/api/weather/regions` returns duplicate display names.** Each city appears twice, once
  per weather variable, both labelled with the city name, because `getRegionName` maps a
  region id to a city and drops the variable. Not consumed by the frontend today.
- **The deployer holds every role.** No governance multisig is configured, so there is no
  timelock and no separation between admin, pauser and oracle updater. The deploy script
  announces this on every run and `DeployMainnet.s.sol` refuses to run in this state.
