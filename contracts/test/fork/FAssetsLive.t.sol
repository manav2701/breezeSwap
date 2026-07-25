// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../src/access/BreezeAccessControl.sol";
import "../../src/periphery/FAssetsCollateralAdapter.sol";
import "../../src/core/BreezeMarket.sol";
import "../../src/core/PositionToken.sol";
import "../../src/oracle/MockWeatherOracle.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract FAssetsLiveForkTest is Test {
    BreezeAccessControl public accessControl;
    FAssetsCollateralAdapter public adapter;
    PositionToken public positionToken;
    MockWeatherOracle public oracle;

    // Flare Coston2 FTestXRP Address
    address public constant COSTON2_FTEST_XRP = 0x0b6a8e49F600B4676570c99a38e6a68d5d813DC7;
    address public constant COSTON2_FTSO_REGISTRY = 0x8D5196522Ce25A95A344d9326eC06C9af9A92440;
    bytes21 public fxrpUsdFeedId = bytes21(keccak256("FXRP/USD"));

    bytes32 public regionId = keccak256("TOKYO_RAINFALL");
    uint256 public expiryTimestamp;

    function setUp() public {
        expiryTimestamp = block.timestamp + 7 days;
        accessControl = new BreezeAccessControl(address(this));
        adapter = new FAssetsCollateralAdapter(
            COSTON2_FTEST_XRP,
            COSTON2_FTSO_REGISTRY,
            fxrpUsdFeedId,
            address(accessControl)
        );

        positionToken = new PositionToken("https://breezeswap.io/api/");
        oracle = new MockWeatherOracle(address(accessControl));
    }

    function test_NormalizedCollateralCalculationForFXRP() public view {
        uint256 fxrpAmount = 50 * 1e18; // 50 FXRP
        uint256 usdVal = adapter.normalizedCollateral(fxrpAmount);

        assertTrue(usdVal > 0);
        assertEq(usdVal, 25 * 1e18); // Default $0.50 price yields $25 USD
    }
}
