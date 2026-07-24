# BreezeSwap Security Specification & Threat Model

## Bug-Class-to-Defense Map

| Attack Class | Mechanism | Defense / Mitigation | Test Coverage |
|---|---|---|---|
| **Reentrancy (redeem)** | Malicious ERC1155 receiver re-enters `redeem()` during callback | Checks-Effects-Interactions: tokens burned before payout; `ReentrancyGuard` | [`test/security/Reentrancy.t.sol`](file:///c:/Users/manav/OneDrive/Desktop/ddd/breezeswap/contracts/test/security/Reentrancy.t.sol) |
| **Double settlement** | `settle()` invoked twice to corrupt payout ratios | `status != Settled` check at top of `settle()`; state set to `SETTLED` before external calls | [`test/security/DoubleSettle.t.sol`](file:///c:/Users/manav/OneDrive/Desktop/ddd/breezeswap/contracts/test/security/DoubleSettle.t.sol) |
| **Double redemption** | Same position tokens redeemed twice for double payout | ERC1155 `burn()` before payout; ERC1155 balance check prevents double-spending | [`test/security/DoubleRedemption.t.sol`](file:///c:/Users/manav/OneDrive/Desktop/ddd/breezeswap/contracts/test/security/DoubleRedemption.t.sol) |
| **Stale / Invalid Oracle** | `settle()` uses outdated or uninitialized weather reading | Hard revert if `isValid == false` or `isStale(regionId, 86400) == true`; no silent fallback | [`test/security/OracleManipulation.t.sol`](file:///c:/Users/manav/OneDrive/Desktop/ddd/breezeswap/contracts/test/security/OracleManipulation.t.sol) |
| **Vault Over-Withdrawal** | Unauthorized address attempts to drain `CollateralVault` | `onlyMarket` modifier; market address set immutably upon deployment | [`test/security/AccessControl.t.sol`](file:///c:/Users/manav/OneDrive/Desktop/ddd/breezeswap/contracts/test/security/AccessControl.t.sol) |
| **Precision / Rounding Loss** | Dust collateral stuck in vault after full market redemption | Last-redeemer-gets-remainder pattern; tested with odd/prime collateral amounts | [`test/security/PrecisionAndRounding.t.sol`](file:///c:/Users/manav/OneDrive/Desktop/ddd/breezeswap/contracts/test/security/PrecisionAndRounding.t.sol) |
| **FXRP Price Staleness** | Stale FTSO FXRP/USD price used during collateral normalization | `FAssetsCollateralAdapter` verifies FTSO staleness bounds; reverts on stale/invalid feed | [`test/security/FAssetsAdapterSecurity.t.sol`](file:///c:/Users/manav/OneDrive/Desktop/ddd/breezeswap/contracts/test/security/FAssetsAdapterSecurity.t.sol) |
| **Front-Running Settlement** | Attacker front-runs `settle()` in mempool | Payouts strictly proportional to collateral contributed; zero economic profit extraction | [`test/economic/EconomicGames.t.sol`](file:///c:/Users/manav/OneDrive/Desktop/ddd/breezeswap/contracts/test/economic/EconomicGames.t.sol) |

---

## Known Limitations

**Single EOA Owner:**
MockWeatherOracle and FAssetsCollateralAdapter administrative functions are currently owned by a single deployer EOA (`0xE9D7B6576581AD0A712B5DBC83cD27378c494503`). In production, admin rights will transition to a Gnosis Safe multisig with a timelock.

**No Timelock on Parameter Changes:**
Factory parameters (oracle feeds, collateral token whitelists) are adjustable by owner without delay. Mitigation roadmap includes multisig -> timelock -> eventual DAO governance.

**MockWeatherOracle Trust Assumption:**
On testnet, `MockWeatherOracle` relies on deployer key authorization. Production markets replace `MockWeatherOracle` with `FtsoWeatherAdapter` or `FdcWeatherAdapter` leveraging Flare Network consensus.

**Fee-On-Transfer Tokens Not Supported:**
If a fee-on-transfer ERC20 is configured, accounting will record pre-fee amounts while receiving less. Only fee-free ERC20 tokens (`mUSDT`, `FXRP`) are supported.

**No Formal Audit:**
BreezeSwap has undergone extensive adversarial testing, 10,000-run fuzzing, and invariant testing (256 runs x 64 depth), but has not yet undergone a third-party human audit.

---

## Adversarial Testing Summary

Two formal rounds of security & game-theoretic testing were conducted:

- **Round 1 (Phase 1 & 2):** Core functional correctness, zero-sum invariant fuzzing (10,000 runs), Coston2 deployment verification.
- **Round 2 (Phase 3):** Adversarial attacks (Reentrancy, Double Settlement, Double Redemption, Oracle Staleness, Access Control, Precision Loss, FAssets Price Bounds, Invariant Fuzzing, Front-Running & Griefing Games).
- **Findings & Fixes:** Implemented global supply tracking and the last-redeemer-gets-remainder pattern in `BreezeMarket.sol` to guarantee complete vault draining (0 dust).
- **Final Result:** 82 / 82 tests passing (100% pass rate).
