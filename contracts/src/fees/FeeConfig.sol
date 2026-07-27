// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../access/BreezeAccessControl.sol";

/// @title FeeConfig
/// @notice Single shared fee-rate registry. Rate is admin-adjustable but
/// hard-capped at MAX_FEE_BPS — this cap is immutable and cannot be
/// raised by any admin action.
contract FeeConfig {
    BreezeAccessControl public immutable accessControl;

    uint256 public constant MAX_FEE_BPS = 100;       // 1.00% hard ceiling, immutable
    uint256 public constant MIN_FEE_BPS = 1;          // 0.01% floor
    uint256 public tradingFeeBps = 10;                // 0.10% default, admin-adjustable within bounds
    uint256 public constant INSURANCE_FUND_SHARE_BPS = 8000;  // 80% of collected fees
    uint256 public constant TREASURY_SHARE_BPS = 2000;        // 20% of collected fees

    event FeeRateUpdated(uint256 oldRateBps, uint256 newRateBps, address indexed updatedBy);

    error UnauthorizedCaller();
    error InvalidFeeBounds();

    constructor(address _accessControl) {
        require(_accessControl != address(0), "zero address");
        accessControl = BreezeAccessControl(_accessControl);
        require(INSURANCE_FUND_SHARE_BPS + TREASURY_SHARE_BPS == 10000, "shares must sum to 100%");
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

    /// @notice Given a trade amount, returns (feeAmount, insuranceShare, treasuryShare)
    function calculateFeeSplit(uint256 tradeAmount)
        external
        view
        returns (uint256 feeAmount, uint256 insuranceShare, uint256 treasuryShare)
    {
        feeAmount = (tradeAmount * tradingFeeBps) / 10000;
        insuranceShare = (feeAmount * INSURANCE_FUND_SHARE_BPS) / 10000;
        treasuryShare = feeAmount - insuranceShare;  // remainder, avoids rounding dust being lost
    }
}
