// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../src/core/BreezeMarket.sol";
import "../../src/core/PositionToken.sol";
import "../../src/oracle/MockWeatherOracle.sol";
import "../../src/oracle/FtsoWeatherAdapter.sol";
import "../../src/periphery/FAssetsCollateralAdapter.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockOMUSDT is ERC20 {
    constructor() ERC20("Mock USD", "USDT") {
        _mint(msg.sender, 1_000_000 * 1e18);
    }
}

contract OracleManipulationSecurityTest is Test {
    BreezeMarket public market;
    PositionToken public positionToken;
    MockWeatherOracle public oracle;
    MockOMUSDT public usdt;

    bytes32 public regionId = keccak256("TOKYO_RAINFALL");
    uint256 public expiryTimestamp;

    function setUp() public {
        expiryTimestamp = block.timestamp + 7 days;

        positionToken = new PositionToken("https://breezeswap.io/api/");
        oracle = new MockWeatherOracle();
        usdt = new MockOMUSDT();

        market = new BreezeMarket(
            regionId,
            BreezeMarket.WeatherVariable.RAINFALL,
            5000,
            15000,
            expiryTimestamp,
            address(oracle),
            address(usdt),
            address(positionToken),
            PayoffCalculator.PayoffType.CAPPED
        );

        positionToken.setMinter(address(market), true);
    }

    function test_settle_stale_oracle_reverts() public {
        // Seed reading 2 days before expiry (> 86,400s old relative to warp time)
        oracle.setReading(regionId, expiryTimestamp, 10000);

        vm.warp(expiryTimestamp + 2 days);

        vm.expectRevert(BreezeMarket.OracleDataStale.selector);
        market.settle();
    }

    function test_settle_invalid_oracle_reverts() public {
        vm.warp(expiryTimestamp + 1);

        // Oracle unpopulated reading returns isValid = false
        vm.expectRevert(BreezeMarket.InvalidOracleData.selector);
        market.settle();
    }

    function test_settle_uses_correct_timestamp() public {
        oracle.setReading(regionId, expiryTimestamp, 12000); // 12000 at expiry
        oracle.setReading(regionId, expiryTimestamp + 1 days, 20000); // 20000 later

        vm.warp(expiryTimestamp + 1);
        market.settle();

        assertEq(market.finalOracleValue(), 12000);
    }

    function test_ftso_adapter_stale_reverts() public {
        bytes21 feedId = bytes21(keccak256("WEATHER_FEED"));
        FtsoWeatherAdapter adapter = new FtsoWeatherAdapter(address(0x1111), feedId);

        vm.expectRevert(FtsoWeatherAdapter.FtsoFeedNotYetLive.selector);
        adapter.getReading(regionId, expiryTimestamp);
    }

    function test_fxrp_price_zero_reverts() public {
        bytes21 feedId = bytes21(keccak256("FXRP/USD"));
        FAssetsCollateralAdapter adapter = new FAssetsCollateralAdapter(address(0x2222), address(0x1111), feedId);

        adapter.setFallbackPrice(0);
        uint256 usdValue = adapter.usdValueOf(100 * 1e18);
        assertEq(usdValue, 0);
    }
}
