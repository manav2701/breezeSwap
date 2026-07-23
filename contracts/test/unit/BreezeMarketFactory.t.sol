// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../src/core/BreezeMarketFactory.sol";
import "../../src/core/PositionToken.sol";
import "../../src/oracle/MockWeatherOracle.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockCollateralToken is ERC20 {
    constructor() ERC20("Mock USD", "USDT0") {
        _mint(msg.sender, 1_000_000 * 1e18);
    }
}

contract BreezeMarketFactoryTest is Test {
    BreezeMarketFactory public factory;
    PositionToken public positionToken;
    MockWeatherOracle public oracle;
    MockCollateralToken public collateral;

    bytes32 public regionId = keccak256("SEOUL_RAINFALL");
    uint256 public expiryTimestamp;

    function setUp() public {
        expiryTimestamp = block.timestamp + 7 days;
        positionToken = new PositionToken("https://breezeswap.io/api/");
        oracle = new MockWeatherOracle();
        collateral = new MockCollateralToken();

        factory = new BreezeMarketFactory(address(positionToken));
        
        // Transfer PositionToken ownership to Factory so it can set minter status
        positionToken.transferOwnership(address(factory));
    }

    function test_CreateMarketSucceedsAndRegisters() public {
        address marketAddr = factory.createMarket(
            regionId,
            BreezeMarket.WeatherVariable.RAINFALL,
            5000,
            15000,
            expiryTimestamp,
            address(oracle),
            address(collateral),
            PayoffCalculator.PayoffType.CAPPED
        );

        assertTrue(marketAddr != address(0));
        assertTrue(factory.isMarket(marketAddr));
        assertEq(factory.getMarketCount(), 1);
        assertEq(factory.allMarkets(0), marketAddr);
        assertTrue(positionToken.isMinter(marketAddr));
    }

    function test_RevertsOnPastExpiry() public {
        vm.expectRevert(BreezeMarketFactory.InvalidParameters.selector);
        factory.createMarket(
            regionId,
            BreezeMarket.WeatherVariable.RAINFALL,
            5000,
            15000,
            block.timestamp - 1,
            address(oracle),
            address(collateral),
            PayoffCalculator.PayoffType.CAPPED
        );
    }

    function test_RevertsOnZeroAddresses() public {
        vm.expectRevert(BreezeMarketFactory.InvalidParameters.selector);
        factory.createMarket(
            regionId,
            BreezeMarket.WeatherVariable.RAINFALL,
            5000,
            15000,
            expiryTimestamp,
            address(0),
            address(collateral),
            PayoffCalculator.PayoffType.CAPPED
        );

        vm.expectRevert(BreezeMarketFactory.InvalidParameters.selector);
        factory.createMarket(
            regionId,
            BreezeMarket.WeatherVariable.RAINFALL,
            5000,
            15000,
            expiryTimestamp,
            address(oracle),
            address(0),
            PayoffCalculator.PayoffType.CAPPED
        );
    }

    function test_RevertsOnInvalidThresholdOrdering() public {
        vm.expectRevert(BreezeMarketFactory.InvalidParameters.selector);
        factory.createMarket(
            regionId,
            BreezeMarket.WeatherVariable.RAINFALL,
            15000, // low > high
            5000,
            expiryTimestamp,
            address(oracle),
            address(collateral),
            PayoffCalculator.PayoffType.CAPPED
        );
    }

    function test_MultipleIndependentMarkets() public {
        address market1 = factory.createMarket(
            regionId,
            BreezeMarket.WeatherVariable.RAINFALL,
            5000,
            15000,
            expiryTimestamp,
            address(oracle),
            address(collateral),
            PayoffCalculator.PayoffType.CAPPED
        );

        address market2 = factory.createMarket(
            keccak256("TOKYO_TEMP"),
            BreezeMarket.WeatherVariable.TEMPERATURE,
            2000,
            4000,
            expiryTimestamp + 1 days,
            address(oracle),
            address(collateral),
            PayoffCalculator.PayoffType.LINEAR
        );

        assertEq(factory.getMarketCount(), 2);
        assertTrue(market1 != market2);
        assertTrue(factory.isMarket(market1));
        assertTrue(factory.isMarket(market2));
    }
}
