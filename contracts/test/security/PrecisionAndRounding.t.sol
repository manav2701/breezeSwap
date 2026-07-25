// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../src/access/BreezeAccessControl.sol";
import "../../src/core/BreezeMarket.sol";
import "../../src/core/PositionToken.sol";
import "../../src/oracle/MockWeatherOracle.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockPRUSDT is ERC20 {
    constructor() ERC20("Mock USD", "USDT") {
        _mint(msg.sender, 1_000_000 * 1e18);
    }
}

contract PrecisionAndRoundingSecurityTest is Test {
    BreezeAccessControl public accessControl;
    BreezeMarket public market;
    PositionToken public positionToken;
    MockWeatherOracle public oracle;
    MockPRUSDT public usdt;

    bytes32 public regionId = keccak256("TOKYO_RAINFALL");
    uint256 public expiryTimestamp;

    address public alice = address(0x1111);
    address public bob = address(0x2222);

    function setUp() public {
        expiryTimestamp = block.timestamp + 7 days;
        accessControl = new BreezeAccessControl(address(this));

        positionToken = new PositionToken("https://breezeswap.io/api/");
        oracle = new MockWeatherOracle(address(accessControl));
        usdt = new MockPRUSDT();

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
            address(accessControl)
        );

        positionToken.setMinter(address(market), true);

        usdt.transfer(alice, 100_000 * 1e18);
        usdt.transfer(bob, 100_000 * 1e18);

        vm.startPrank(alice);
        usdt.approve(address(market.vault()), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(bob);
        usdt.approve(address(market.vault()), type(uint256).max);
        vm.stopPrank();
    }

    function test_no_collateral_stuck_after_full_redemption() public {
        uint256 aliceAmount = 99999999;
        uint256 bobAmount = 77777777;

        vm.prank(alice);
        uint256 longId = market.mintPosition(PositionToken.Side.LONG, aliceAmount);

        vm.prank(bob);
        uint256 shortId = market.mintPosition(PositionToken.Side.SHORT, bobAmount);

        vm.warp(expiryTimestamp + 1);
        oracle.setReading(regionId, expiryTimestamp, 10000); // 50% midpoint
        market.settle();

        vm.prank(alice);
        market.redeem(longId, aliceAmount);

        vm.prank(bob);
        market.redeem(shortId, bobAmount);

        assertEq(market.vault().totalDeposited(), 0);
    }

    function test_payoff_zero_sum_at_boundary() public view {
        (uint256 longLow, uint256 shortLow) = PayoffCalculator.calculatePayout(
            PayoffCalculator.PayoffType.CAPPED,
            5000, // thresholdLow
            5000,
            15000,
            100 * 1e18
        );
        assertEq(longLow + shortLow, 100 * 1e18);
        assertEq(longLow, 0);

        (uint256 longHigh, uint256 shortHigh) = PayoffCalculator.calculatePayout(
            PayoffCalculator.PayoffType.CAPPED,
            15000, // thresholdHigh
            5000,
            15000,
            100 * 1e18
        );
        assertEq(longHigh + shortHigh, 100 * 1e18);
        assertEq(longHigh, 100 * 1e18);
    }

    function test_payoff_zero_sum_extreme_values() public view {
        uint256 maxNotional = type(uint128).max;

        (uint256 longP, uint256 shortP) = PayoffCalculator.calculatePayout(
            PayoffCalculator.PayoffType.CAPPED,
            10000,
            5000,
            15000,
            maxNotional
        );
        assertEq(longP + shortP, maxNotional);
    }

    function test_minimum_viable_position() public {
        vm.prank(alice);
        uint256 longId = market.mintPosition(PositionToken.Side.LONG, 1); // 1 wei

        vm.warp(expiryTimestamp + 1);
        oracle.setReading(regionId, expiryTimestamp, 10000);
        market.settle();

        vm.prank(alice);
        market.redeem(longId, 1);
        assertEq(market.vault().totalDeposited(), 0);
    }

    function test_rounding_direction_consistent() public view {
        (uint256 longP, uint256 shortP) = PayoffCalculator.calculatePayout(
            PayoffCalculator.PayoffType.LINEAR,
            7500,
            5000,
            15000,
            333333333
        );
        assertEq(longP + shortP, 333333333);
    }
}
