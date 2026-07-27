# BreezeSwap Security Architecture & Emergency Procedures

## 1. Access Control & Role Hierarchy

All administrative actions across Classic and Perpetual markets are permissioned via `BreezeAccessControl`:

- **`DEFAULT_ADMIN_ROLE`**: Can grant and revoke all protocol roles.
- **`ADMIN_ROLE`**: Can authorize perpetual markets on the `InsuranceFund` and update risk parameters.
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
