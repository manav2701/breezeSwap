// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title PerpConstants
/// @notice Central library for vAMM perpetual market constants and safety caps.
library PerpConstants {
    uint256 public constant PRECISION = 1e18;
    uint256 public constant MAX_LEVERAGE = 3;               // 3x cap, per strategic plan
    uint256 public constant MAINTENANCE_MARGIN_BPS = 1000;  // 10% maintenance margin
    uint256 public constant LIQUIDATION_REWARD_BPS = 200;    // 2% liquidation reward
    uint256 public constant FUNDING_INTERVAL = 15 minutes;   // Demo-friendly funding period
    int256 public constant MAX_FUNDING_RATE_PER_PERIOD = 500; // 5% cap (in bps) per interval
}
