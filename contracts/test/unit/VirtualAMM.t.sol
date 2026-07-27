// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../src/perp/VirtualAMM.sol";

contract VirtualAMMTest is Test {
    using VirtualAMM for VirtualAMM.Reserves;

    VirtualAMM.Reserves initialReserves;

    function setUp() public {
        // Initial reserves: 1,000,000 USD (collateral) and 40,000 Weather units
        // Initial mark price = 1,000,000 * 1e18 / 40,000 = 25 * 1e18 (e.g. 25.0 °C / mm)
        initialReserves = VirtualAMM.Reserves({
            collateralReserve: 1_000_000 * 1e18,
            weatherReserve: 40_000 * 1e18
        });
    }

    function test_open_long_increases_mark_price() public {
        uint256 startPrice = initialReserves.markPrice();

        (uint256 exposureOut, VirtualAMM.Reserves memory newReserves) = initialReserves.quoteOpenLong(10_000 * 1e18);

        assertTrue(exposureOut > 0);
        assertTrue(newReserves.markPrice() > startPrice);
        assertEq(newReserves.collateralReserve, initialReserves.collateralReserve + 10_000 * 1e18);
    }

    function test_open_short_decreases_mark_price() public {
        uint256 startPrice = initialReserves.markPrice();

        (uint256 exposureOut, VirtualAMM.Reserves memory newReserves) = initialReserves.quoteOpenShort(10_000 * 1e18);

        assertTrue(exposureOut > 0);
        assertTrue(newReserves.markPrice() < startPrice);
        assertEq(newReserves.collateralReserve, initialReserves.collateralReserve - 10_000 * 1e18);
    }

    function test_close_long_is_exact_inverse_of_open() public {
        uint256 tradeSize = 50_000 * 1e18;

        (uint256 exposureOut, VirtualAMM.Reserves memory reservesAfterOpen) = initialReserves.quoteOpenLong(tradeSize);
        (uint256 collateralOut, VirtualAMM.Reserves memory reservesAfterClose) = reservesAfterOpen.quoteCloseLong(exposureOut);

        // Collateral returned should equal original tradeSize (within small rounding error)
        assertApproxEqAbs(collateralOut, tradeSize, 100);
        assertApproxEqAbs(reservesAfterClose.collateralReserve, initialReserves.collateralReserve, 100);
        assertApproxEqAbs(reservesAfterClose.weatherReserve, initialReserves.weatherReserve, 100);
    }

    function test_close_short_is_exact_inverse_of_open() public {
        uint256 tradeSize = 50_000 * 1e18;

        (uint256 exposureOut, VirtualAMM.Reserves memory reservesAfterOpen) = initialReserves.quoteOpenShort(tradeSize);
        (uint256 collateralOut, VirtualAMM.Reserves memory reservesAfterClose) = reservesAfterOpen.quoteCloseShort(exposureOut);

        assertApproxEqAbs(collateralOut, tradeSize, 100);
        assertApproxEqAbs(reservesAfterClose.collateralReserve, initialReserves.collateralReserve, 100);
        assertApproxEqAbs(reservesAfterClose.weatherReserve, initialReserves.weatherReserve, 100);
    }

    function test_k_invariant_holds_after_operations() public {
        uint256 kInitial = initialReserves.k();

        (, VirtualAMM.Reserves memory r1) = initialReserves.quoteOpenLong(20_000 * 1e18);
        assertApproxEqRel(r1.k(), kInitial, 1e14); // 0.01% rel tolerance for integer division

        (, VirtualAMM.Reserves memory r2) = r1.quoteOpenShort(15_000 * 1e18);
        assertApproxEqRel(r2.k(), kInitial, 1e14);
    }
}
