// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../src/access/BreezeAccessControl.sol";
import "../../src/fees/FeeConfig.sol";

contract FeeConfigUnitTest is Test {
    BreezeAccessControl accessControl;
    FeeConfig feeConfig;

    address admin = address(this);
    address alice = address(0x1111);

    function setUp() public {
        accessControl = new BreezeAccessControl(admin);
        feeConfig = new FeeConfig(address(accessControl));
    }

    function test_default_trading_fee_is_10_bps() public view {
        assertEq(feeConfig.tradingFeeBps(), 10);
    }

    function test_admin_can_set_valid_fee_rate() public {
        feeConfig.setTradingFeeBps(50);
        assertEq(feeConfig.tradingFeeBps(), 50);
    }

    function test_fee_rate_cannot_exceed_max() public {
        vm.expectRevert(FeeConfig.InvalidFeeBounds.selector);
        feeConfig.setTradingFeeBps(101); // MAX is 100
    }

    function test_fee_rate_cannot_go_below_min() public {
        vm.expectRevert(FeeConfig.InvalidFeeBounds.selector);
        feeConfig.setTradingFeeBps(0); // MIN is 1
    }

    function test_only_admin_can_set_rate() public {
        vm.prank(alice);
        vm.expectRevert(FeeConfig.UnauthorizedCaller.selector);
        feeConfig.setTradingFeeBps(20);
    }

    function test_fee_split_sums_correctly() public view {
        uint256[] memory testAmounts = new uint256[](5);
        testAmounts[0] = 1_000 * 1e18;
        testAmounts[1] = 9_999 * 1e18;
        testAmounts[2] = 123_456 * 1e6;
        testAmounts[3] = 777 * 1e18;
        testAmounts[4] = 10_000_000 * 1e18;

        for (uint256 i = 0; i < testAmounts.length; i++) {
            (uint256 feeAmount, uint256 ins, uint256 firstLoss, uint256 tre) =
                feeConfig.calculateFeeSplit(testAmounts[i]);
            assertEq(ins + firstLoss + tre, feeAmount, "three legs must sum to the fee exactly");
        }
    }

    function test_fee_split_at_extreme_amounts() public view {
        // Very small amount (fee rounds to 0)
        (uint256 feeSmall, uint256 insSmall, uint256 flSmall, uint256 treSmall) =
            feeConfig.calculateFeeSplit(1);
        assertEq(feeSmall, 0);
        assertEq(insSmall, 0);
        assertEq(flSmall, 0);
        assertEq(treSmall, 0);

        // Very large amount (no overflow)
        uint256 largeAmount = 1_000_000_000 * 1e18;
        (uint256 feeLarge, uint256 insLarge, uint256 flLarge, uint256 treLarge) =
            feeConfig.calculateFeeSplit(largeAmount);
        assertEq(feeLarge, (largeAmount * 10) / 10000);
        assertEq(insLarge + flLarge + treLarge, feeLarge);
    }

    // =================================================================
    // Three-way split: the first-loss leg
    // =================================================================

    /// The default has to actually fund tier 1, or the reserve is a contract that
    /// never fills and the shared-pot defect is unfixed in practice.
    function test_default_split_funds_all_three_destinations() public view {
        assertEq(feeConfig.insuranceShareBps(), 5000);
        assertEq(feeConfig.firstLossShareBps(), 3000);
        assertEq(feeConfig.treasuryShareBps(), 2000);

        (, uint256 ins, uint256 firstLoss, uint256 tre) = feeConfig.calculateFeeSplit(100_000e18);
        assertGt(ins, 0);
        assertGt(firstLoss, 0, "first-loss leg is zero by default - tier 1 never fills");
        assertGt(tre, 0);
    }

    function test_admin_can_rebalance_the_split() public {
        feeConfig.setFeeSplit(4000, 4000, 2000);
        assertEq(feeConfig.insuranceShareBps(), 4000);
        assertEq(feeConfig.firstLossShareBps(), 4000);

        (uint256 fee, uint256 ins, uint256 firstLoss,) = feeConfig.calculateFeeSplit(100_000e18);
        assertEq(ins, (fee * 4000) / 10000);
        assertEq(firstLoss, (fee * 4000) / 10000);
    }

    function test_split_must_sum_to_one_hundred_percent() public {
        vm.expectRevert(FeeConfig.InvalidFeeSplit.selector);
        feeConfig.setFeeSplit(5000, 3000, 1000); // 90%
    }

    /// The floor is the thing that stops governance recreating the priority
    /// inversion from the opposite direction — routing everything to tier 1 would
    /// starve liquidation of the capital it needs to clear bad debt.
    function test_liquidation_backstop_share_cannot_be_starved() public {
        vm.expectRevert(FeeConfig.InvalidFeeSplit.selector);
        feeConfig.setFeeSplit(0, 8000, 2000);

        vm.expectRevert(FeeConfig.InvalidFeeSplit.selector);
        feeConfig.setFeeSplit(2999, 5001, 2000);

        // Exactly at the floor is permitted.
        feeConfig.setFeeSplit(feeConfig.MIN_INSURANCE_SHARE_BPS(), 5000, 2000);
        assertEq(feeConfig.insuranceShareBps(), 3000);
    }

    /// Fees must not be redirected out of risk capital and into revenue.
    function test_treasury_share_is_capped() public {
        vm.expectRevert(FeeConfig.InvalidFeeSplit.selector);
        feeConfig.setFeeSplit(3000, 2000, 5000);
    }

    function test_only_admin_can_set_split() public {
        vm.prank(alice);
        vm.expectRevert(FeeConfig.UnauthorizedCaller.selector);
        feeConfig.setFeeSplit(4000, 4000, 2000);
    }
}
