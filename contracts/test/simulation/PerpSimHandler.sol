// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../src/perp/BreezePerpMarket.sol";
import "../../src/vault/BreezeLiquidityVault.sol";
import "../../src/oracle/MockWeatherOracle.sol";

/// @notice Drives randomised trader, LP, and weather activity against a live
/// market so the reserve model can be judged on evidence rather than intuition.
///
/// Every action records outcome statistics. The point is not only "did anything
/// revert" but *how the model behaves*: how often it refuses trades, how much
/// capital it leaves idle, and whether the capital it demands bears any relation
/// to the losses that actually occur.
contract PerpSimHandler is Test {
    BreezePerpMarket public market;
    BreezeLiquidityVault public vault;
    MockWeatherOracle public oracle;
    ERC20 public token;
    bytes32 public regionId;

    address[] public traders;
    address[] public lps;

    uint256[] public openIds;

    // ---- Trade flow ----
    uint256 public opensAttempted;
    uint256 public opensSucceeded;
    uint256 public opensRejectedBacking;
    uint256 public opensRejectedSkew;
    uint256 public opensRejectedOther;
    uint256 public closes;
    uint256 public liquidations;

    // ---- Solvency ----
    /// @notice Closes where the trader received materially less than they were owed.
    uint256 public shortfallEvents;
    uint256 public shortfallTotal;
    uint256 public worstShortfallBps;

    // ---- Capital efficiency ----
    uint256 public utilizationSamples;
    uint256 public utilizationSumBps;
    uint256 public peakUtilizationBps;

    // ---- Reserve adequacy ----
    uint256 public peakReserveRequired;
    uint256 public totalVaultDrawn;
    uint256 public peakVaultDrawnSingle;

    // ---- LP flow ----
    uint256 public lpDeposits;
    uint256 public lpWithdrawals;
    uint256 public lpWithdrawalsBlocked;

    constructor(
        BreezePerpMarket _market,
        BreezeLiquidityVault _vault,
        MockWeatherOracle _oracle,
        ERC20 _token,
        bytes32 _regionId,
        address[] memory _traders,
        address[] memory _lps
    ) {
        market = _market;
        vault = _vault;
        oracle = _oracle;
        token = _token;
        regionId = _regionId;
        traders = _traders;
        lps = _lps;
    }

    function _trader(uint256 seed) internal view returns (address) {
        return traders[seed % traders.length];
    }

    function _lp(uint256 seed) internal view returns (address) {
        return lps[seed % lps.length];
    }

    function _sample() internal {
        uint256 assets = vault.totalAssets();
        if (assets == 0) return;
        uint256 u = (vault.totalReserved() * 10000) / assets;
        if (u > 10000) u = 10000;
        utilizationSumBps += u;
        utilizationSamples += 1;
        if (u > peakUtilizationBps) peakUtilizationBps = u;

        uint256 req = market.requiredVaultReserve();
        if (req > peakReserveRequired) peakReserveRequired = req;
    }

    // -----------------------------------------------------------------
    // Traders
    // -----------------------------------------------------------------

    function openPosition(uint256 traderSeed, uint256 collateral, uint256 leverage, bool isLong)
        external
    {
        address t = _trader(traderSeed);
        collateral = bound(collateral, 100e18, 80_000e18);
        // Contract ceiling is 3x; simulating beyond it would test nothing real.
        leverage = bound(leverage, 1, PerpConstants.MAX_LEVERAGE);
        if (token.balanceOf(t) < collateral) return;

        opensAttempted += 1;
        vm.prank(t);
        try market.openPosition(isLong, collateral, leverage) returns (uint256 id) {
            opensSucceeded += 1;
            openIds.push(id);
        } catch (bytes memory reason) {
            bytes4 sel;
            if (reason.length >= 4) {
                assembly {
                    sel := mload(add(reason, 0x20))
                }
            }
            if (sel == BreezePerpMarket.InsufficientVaultBacking.selector) {
                opensRejectedBacking += 1;
            } else if (sel == BreezePerpMarket.SkewCapExceeded.selector) {
                opensRejectedSkew += 1;
            } else {
                opensRejectedOther += 1;
            }
        }
        _sample();
    }

    /// Closes a position and checks the trader was actually paid what the market
    /// said they were owed. A shortfall here is protocol insolvency, whatever the
    /// call's success status says.
    function closePosition(uint256 idSeed) external {
        if (openIds.length == 0) return;
        uint256 idx = idSeed % openIds.length;
        uint256 id = openIds[idx];

        (address trader,, uint256 collateral,,,,, bool isOpen) = market.positions(id);
        if (!isOpen) {
            _removeId(idx);
            return;
        }

        int256 pnl = market.calculateUnrealizedPnl(id);
        int256 equity = int256(collateral) + pnl;
        uint256 owed = equity > 0 ? uint256(equity) : 0;

        uint256 before = token.balanceOf(trader);
        vm.prank(trader);
        try market.closePosition(id) {
            closes += 1;
            uint256 received = token.balanceOf(trader) - before;

            // Allow 1% for trading fees and rounding; anything beyond that is the
            // market failing to honour a position it priced itself.
            uint256 tolerated = (owed * 9900) / 10000;
            if (owed > 0 && received < tolerated) {
                uint256 gap = owed - received;
                shortfallEvents += 1;
                shortfallTotal += gap;
                uint256 bps = (gap * 10000) / owed;
                if (bps > worstShortfallBps) worstShortfallBps = bps;
            }
            _removeId(idx);
        } catch {}
        _sample();
    }

    function liquidate(uint256 idSeed, uint256 liquidatorSeed) external {
        if (openIds.length == 0) return;
        uint256 idx = idSeed % openIds.length;
        uint256 id = openIds[idx];

        (,,,,,,, bool isOpen) = market.positions(id);
        if (!isOpen) {
            _removeId(idx);
            return;
        }
        if (!market.isLiquidatable(id)) return;

        vm.prank(_trader(liquidatorSeed));
        try market.liquidate(id) {
            liquidations += 1;
            _removeId(idx);
        } catch {}
        _sample();
    }

    function _removeId(uint256 idx) internal {
        openIds[idx] = openIds[openIds.length - 1];
        openIds.pop();
    }

    // -----------------------------------------------------------------
    // Liquidity providers
    // -----------------------------------------------------------------

    function lpDeposit(uint256 lpSeed, uint256 amount) external {
        address who = _lp(lpSeed);
        amount = bound(amount, 1_000e18, 300_000e18);
        if (token.balanceOf(who) < amount) return;

        vm.prank(who);
        try vault.deposit(amount, who) {
            lpDeposits += 1;
        } catch {}
        _sample();
    }

    function lpWithdraw(uint256 lpSeed, uint256 shares) external {
        address who = _lp(lpSeed);

        vm.prank(who);
        vault.requestWithdrawal();
        vm.warp(block.timestamp + vault.withdrawalCooldown());

        uint256 max = vault.maxRedeem(who);
        if (max == 0) {
            lpWithdrawalsBlocked += 1;
            return;
        }
        shares = bound(shares, 1, max);

        vm.prank(who);
        try vault.redeem(shares, who, who) {
            lpWithdrawals += 1;
        } catch {
            lpWithdrawalsBlocked += 1;
        }
        _sample();
    }

    // -----------------------------------------------------------------
    // Weather and funding
    // -----------------------------------------------------------------

    /// Moves the oracle and settles funding, which shifts value between sides
    /// without touching the curve — the mechanism that makes trader PnL real
    /// rather than self-cancelling.
    function weatherMove(uint256 valueSeed, uint256 timeSeed) external {
        uint256 mm = bound(valueSeed, 1, 400) * 1e6;
        vm.warp(block.timestamp + bound(timeSeed, 15 minutes, 3 days));

        oracle.setReading(regionId, block.timestamp, int256(mm));
        try market.settleFunding() {} catch {}
        _sample();
    }

    // -----------------------------------------------------------------
    // Reporting
    // -----------------------------------------------------------------

    function openIdCount() external view returns (uint256) {
        return openIds.length;
    }

    function avgUtilizationBps() external view returns (uint256) {
        if (utilizationSamples == 0) return 0;
        return utilizationSumBps / utilizationSamples;
    }

    function rejectionRateBps() external view returns (uint256) {
        if (opensAttempted == 0) return 0;
        return ((opensRejectedBacking + opensRejectedSkew) * 10000) / opensAttempted;
    }
}
