// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../src/perp/VirtualAMM.sol";

contract VirtualAMMFuzzTest is Test {
    using VirtualAMM for VirtualAMM.Reserves;

    function testFuzz_KInvariantPreserved(uint256 collateralIn, bool isLong) public {
        // Bound collateralIn to reasonable bounds relative to virtual reserve (1k to 100k USD)
        collateralIn = bound(collateralIn, 100 * 1e18, 100_000 * 1e18);

        VirtualAMM.Reserves memory initial = VirtualAMM.Reserves({
            collateralReserve: 1_000_000 * 1e18,
            weatherReserve: 40_000 * 1e18
        });

        uint256 initialK = initial.k();

        if (isLong) {
            (uint256 exp, VirtualAMM.Reserves memory next) = initial.quoteOpenLong(collateralIn);
            assertTrue(exp > 0);
            assertApproxEqRel(next.k(), initialK, 1e12);

            (uint256 returned, VirtualAMM.Reserves memory restored) = next.quoteCloseLong(exp);
            assertApproxEqAbs(returned, collateralIn, 1000);
            assertApproxEqRel(restored.k(), initialK, 1e12);
        } else {
            (uint256 exp, VirtualAMM.Reserves memory next) = initial.quoteOpenShort(collateralIn);
            assertTrue(exp > 0);
            assertApproxEqRel(next.k(), initialK, 1e12);

            (uint256 returned, VirtualAMM.Reserves memory restored) = next.quoteCloseShort(exp);
            assertApproxEqAbs(returned, collateralIn, 1000);
            assertApproxEqRel(restored.k(), initialK, 1e12);
        }
    }
}
