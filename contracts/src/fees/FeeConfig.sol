// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../access/BreezeAccessControl.sol";

/// @title FeeConfig
/// @notice Single shared fee-rate registry. Rate is admin-adjustable but
/// hard-capped at MAX_FEE_BPS — this cap is immutable and cannot be
/// raised by any admin action.
///
/// Every fee is split three ways, and the third leg is the reason this contract
/// changed. Fees used to go 80/20 to the liquidation insurance fund and the
/// treasury, and the loss waterfall then drew its first tier from that SAME
/// insurance fund. Two unrelated consumers competing for one pot is a priority
/// inversion: the vault can drain the reserve liquidation depends on, and
/// liquidation failure cascades into further bad debt whereas senior capital
/// absorbing a loss is precisely what the senior tier exists for. Measured in
/// `WaterfallMonteCarloTest`, enabling the shared fund as tier 1 left senior LPs
/// WORSE off on 2 of 5 seeds.
///
/// The fix is a separately funded reserve, which means a separately funded fee
/// leg. `firstLossShareBps` is that leg; `FirstLossReserve` is where it goes.
contract FeeConfig {
    BreezeAccessControl public immutable accessControl;

    uint256 public constant MAX_FEE_BPS = 100;       // 1.00% hard ceiling, immutable
    uint256 public constant MIN_FEE_BPS = 1;          // 0.01% floor
    uint256 public tradingFeeBps = 10;                // 0.10% default, admin-adjustable within bounds

    // -----------------------------------------------------------------
    // Fee destination split — shares of the collected fee, in bps
    // -----------------------------------------------------------------

    /// @notice Share funding the liquidation backstop (`InsuranceFund`).
    uint256 public insuranceShareBps = 5000;

    /// @notice Share funding waterfall tier 1 (`FirstLossReserve`).
    uint256 public firstLossShareBps = 3000;

    /// @notice Share funding protocol revenue (`ProtocolTreasury`).
    uint256 public treasuryShareBps = 2000;

    /// @notice Floor on the liquidation backstop's share.
    ///
    /// @dev Without it, routing the split is enough to recreate the very defect
    /// this three-way split fixes, just from the other direction: an admin could
    /// send everything to the first-loss reserve and starve liquidation of the
    /// capital it needs to clear bad debt. The floor makes the liquidation
    /// backstop's funding a property of the contract rather than of governance's
    /// good behaviour.
    uint256 public constant MIN_INSURANCE_SHARE_BPS = 3000;

    /// @notice Ceiling on protocol revenue's share, so fees cannot be redirected
    /// away from risk capital and into revenue.
    uint256 public constant MAX_TREASURY_SHARE_BPS = 3000;

    event FeeRateUpdated(uint256 oldRateBps, uint256 newRateBps, address indexed updatedBy);
    event FeeSplitUpdated(uint256 insuranceBps, uint256 firstLossBps, uint256 treasuryBps);

    error UnauthorizedCaller();
    error InvalidFeeBounds();
    error InvalidFeeSplit();

    constructor(address _accessControl) {
        require(_accessControl != address(0), "zero address");
        accessControl = BreezeAccessControl(_accessControl);
        require(
            insuranceShareBps + firstLossShareBps + treasuryShareBps == 10000,
            "shares must sum to 100%"
        );
    }

    function setTradingFeeBps(uint256 newRateBps) external {
        if (!accessControl.hasRole(accessControl.ADMIN_ROLE(), msg.sender)) {
            revert UnauthorizedCaller();
        }
        if (newRateBps < MIN_FEE_BPS || newRateBps > MAX_FEE_BPS) {
            revert InvalidFeeBounds();
        }
        uint256 oldRate = tradingFeeBps;
        tradingFeeBps = newRateBps;
        emit FeeRateUpdated(oldRate, newRateBps, msg.sender);
    }

    /// @notice Re-route the fee split between the two reserves and the treasury.
    /// @dev Settable because the right division between a liquidation backstop and
    /// a first-loss layer depends on the loss distribution the protocol actually
    /// experiences, which is measured rather than known in advance. Bounded so the
    /// measurement cannot be used to justify starving either reserve.
    function setFeeSplit(uint256 insuranceBps, uint256 firstLossBps, uint256 treasuryBps)
        external
    {
        if (!accessControl.hasRole(accessControl.ADMIN_ROLE(), msg.sender)) {
            revert UnauthorizedCaller();
        }
        if (insuranceBps + firstLossBps + treasuryBps != 10000) revert InvalidFeeSplit();
        if (insuranceBps < MIN_INSURANCE_SHARE_BPS) revert InvalidFeeSplit();
        if (treasuryBps > MAX_TREASURY_SHARE_BPS) revert InvalidFeeSplit();

        insuranceShareBps = insuranceBps;
        firstLossShareBps = firstLossBps;
        treasuryShareBps = treasuryBps;
        emit FeeSplitUpdated(insuranceBps, firstLossBps, treasuryBps);
    }

    /// @notice Given a trade amount, returns the fee and its three destinations.
    /// @dev The treasury leg is the remainder rather than a third multiplication,
    /// so rounding dust is never lost.
    function calculateFeeSplit(uint256 tradeAmount)
        external
        view
        returns (
            uint256 feeAmount,
            uint256 insuranceShare,
            uint256 firstLossShare,
            uint256 treasuryShare
        )
    {
        feeAmount = (tradeAmount * tradingFeeBps) / 10000;
        insuranceShare = (feeAmount * insuranceShareBps) / 10000;
        firstLossShare = (feeAmount * firstLossShareBps) / 10000;
        treasuryShare = feeAmount - insuranceShare - firstLossShare;
    }
}
