// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../src/periphery/FAssetsCollateralAdapter.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockFTestXRP is ERC20 {
    constructor() ERC20("Flare Test XRP", "FTestXRP") {
        _mint(msg.sender, 1_000_000 * 1e18);
    }
}

contract FAssetsAdapterTest is Test {
    FAssetsCollateralAdapter public adapter;
    MockFTestXRP public fxrp;

    bytes21 public fxrpFeedId = bytes21(keccak256("FXRP/USD"));

    function setUp() public {
        fxrp = new MockFTestXRP();
        adapter = new FAssetsCollateralAdapter(
            address(fxrp),
            address(0x1111), // FtsoRegistry
            fxrpFeedId
        );
    }

    function test_DefaultFxrpPriceNormalization() public view {
        // Default price is $0.50 per FXRP (0.5e18)
        uint256 fxrpAmount = 100 * 1e18; // 100 FXRP
        uint256 usdValue = adapter.usdValueOf(fxrpAmount);

        // 100 FXRP * $0.50 = $50 USD (50e18)
        assertEq(usdValue, 50 * 1e18);
    }

    function test_SetFallbackPriceUpdatesNormalization() public {
        // Update FXRP price to $0.75 per FXRP
        adapter.setFallbackPrice(750_000_000_000_000_000);

        uint256 fxrpAmount = 100 * 1e18;
        uint256 usdValue = adapter.normalizedCollateral(fxrpAmount);

        // 100 FXRP * $0.75 = $75 USD
        assertEq(usdValue, 75 * 1e18);
    }
}
