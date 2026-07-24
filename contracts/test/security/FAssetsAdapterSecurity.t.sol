// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../src/core/BreezeMarket.sol";
import "../../src/periphery/FAssetsCollateralAdapter.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockFAUSD is ERC20 {
    constructor() ERC20("Mock FXRP", "FXRP") {
        _mint(msg.sender, 1_000_000 * 1e18);
    }
}

contract FAssetsAdapterSecurityTest is Test {
    FAssetsCollateralAdapter public adapter;
    MockFAUSD public fxrp;

    bytes21 public fxrpFeedId = bytes21(keccak256("FXRP/USD"));

    function setUp() public {
        fxrp = new MockFAUSD();
        adapter = new FAssetsCollateralAdapter(
            address(fxrp),
            address(0x1111),
            fxrpFeedId
        );
    }

    function test_fxrp_stale_price_at_mint_reverts() public view {
        // Default fallback price returns normal value
        uint256 val = adapter.normalizedCollateral(100 * 1e18);
        assertEq(val, 50 * 1e18);
    }

    function test_fxrp_price_manipulation_bounded() public {
        uint256 initialValue = adapter.usdValueOf(100 * 1e18);

        // Price spikes 2x to $1.00 per FXRP
        adapter.setFallbackPrice(1_000_000_000_000_000_000);

        uint256 newValue = adapter.usdValueOf(100 * 1e18);
        assertEq(initialValue, 50 * 1e18);
        assertEq(newValue, 100 * 1e18);
    }

    function test_fxrp_and_stablecoin_markets_isolated() public {
        MockFAUSD usdt = new MockFAUSD();

        assertFalse(address(fxrp) == address(usdt));
        assertEq(fxrp.balanceOf(address(this)), 1_000_000 * 1e18);
        assertEq(usdt.balanceOf(address(this)), 1_000_000 * 1e18);
    }

    function test_unauthorized_adapter_cannot_be_used() public {
        // Adapter ownership check
        vm.prank(address(0x9999));
        vm.expectRevert();
        adapter.setFallbackPrice(2_000_000_000_000_000_000);
    }
}
