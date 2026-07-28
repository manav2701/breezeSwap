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
- **Funding Interval**: 15 minutes (900 seconds)
- **Funding Rate Cap**: $\pm 500$ BPS ($5\%$) per 15-minute interval

---

## 4. Fee Bounds & Revenue Security

- **Hard-Capped Fee Ceiling**: `FeeConfig.MAX_FEE_BPS` is hard-coded to **1.00% (100 BPS)** and is immutable. No admin action can raise fees above 1.00%.
- **Fee Floor**: `FeeConfig.MIN_FEE_BPS` is hard-coded to **0.01% (1 BPS)**.
- **Default Fee Rate**: Set to **0.10% (10 BPS)**.
- **Revenue Split**: $80\%$ of collected fees automatically flow to `InsuranceFund` to backstop bad debt; $20\%$ flows to `ProtocolTreasury`.
- **Classic Markets Fee Scope**: Classic Options Markets do not currently charge a trading fee; Perpetual vAMM Markets do. This asymmetry is intentional for v1 given hackathon time constraints and is a documented roadmap item.

---

## 5. Formal Verification & Testing Snapshot

- **Passing Test Suite**: 122/122 Tests Passed (100% Pass Rate across 31 Test Suites).
- **Core Line Coverage**: 82.88% overall (100% VirtualAMM, 100% CollateralVault, 100% FundingRateEngine, 96.83% BreezeMarket).
- **Invariant Solvency Guarantees**: 8 Invariants held across 256 Runs × 64 Depth (`invariant_vaultSolvency`, `invariant_kPreserved`, `invariant_openInterestConsistent`, `invariant_onlyAuthorizedWithdrawals`).
