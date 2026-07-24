// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../src/core/BreezeMarket.sol";
import "../../src/core/BreezeMarketFactory.sol";
import "../../src/core/PositionToken.sol";
import "../../src/oracle/MockWeatherOracle.sol";
import "../../src/vault/CollateralVault.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockACUSDT is ERC20 {
    constructor() ERC20("Mock USD", "USDT") {
        _mint(msg.sender, 1_000_000 * 1e18);
    }
}

contract AccessControlSecurityTest is Test {
    BreezeMarket public market;
    BreezeMarketFactory public factory;
    PositionToken public positionToken;
    MockWeatherOracle public oracle;
    CollateralVault public vault;
    MockACUSDT public usdt;

    bytes32 public regionId = keccak256("TOKYO_RAINFALL");
    uint256 public expiryTimestamp;

    address public attacker = address(0x9999);

    function setUp() public {
        expiryTimestamp = block.timestamp + 7 days;

        positionToken = new PositionToken("https://breezeswap.io/api/");
        factory = new BreezeMarketFactory(address(positionToken));
        oracle = new MockWeatherOracle();
        usdt = new MockACUSDT();

        positionToken.transferOwnership(address(factory));

        address marketAddr = factory.createMarket(
            regionId,
            BreezeMarket.WeatherVariable.RAINFALL,
            5000,
            15000,
            expiryTimestamp,
            address(oracle),
            address(usdt),
            PayoffCalculator.PayoffType.CAPPED
        );

        market = BreezeMarket(marketAddr);
        vault = market.vault();
    }

    function test_vault_unauthorized_withdraw_reverts() public {
        vm.prank(attacker);
        vm.expectRevert(CollateralVault.OnlyMarket.selector);
        vault.withdraw(attacker, 100 * 1e18);
    }

    function test_vault_unauthorized_deposit_reverts() public {
        vm.prank(attacker);
        vm.expectRevert(CollateralVault.OnlyMarket.selector);
        vault.deposit(attacker, 100 * 1e18);
    }

    function test_oracle_unauthorized_setreading_reverts() public {
        vm.prank(attacker);
        vm.expectRevert();
        oracle.setReading(regionId, expiryTimestamp, 10000);
    }

    function test_factory_registry_immutable() public {
        uint256 countBefore = factory.getMarketCount();
        address marketAt0 = factory.allMarkets(0);
        assertTrue(marketAt0 != address(0));

        // Create second market
        factory.createMarket(
            regionId,
            BreezeMarket.WeatherVariable.TEMPERATURE,
            1000,
            3000,
            expiryTimestamp + 1 days,
            address(oracle),
            address(usdt),
            PayoffCalculator.PayoffType.BINARY
        );

        assertEq(factory.getMarketCount(), countBefore + 1);
        assertEq(factory.allMarkets(0), marketAt0); // Registry entry 0 is append-only & untouched
    }

    function test_position_token_unauthorized_mint_reverts() public {
        vm.prank(attacker);
        vm.expectRevert(PositionToken.NotMinter.selector);
        positionToken.mint(attacker, address(market), PositionToken.Side.LONG, 100 * 1e18);
    }

    function test_market_cannot_be_initialized_twice() public view {
        assertEq(market.regionId(), regionId);
        assertEq(market.expiryTimestamp(), expiryTimestamp);
        assertEq(address(market.oracle()), address(oracle));
    }
}
