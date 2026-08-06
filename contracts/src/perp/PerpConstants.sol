// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title PerpConstants
/// @notice Central library for vAMM perpetual market constants and safety caps.
library PerpConstants {
    uint256 public constant PRECISION = 1e18;
    uint256 public constant MAX_LEVERAGE = 3;               // 3x cap, per strategic plan
    uint256 public constant MAINTENANCE_MARGIN_BPS = 1000;  // 10% maintenance margin
    uint256 public constant LIQUIDATION_REWARD_BPS = 200;    // 2% liquidation reward
    // -----------------------------------------------------------------
    // Funding parameters — two presets, and the distinction matters
    // -----------------------------------------------------------------
    //
    // `FUNDING_INTERVAL` and `MAX_FUNDING_RATE_PER_PERIOD` are the DEMO preset:
    // 5% per 15 minutes is roughly 480% annualised and indefensible for real
    // capital. They exist because funding has to visibly move during a short
    // walkthrough. While the oracle-scale defect was live this was also the only
    // rate any market ever charged, which is how an absurd figure went unnoticed.
    //
    // Markets now carry their own `fundingInterval` and `maxFundingRateBps`,
    // defaulting to the PRODUCTION values below. The demo preset must be applied
    // explicitly, so shipping it by accident is no longer possible.

    /// @notice Demo preset — short interval so funding moves within a walkthrough.
    uint256 public constant FUNDING_INTERVAL = 15 minutes;
    /// @notice Demo preset — 5% per interval. Not suitable for production.
    uint256 public constant MAX_FUNDING_RATE_PER_PERIOD = 500;

    /// @notice Production default: 8-hour funding, the convention at established
    /// perpetual venues, and long enough that the rate reflects a sustained
    /// mark/index gap rather than a momentary one.
    uint256 public constant PRODUCTION_FUNDING_INTERVAL = 8 hours;

    /// @notice Production default: 0.75% per 8-hour interval (~0.09%/hour at the
    /// cap). This is a CAP, not a typical rate — ordinary conditions produce far
    /// less, since the rate tracks the actual deviation and only clamps at the
    /// extreme.
    uint256 public constant PRODUCTION_MAX_FUNDING_RATE_BPS = 75;

    /// @notice Bounds on per-market funding configuration.
    /// @dev The rate ceiling is the demo value, so the demo preset stays reachable
    /// and nothing more aggressive than it can ever be configured.
    uint256 public constant MIN_FUNDING_INTERVAL = 15 minutes;
    uint256 public constant MAX_FUNDING_INTERVAL = 1 days;
    uint256 public constant MAX_FUNDING_RATE_CEILING_BPS = 500;

    /// @notice Default open-interest skew ceiling, as a fraction of the market's
    /// initial virtual collateral reserve.
    ///
    /// Funding only transfers cleanly between longs and shorts where the two
    /// sides are matched. Unmatched open interest has no trader counterparty —
    /// it faces the protocol's own capital. Capping the skew bounds that
    /// exposure instead of letting a one-sided market grow without limit, which
    /// matters for weather in particular: hedging demand is structurally
    /// one-directional, so the imbalance does not mean-revert on its own.
    uint256 public constant DEFAULT_MAX_SKEW_BPS_OF_RESERVE = 2500; // 25%
}
