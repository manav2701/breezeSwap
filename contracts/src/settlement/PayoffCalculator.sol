// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title PayoffCalculator
 * @notice Pure library for calculating parametric settlement payouts for BreezeSwap weather markets.
 * Ensures zero-sum invariant: longPayout + shortPayout == notional.
 */
library PayoffCalculator {
    enum PayoffType { BINARY, LINEAR, CAPPED }

    error InvalidThresholds();

    /**
     * @notice Computes long and short payout amounts for a given oracle reading and payoff type.
     * @param payoffType BINARY, LINEAR, or CAPPED
     * @param oracleValue Final resolved oracle reading
     * @param thresholdLow Lower threshold boundary
     * @param thresholdHigh Upper threshold boundary (used for LINEAR and CAPPED)
     * @param notional Total collateral backing the position pair
     * @return longPayout Amount owed per notional to Long side
     * @return shortPayout Amount owed per notional to Short side
     */
    function calculatePayout(
        PayoffType payoffType,
        int256 oracleValue,
        int256 thresholdLow,
        int256 thresholdHigh,
        uint256 notional
    ) internal pure returns (uint256 longPayout, uint256 shortPayout) {
        if (notional == 0) {
            return (0, 0);
        }

        if (payoffType == PayoffType.BINARY) {
            if (oracleValue >= thresholdLow) {
                longPayout = notional;
                shortPayout = 0;
            } else {
                longPayout = 0;
                shortPayout = notional;
            }
        } else if (payoffType == PayoffType.CAPPED || payoffType == PayoffType.LINEAR) {
            if (thresholdHigh <= thresholdLow) revert InvalidThresholds();

            if (oracleValue <= thresholdLow) {
                longPayout = 0;
                shortPayout = notional;
            } else if (oracleValue >= thresholdHigh) {
                longPayout = notional;
                shortPayout = 0;
            } else {
                // Here: thresholdLow < oracleValue < thresholdHigh
                // Both (oracleValue - thresholdLow) and (thresholdHigh - thresholdLow) are strictly positive > 0
                uint256 deltaValue = uint256(oracleValue - thresholdLow);
                uint256 range = uint256(thresholdHigh - thresholdLow);
                
                // Calculate long payout with floor rounding
                longPayout = (deltaValue * notional) / range;
                if (longPayout > notional) {
                    longPayout = notional;
                }
                
                // Short receives exact remaining notional to guarantee zero-sum
                shortPayout = notional - longPayout;
            }
        }

        return (longPayout, shortPayout);
    }
}
