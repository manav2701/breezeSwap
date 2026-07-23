// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../src/settlement/PayoffCalculator.sol";

contract PayoffCalculatorTest is Test {
    using PayoffCalculator for PayoffCalculator.PayoffType;

    uint256 public constant NOTIONAL = 1000 * 1e18;
    int256 public constant LOW = 5000;   // e.g., 50.00 mm
    int256 public constant HIGH = 15000; // e.g., 150.00 mm

    function test_BinaryBelowThreshold() public pure {
        (uint256 longP, uint256 shortP) = PayoffCalculator.calculatePayout(
            PayoffCalculator.PayoffType.BINARY,
            4999,
            LOW,
            HIGH,
            NOTIONAL
        );
        assertEq(longP, 0);
        assertEq(shortP, NOTIONAL);
        assertEq(longP + shortP, NOTIONAL);
    }

    function test_BinaryAtAndAboveThreshold() public pure {
        (uint256 longP1, uint256 shortP1) = PayoffCalculator.calculatePayout(
            PayoffCalculator.PayoffType.BINARY,
            LOW,
            LOW,
            HIGH,
            NOTIONAL
        );
        assertEq(longP1, NOTIONAL);
        assertEq(shortP1, 0);
        assertEq(longP1 + shortP1, NOTIONAL);

        (uint256 longP2, uint256 shortP2) = PayoffCalculator.calculatePayout(
            PayoffCalculator.PayoffType.BINARY,
            20000,
            LOW,
            HIGH,
            NOTIONAL
        );
        assertEq(longP2, NOTIONAL);
        assertEq(shortP2, 0);
        assertEq(longP2 + shortP2, NOTIONAL);
    }

    function test_CappedBelowRange() public pure {
        (uint256 longP, uint256 shortP) = PayoffCalculator.calculatePayout(
            PayoffCalculator.PayoffType.CAPPED,
            4000,
            LOW,
            HIGH,
            NOTIONAL
        );
        assertEq(longP, 0);
        assertEq(shortP, NOTIONAL);
        assertEq(longP + shortP, NOTIONAL);
    }

    function test_CappedExactlyAtThresholdLow() public pure {
        (uint256 longP, uint256 shortP) = PayoffCalculator.calculatePayout(
            PayoffCalculator.PayoffType.CAPPED,
            LOW,
            LOW,
            HIGH,
            NOTIONAL
        );
        assertEq(longP, 0);
        assertEq(shortP, NOTIONAL);
        assertEq(longP + shortP, NOTIONAL);
    }

    function test_CappedMidRange50Percent() public pure {
        int256 mid = LOW + (HIGH - LOW) / 2; // 10000
        (uint256 longP, uint256 shortP) = PayoffCalculator.calculatePayout(
            PayoffCalculator.PayoffType.CAPPED,
            mid,
            LOW,
            HIGH,
            NOTIONAL
        );
        assertEq(longP, NOTIONAL / 2);
        assertEq(shortP, NOTIONAL / 2);
        assertEq(longP + shortP, NOTIONAL);
    }

    function test_CappedExactlyAtThresholdHigh() public pure {
        (uint256 longP, uint256 shortP) = PayoffCalculator.calculatePayout(
            PayoffCalculator.PayoffType.CAPPED,
            HIGH,
            LOW,
            HIGH,
            NOTIONAL
        );
        assertEq(longP, NOTIONAL);
        assertEq(shortP, 0);
        assertEq(longP + shortP, NOTIONAL);
    }

    function test_CappedAboveRange() public pure {
        (uint256 longP, uint256 shortP) = PayoffCalculator.calculatePayout(
            PayoffCalculator.PayoffType.CAPPED,
            25000,
            LOW,
            HIGH,
            NOTIONAL
        );
        assertEq(longP, NOTIONAL);
        assertEq(shortP, 0);
        assertEq(longP + shortP, NOTIONAL);
    }
}
