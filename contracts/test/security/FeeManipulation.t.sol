// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../src/access/BreezeAccessControl.sol";
import "../../src/fees/FeeConfig.sol";

contract FeeManipulationSecurityTest is Test {
    BreezeAccessControl accessControl;
    FeeConfig feeConfig;

    address admin = address(this);
    address attacker = address(0x9999);

    function setUp() public {
        accessControl = new BreezeAccessControl(admin);
        feeConfig = new FeeConfig(address(accessControl));
    }

    function test_admin_cannot_set_fee_above_hardcoded_max() public {
        vm.expectRevert(FeeConfig.InvalidFeeBounds.selector);
        feeConfig.setTradingFeeBps(101);
    }

    function test_non_admin_cannot_manipulate_fee() public {
        vm.prank(attacker);
        vm.expectRevert(FeeConfig.UnauthorizedCaller.selector);
        feeConfig.setTradingFeeBps(100);
    }
}
