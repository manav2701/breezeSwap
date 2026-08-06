// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../src/access/BreezeAccessControl.sol";
import "../../src/core/BreezeMarket.sol";
import "../../src/core/PositionToken.sol";
import "../../src/oracle/MockWeatherOracle.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockDSUSDT is ERC20 {
    constructor() ERC20("Mock USD", "USDT") {
        _mint(msg.sender, 1_000_000 * 1e18);
    }
}

contract DoubleSettleSecurityTest is Test {
    BreezeAccessControl public accessControl;
    BreezeMarket public market;
    PositionToken public positionToken;
    MockWeatherOracle public oracle;
    MockDSUSDT public usdt;

    bytes32 public regionId = keccak256("TOKYO_RAINFALL");
    uint256 public expiryTimestamp;

    address public alice = address(0x1111);

    function setUp() public {
        expiryTimestamp = block.timestamp + 7 days;
        accessControl = new BreezeAccessControl(address(this));

        positionToken = new PositionToken("https://breezeswap.io/api/");
        oracle = new MockWeatherOracle(address(accessControl));
        usdt = new MockDSUSDT();

        market = new BreezeMarket(
            regionId,
            BreezeMarket.WeatherVariable.RAINFALL,
            5000,
            15000,
            expiryTimestamp,
            address(oracle),
            address(usdt),
            address(positionToken),
            PayoffCalculator.PayoffType.CAPPED,
            address(accessControl),
            address(0) // no pricing oracle: these tests predate fair-odds pricing
        );

        positionToken.setMinter(address(market), true);
        usdt.transfer(alice, 1000 * 1e18);

        vm.startPrank(alice);
        usdt.approve(address(market.vault()), type(uint256).max);
        vm.stopPrank();
    }

    function test_settle_twice_reverts() public {
        vm.prank(alice);
        market.mintPosition(PositionToken.Side.LONG, 500 * 1e18);

        vm.warp(expiryTimestamp + 1);
        oracle.setReading(regionId, expiryTimestamp, 10000);

        market.settle();
        assertTrue(market.status() == BreezeMarket.Status.SETTLED);

        // Second settle attempt must revert
        vm.expectRevert(BreezeMarket.MarketAlreadySettled.selector);
        market.settle();
    }

    function test_settle_state_unchanged_on_revert() public {
        vm.prank(alice);
        market.mintPosition(PositionToken.Side.LONG, 500 * 1e18);

        vm.warp(expiryTimestamp + 1);
        oracle.setReading(regionId, expiryTimestamp, 10000);

        market.settle();

        uint256 initialLongPayout = market.longPayoutPerToken();
        uint256 initialShortPayout = market.shortPayoutPerToken();
        int256 initialOracleVal = market.finalOracleValue();

        vm.expectRevert(BreezeMarket.MarketAlreadySettled.selector);
        market.settle();

        assertEq(uint8(market.status()), uint8(BreezeMarket.Status.SETTLED));
        assertEq(market.longPayoutPerToken(), initialLongPayout);
        assertEq(market.shortPayoutPerToken(), initialShortPayout);
        assertEq(market.finalOracleValue(), initialOracleVal);
    }

    function test_settle_then_mint_reverts() public {
        vm.prank(alice);
        market.mintPosition(PositionToken.Side.LONG, 500 * 1e18);

        vm.warp(expiryTimestamp + 1);
        oracle.setReading(regionId, expiryTimestamp, 10000);
        market.settle();

        vm.prank(alice);
        vm.expectRevert(BreezeMarket.MarketExpired.selector);
        market.mintPosition(PositionToken.Side.LONG, 100 * 1e18);
    }
}
