// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./PerpConstants.sol";

/// @title FundingRateEngine
/// @notice Pure calculation library for perpetual market funding rates.
library FundingRateEngine {
    /// @notice Returns funding rate in basis points per interval.
    /// Positive rate means longs pay shorts (mark price > oracle price).
    /// Negative rate means shorts pay longs (mark price < oracle price).
    ///
    /// @param capBps Maximum absolute rate, supplied by the caller.
    ///
    /// @dev The cap is a parameter rather than a library constant because it is an
    /// economic choice, not a law of the mechanism, and different markets
    /// legitimately want different values. Hardcoding it also meant the single
    /// demo-oriented figure (500 bps per 15 minutes, ~480% annualised) was the only
    /// value any market could ever use.
    function calculateFundingRate(uint256 markPrice, uint256 oraclePrice, uint256 capBps)
        internal
        pure
        returns (int256)
    {
        if (oraclePrice == 0) return 0;
        int256 deviationBps = ((int256(markPrice) - int256(oraclePrice)) * 10000) / int256(oraclePrice);
        return _clamp(deviationBps, -int256(capBps), int256(capBps));
    }

    function _clamp(int256 value, int256 min, int256 max) private pure returns (int256) {
        if (value < min) return min;
        if (value > max) return max;
        return value;
    }
}
