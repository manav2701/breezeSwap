# BreezeSwap — Demo Video Script & Manual Testing Protocol

> **Purpose:** Step-by-step video demonstration beat sheet and 6-scenario multi-wallet manual testing protocol for verifying BreezeSwap on-chain contracts and UI.

---

## 🎬 Part A — Demo Video Beat Sheet (8–12 Minutes)

### 1. Cold Open (30s)
- **Visual:** BreezeSwap Landing Page (`/`) with live animated hero banner and active multi-chain toggle.
- **Narration:** *"Traditional weather insurance takes months to settle and requires direct counterparties. BreezeSwap is the first parametric weather derivatives protocol on Flare Network, combining CME-style fixed weather swaps with continuous vAMM weather perpetuals featuring 15-minute funding rates and open interest."*

### 2. Classic Market Settlement Lifecycle (90s)
- **Visual:** Navigate to `/markets/0x04B7Cf428c39a33F35fE557B7f9538916E3C6576`.
- **Narration:** *"Here is a live Tokyo Rainfall Capped Options Market. Long and Short holders deposit collateral into a shared vault. At expiry, the oracle delivers real weather readings, and payouts scale linearly between low and high thresholds. Watch us redeem winning position tokens with 0 rounding loss."*

### 3. Perp Market Centerpiece & Multi-Account Activity (3–4 min)
- **Visual:** Navigate to `/perp-markets/[address]`.
- **Key Actions:**
  1. Open a **2x Long position** with 100 USDT collateral on camera.
  2. Highlight the **PerpStatsHeader** updating Mark Price, 24h Volume, and Long/Short OI ratio bar immediately.
  3. Show the **DepthLadder** and live slippage preview box in the trade form.
  4. Show the **TradeHistoryTable** updating automatically within 15 seconds.
  5. Demonstrate **15-Minute Funding Settlement**: Show the live 15m countdown timer counting down to 00:00, followed by funding settlement updating accrued funding balances between Longs and Shorts.

### 4. Live Risk Management & Liquidation (60–90s)
- **Visual:** Navigate to `/portfolio`.
- **Narration:** *"On the Portfolio page, traders see live unrealized PnL, margin used, exact liquidation prices, and a color-graduated safety gauge. Notice Wallet D's position sitting near the 10% maintenance margin threshold — when market price shifts, liquidators can call permissionless liquidation, earning a 2% reward while protecting vault solvency."*

### 5. Role-Based Governance & Emergency Pause Safety (30–45s)
- **Visual:** Navigate to `/admin`.
- **Narration:** *"BreezeAccessControl governs protocol roles. When PAUSER_ROLE triggers an emergency pause, new position opening is halted instantly. Crucially, existing traders can ALWAYS close positions and liquidate underwater margin — collateral is never trapped."*

### 6. Dual Network Toggle (30s)
- **Visual:** Click **NetworkSwitcher** pill in top navbar to switch from Coston2 Testnet (Chain ID 114) to Flare Mainnet (Chain ID 14).
- **Narration:** *"BreezeSwap seamlessly supports both testnet and Flare Mainnet (Chain ID 14). Toggling networks instantly switches RPC clients, contract registries, and indexer queries."*

### 7. Closing (30s)
- **Visual:** Summary slide / repo link (`github.com/manav2701/breezeSwap`).
- **Narration:** *"122 passing Foundry tests, 100% core vAMM solvency coverage, and live dual-chain deployments. Thank you!"*

---

## 🧪 Part B — Multi-Wallet Manual Testing Protocol (6 Scenarios)

### Testing Setup
Prepare 4 distinct browser wallet accounts funded with Coston2 testnet FLR and mock USDT:
- **Wallet A**: Long Trader (`0xE9D7...4503`)
- **Wallet B**: Short Trader (`0x7099...79C8`)
- **Wallet C**: Liquidator (`0x3C44...3546`)
- **Wallet D**: High-Leverage Target (`0x90F7...9678`)

---

### Scenario 1 — Balanced Market Baseline
1. **Wallet A** opens 100 USDT 1x Long position.
2. **Wallet B** opens 100 USDT 1x Short position on the same market.
3. **Verify:**
   - Mark Price sits near Oracle Price ($25.00).
   - Long/Short OI ratio bar shows a clean 50%/50% split.
   - Funding Rate stays near 0.00%.

### Scenario 2 — Imbalanced Market & Funding Rate Correction
1. **Wallet A** opens 300 USDT 3x Long position.
2. **Verify:**
   - Mark Price increases above Oracle Price ($26.40 vs $25.00).
   - Long OI dominance increases to 80%+.
   - Funding Rate turns positive (+0.05%).
3. **Wallet B** opens a Short position specifically to collect funding payments from Longs.
4. **Verify:** Funding settlement transfers accrued funding from Wallet A to Wallet B.

### Scenario 3 — Margin Call & Permissionless Liquidation
1. **Wallet D** opens a 3x Long position with minimal collateral near the 10% maintenance margin threshold.
2. Admin (`ORACLE_UPDATER_ROLE`) posts a downward oracle update to push Wallet D's position underwater.
3. **Wallet C** (Liquidator) calls `liquidate()`.
4. **Verify:**
   - Position is closed cleanly.
   - Wallet C receives 2% liquidator reward.
   - Bad debt is covered by `InsuranceFund.sol`.

### Scenario 4 — Pause Safety Proof
1. Admin (`PAUSER_ROLE`) calls `pauseOpens()` on `BreezePerpFactory.sol`.
2. **Wallet A** attempts to open a new position -> Transaction reverts with `EnforcedPause()`.
3. **Wallet B** calls `closePosition()` -> Transaction succeeds!
4. **Verify:** Collateral is NEVER trapped during protocol pauses.

### Scenario 5 — Classic Market Full Settlement Lifecycle
1. **Wallet A** mints 50 USDT Long position tokens on `BreezeMarket.sol`.
2. **Wallet B** mints 50 USDT Short position tokens.
3. Market reaches expiry. Admin posts final oracle weather reading (e.g. 35mm rainfall).
4. `settle()` is called, computing payout ratio mathematically.
5. **Wallet A** calls `redeem()` -> Receives exact winning collateral payout with 0 rounding loss.

### Scenario 6 — Cross-Network Parity Toggle
1. Connect wallet and select **Coston2 Testnet (114)** in `NetworkSwitcher`.
2. Inspect market data and contract addresses.
3. Select **Flare Mainnet (14)** in `NetworkSwitcher`.
4. **Verify:**
   - Top banner updates to green Flare Mainnet notice.
   - Contract addresses switch to Mainnet registry (`0x5A88...`, `0x799f...`).
   - Network switching functions cleanly without page reloads.
