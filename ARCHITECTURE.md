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
                                                    +----------v----------+
                                                    |    InsuranceFund    |
                                                    |  (Bad Debt Coverage)|
                                                    +---------------------+
```

---

## 2. Smart Contract Components

### Phase 7 Shared Governance
- **`BreezeAccessControl.sol`**: Centralized role registry mapping `ADMIN_ROLE`, `PAUSER_ROLE`, `ORACLE_UPDATER_ROLE`, and `MARKET_CREATOR_ROLE`.
- **`MockWeatherOracle.sol`**: Shared weather reading oracle gated by `ORACLE_UPDATER_ROLE`.

### Phase 8 vAMM Perpetual Markets
- **`PerpConstants.sol`**: Protocol constants (Max leverage 3x, 10% maintenance margin, 2% liquidation reward, 15-min funding interval, 5% funding cap).
- **`VirtualAMM.sol`**: Pure library implementing synthetic reserve constant product pricing ($x \cdot y = k$).
- **`FundingRateEngine.sol`**: Pure library calculating zero-sum funding rates in Basis Points.
- **`InsuranceFund.sol`**: Shared bad debt coverage pool funded by liquidations and protocol reserves.
- **`BreezePerpMarket.sol`**: vAMM perpetual market supporting `openPosition()`, `closePosition()`, `liquidate()`, and `settleFunding()`.
- **`BreezePerpFactory.sol`**: Pausable perpetual market factory gated by `MARKET_CREATOR_ROLE`.

---

## 3. Security & Invariant Guarantees

1. **Vault Solvency Invariant**: Market collateral balance + Insurance Fund reserves >= aggregate open position equity.
2. **$k$ Reserve Preservation**: Synthetic reserves satisfy $k = x \cdot y$ across all opens and closes.
3. **Zero-Sum Funding**: Cumulative funding payments strictly balance between Long and Short position holders.
4. **Pause Safety Rule**: Pausing halts `openPosition()` only. `closePosition()` and `liquidate()` remain un-gated to prevent trapped user collateral during emergency pauses.
