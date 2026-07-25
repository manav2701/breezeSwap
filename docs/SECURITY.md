# BreezeSwap Security Specification & Threat Model

## Bug-Class-to-Defense Map

| Attack Class | Mechanism | Defense / Mitigation | Test Coverage |
|---|---|---|---|
| **Reentrancy (redeem)** | Malicious ERC1155 receiver re-enters `redeem()` during callback | Checks-Effects-Interactions: tokens burned before payout; `ReentrancyGuard` | [`test/security/Reentrancy.t.sol`](file:///c:/Users/manav/OneDrive/Desktop/ddd/breezeswap/contracts/test/security/Reentrancy.t.sol) |
| **Double settlement** | `settle()` invoked twice to corrupt payout ratios | `status != Settled` check at top of `settle()`; state set to `SETTLED` before external calls | [`test/security/DoubleSettle.t.sol`](file:///c:/Users/manav/OneDrive/Desktop/ddd/breezeswap/contracts/test/security/DoubleSettle.t.sol) |
| **Double redemption** | Same position tokens redeemed twice for double payout | ERC1155 `burn()` before payout; ERC1155 balance check prevents double-spending | [`test/security/DoubleRedemption.t.sol`](file:///c:/Users/manav/OneDrive/Desktop/ddd/breezeswap/contracts/test/security/DoubleRedemption.t.sol) |
| **Stale / Invalid Oracle** | `settle()` uses outdated or uninitialized weather reading | Hard revert if `isValid == false` or `isStale(regionId, 86400) == true`; no silent fallback | [`test/security/OracleManipulation.t.sol`](file:///c:/Users/manav/OneDrive/Desktop/ddd/breezeswap/contracts/test/security/OracleManipulation.t.sol) |
| **Vault Over-Withdrawal** | Unauthorized address attempts to drain `CollateralVault` | `onlyMarket` modifier; market address set immutably upon deployment | [`test/security/AccessControl.t.sol`](file:///c:/Users/manav/OneDrive/Desktop/ddd/breezeswap/contracts/test/security/AccessControl.t.sol) |
| **Unauthorized Role Access** | Non-role holder attempts to pause protocol or alter oracle | `BreezeAccessControl` shared registry enforcing `ADMIN_ROLE`, `PAUSER_ROLE`, `ORACLE_UPDATER_ROLE` | [`test/security/AccessControlRetrofit.t.sol`](file:///c:/Users/manav/OneDrive/Desktop/ddd/breezeswap/contracts/test/security/AccessControlRetrofit.t.sol) |
| **Precision / Rounding Loss** | Dust collateral stuck in vault after full market redemption | Last-redeemer-gets-remainder pattern; tested with odd/prime collateral amounts | [`test/security/PrecisionAndRounding.t.sol`](file:///c:/Users/manav/OneDrive/Desktop/ddd/breezeswap/contracts/test/security/PrecisionAndRounding.t.sol) |
| **FXRP Price Staleness** | Stale FTSO FXRP/USD price used during collateral normalization | `FAssetsCollateralAdapter` verifies FTSO staleness bounds; reverts on stale/invalid feed | [`test/security/FAssetsAdapterSecurity.t.sol`](file:///c:/Users/manav/OneDrive/Desktop/ddd/breezeswap/contracts/test/security/FAssetsAdapterSecurity.t.sol) |
| **Front-Running Settlement** | Attacker front-runs `settle()` in mempool | Payouts strictly proportional to collateral contributed; zero economic profit extraction | [`test/economic/EconomicGames.t.sol`](file:///c:/Users/manav/OneDrive/Desktop/ddd/breezeswap/contracts/test/economic/EconomicGames.t.sol) |

---

## Role-Based Access Control Model (Phase 7)

BreezeSwap implements OpenZeppelin's `AccessControl` via a single, shared role registry contract (`BreezeAccessControl.sol`).

* **`ADMIN_ROLE` (`bytes32 public constant ADMIN_ROLE`)**: Can grant/revoke all protocol roles and configure system adapter parameters.
* **`PAUSER_ROLE` (`bytes32 public constant PAUSER_ROLE`)**: Can pause new market deployments (`BreezeMarketFactory.sol`) and pause new position minting (`BreezeMarket.sol`).
* **`ORACLE_UPDATER_ROLE` (`bytes32 public constant ORACLE_UPDATER_ROLE`)**: Can submit weather readings to `MockWeatherOracle.sol`.
* **`MARKET_CREATOR_ROLE` (`bytes32 public constant MARKET_CREATOR_ROLE`)**: Reserved for authorized market creation in perpetual vAMM markets (Phase 8).

---

## Emergency Circuit Breaker: "Pause Never Traps Funds" Guarantee

> [!IMPORTANT]
> **Safety Guarantee**: In `BreezeMarket.sol`, calling `pauseMarket()` halts new position minting (`mintPosition`) only.
> **`settle()` and `redeem()` are explicitly un-gated from `whenNotPaused`.**
> Even if a market is paused due to an emergency or oracle data anomaly, existing position holders can always settle the market once expired and redeem their collateral payouts without delay.

---

## Known Limitations

**No Timelock on Role Management:**
Role assignments are executed instantly by `ADMIN_ROLE`. In production, admin powers will be transferred to a Gnosis Safe multisig with a timelock delay.

**Fee-On-Transfer Tokens Not Supported:**
If a fee-on-transfer ERC20 is configured, accounting will record pre-fee amounts while receiving less. Only fee-free ERC20 tokens (`mUSDT`, `FXRP`) are supported.

**No Formal Audit:**
BreezeSwap has undergone extensive adversarial testing, 10,000-run fuzzing, and invariant testing (256 runs x 64 depth), but has not yet undergone a third-party human audit.

---

## Adversarial Testing Summary

* **Phase 1-4 Test Suites:** Core functional correctness, zero-sum invariant fuzzing (10,000 runs), Coston2 deployment verification, adversarial attacks (Reentrancy, Double Settlement, Double Redemption, Oracle Staleness, Precision Loss, FAssets Price Bounds, Front-Running).
* **Phase 7 Access Control & Security Retrofit:** Tested role grants, unauthorized access reverts, pauser circuit breakers, immediate role revocation, and explicit verification that paused markets permit `settle()` and `redeem()`.
* **Final Result:** 90 / 90 tests passing (100% pass rate).
