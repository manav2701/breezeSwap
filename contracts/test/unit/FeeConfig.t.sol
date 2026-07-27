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
            (uint256 feeAmount, uint256 insuranceShare, uint256 treasuryShare) = feeConfig.calculateFeeSplit(testAmounts[i]);
            assertEq(insuranceShare + treasuryShare, feeAmount);
        }
    }

    function test_fee_split_at_extreme_amounts() public view {
        // Very small amount (fee rounds to 0)
        (uint256 feeSmall, uint256 insSmall, uint256 treSmall) = feeConfig.calculateFeeSplit(1);
        assertEq(feeSmall, 0);
        assertEq(insSmall, 0);
        assertEq(treSmall, 0);

        // Very large amount (no overflow)
        uint256 largeAmount = 1_000_000_000 * 1e18;
        (uint256 feeLarge, uint256 insLarge, uint256 treLarge) = feeConfig.calculateFeeSplit(largeAmount);
        assertEq(feeLarge, (largeAmount * 10) / 10000);
        assertEq(insLarge + treLarge, feeLarge);
    }
}
