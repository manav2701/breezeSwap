# BreezeSwap Security Specification

## Threat Surface Analysis & Defenses

### 1. Reentrancy Vulnerabilities
- **Risk:** Malicious ERC20 tokens or contracts reentering during `CollateralVault.withdraw()` or `BreezeMarket.redeem()`.
- **Mitigation:**
  - All withdrawal functions inherit OpenZeppelin's `ReentrancyGuard` (`nonReentrant` modifier).
  - Checks-Effects-Interactions pattern enforced: `PositionToken` is burned *before* any ERC20 collateral is transferred to the user.
  - Verified by malicious receiver test `test_ReentrancyAttemptFails` in `CollateralVaultTest`.

### 2. Oracle Manipulation & Staleness
- **Risk:** Settling markets against stale, uninitialized, or invalid weather oracle readings.
- **Mitigation:**
  - `BreezeMarket.settle()` explicitly validates `reading.isValid == true`.
  - Enforces `oracle.isStale(regionId, 86400)` check. If data is older than 24 hours (86,400s), settlement hard-reverts with `OracleDataStale()`.

### 3. Double-Settlement & Double-Redemption
- **Risk:** Re-processing settlements or double-spending position tokens.
- **Mitigation:**
  - `status` state variable transitions from `OPEN` to `SETTLED`. `settle()` reverts with `MarketAlreadySettled()` if invoked again.
  - `redeem()` burns `PositionToken` amount immediately upon redemption. Submitting the same token ID twice reverts due to zero token balance.

### 4. Zero-Sum Invariant & Rounding Advantage
- **Risk:** Rounding errors causing vault collateral insolvency or dust accumulation.
- **Mitigation:**
  - `PayoffCalculator` uses strict integer math where short payout is calculated as `notional - longPayout`.
  - Zero-sum property (`longPayout + shortPayout == notional`) verified across 10,000 fuzz runs.
  - Vault drained to exactly 0 balance verified in `FullLifecycleIntegrationTest`.

### 5. FXRP Price Feed Volatility
- **Risk:** Rapid price swings in `FXRP/USD` during position minting.
- **Mitigation:**
  - Position sizes are normalized using real-time FTSOv2 price feeds via `FAssetsCollateralAdapter`.

---

## Known Limitations & Roadmap

- **Admin Control:** Contract deployment and initial oracle administration use single EOA key (`0xE9D7B6576581AD0A712B5DBC83cD27378c494503`). Future mainnet releases will transition to a multisig (Gnosis Safe) with timelock control.
