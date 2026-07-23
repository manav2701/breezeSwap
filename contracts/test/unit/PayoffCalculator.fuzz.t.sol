// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../src/settlement/PayoffCalculator.sol";

contract PayoffCalculatorFuzzTest is Test {
    function testFuzz_ZeroSumInvariant(
        uint8 payoffTypeInt,
        int256 oracleValue,
        int256 thresholdLow,
        int256 thresholdHigh,
        uint256 notional
    ) public pure {
        PayoffCalculator.PayoffType pType = PayoffCalculator.PayoffType(payoffTypeInt % 3);

        // Bound notional to a realistic financial range (up to 1e24, e.g. 1 million Tokens with 18 decimals)
        notional = bound(notional, 0, 1e24);

        if (pType != PayoffCalculator.PayoffType.BINARY) {
            // Ensure valid threshold ordering and bound values to realistic ranges
            vm.assume(thresholdLow > -1e12 && thresholdLow < 1e12);
            vm.assume(thresholdHigh > thresholdLow && thresholdHigh < 2e12);
            vm.assume(oracleValue > -2e12 && oracleValue < 3e12);
        }

        (uint256 longP, uint256 shortP) = PayoffCalculator.calculatePayout(
            pType,
            oracleValue,
            thresholdLow,
            thresholdHigh,
            notional
        );

        // Core Invariant 1: Sum of payouts equals total notional
        assertEq(longP + shortP, notional);

        // Core Invariant 2: Individual payouts never exceed total notional
        assertTrue(longP <= notional);
        assertTrue(shortP <= notional);
    }
}
