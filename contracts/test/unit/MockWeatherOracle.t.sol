// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../src/oracle/MockWeatherOracle.sol";

contract MockWeatherOracleTest is Test {
    MockWeatherOracle public oracle;
    bytes32 public regionId = keccak256("SEOUL_RAINFALL");
    address public alice = address(0x2222);

    function setUp() public {
        oracle = new MockWeatherOracle();
    }

    function test_SetAndGetReading() public {
        uint256 timestamp = block.timestamp;
        int256 expectedValue = 8550; // 85.50 mm rainfall (*100)

        oracle.setReading(regionId, timestamp, expectedValue);

        IWeatherOracle.Reading memory reading = oracle.getReading(regionId, timestamp);
        assertTrue(reading.isValid);
        assertEq(reading.value, expectedValue);
        assertEq(reading.timestamp, timestamp);
    }

    function test_GetReadingUnpopulatedReturnsInvalid() public view {
        bytes32 unknownRegion = keccak256("UNKNOWN");
        IWeatherOracle.Reading memory reading = oracle.getReading(unknownRegion, block.timestamp);
        assertFalse(reading.isValid);
        assertEq(reading.value, 0);
        assertEq(reading.timestamp, 0);
    }

    function test_StalenessBoundaryConditions() public {
        uint256 setTime = 1000;
        uint256 maxAge = 300; // 5 minutes max age

        oracle.setReading(regionId, setTime, 5000);

        // 1. Exactly at boundary: block.timestamp = setTime + maxAge (1300) -> not stale (1300 - 1000 = 300 <= 300)
        vm.warp(setTime + maxAge);
        assertFalse(oracle.isStale(regionId, maxAge));

        // 2. One second under boundary: block.timestamp = 1299 -> not stale (1299 - 1000 = 299 <= 300)
        vm.warp(setTime + maxAge - 1);
        assertFalse(oracle.isStale(regionId, maxAge));

        // 3. One second over boundary: block.timestamp = 1301 -> stale (1301 - 1000 = 301 > 300)
        vm.warp(setTime + maxAge + 1);
        assertTrue(oracle.isStale(regionId, maxAge));
    }

    function test_UnauthorizedCannotSetReading() public {
        vm.prank(alice);
        vm.expectRevert();
        oracle.setReading(regionId, block.timestamp, 100);
    }
}
