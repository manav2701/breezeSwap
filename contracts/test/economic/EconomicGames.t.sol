// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../src/access/BreezeAccessControl.sol";
import "../../src/core/BreezeMarket.sol";
import "../../src/core/PositionToken.sol";
import "../../src/oracle/MockWeatherOracle.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockEGUSDT is ERC20 {
    constructor() ERC20("Mock USD", "USDT") {
        _mint(msg.sender, 1_000_000 * 1e18);
    }
}

contract EconomicGamesTest is Test {
    BreezeAccessControl public accessControl;
    BreezeMarket public market;
    PositionToken public positionToken;
    MockWeatherOracle public oracle;
    MockEGUSDT public usdt;

    bytes32 public regionId = keccak256("TOKYO_RAINFALL");
    uint256 public expiryTimestamp;

    address public alice = address(0x1111);
    address public bob = address(0x2222);
    address public attacker = address(0x9999);

    function setUp() public {
        expiryTimestamp = block.timestamp + 7 days;
        accessControl = new BreezeAccessControl(address(this));

        positionToken = new PositionToken("https://breezeswap.io/api/");
        oracle = new MockWeatherOracle(address(accessControl));
        usdt = new MockEGUSDT();

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
        usdt.transfer(attacker, 100_000 * 1e18);

        vm.startPrank(alice);
        usdt.approve(address(market.vault()), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(bob);
        usdt.approve(address(market.vault()), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(attacker);
        usdt.approve(address(market.vault()), type(uint256).max);
        vm.stopPrank();
    }

    function test_frontrun_settle_cannot_profit() public {
        // Honest users mint prior to expiry
        vm.prank(alice);
        uint256 aliceLongId = market.mintPosition(PositionToken.Side.LONG, 1000 * 1e18);

        vm.prank(bob);
        market.mintPosition(PositionToken.Side.SHORT, 1000 * 1e18);

        // Attacker attempts to mint before expiry
        vm.prank(attacker);
        uint256 attackerLongId = market.mintPosition(PositionToken.Side.LONG, 1000 * 1e18);

        vm.warp(expiryTimestamp + 1);
        oracle.setReading(regionId, expiryTimestamp, 15000); // LONG wins 100%
        market.settle();

        // Attacker redeems
        vm.prank(attacker);
        uint256 attackerPayout = market.redeem(attackerLongId, 1000 * 1e18);

        // Alice redeems
        vm.prank(alice);
        uint256 alicePayout = market.redeem(aliceLongId, 1000 * 1e18);

        // Attacker payout is strictly proportional (50% of total collateral pool), no profit beyond contribution
        assertEq(attackerPayout, 1500 * 1e18);
        assertEq(alicePayout, 1500 * 1e18);
    }

    function test_griefing_tiny_position() public {
        vm.prank(alice);
        uint256 aliceLong = market.mintPosition(PositionToken.Side.LONG, 100 * 1e18);

        // Attacker mints 1 wei short position
        vm.prank(attacker);
        uint256 attackerShort = market.mintPosition(PositionToken.Side.SHORT, 1);

        vm.warp(expiryTimestamp + 1);
        oracle.setReading(regionId, expiryTimestamp, 15000); // 100% Long win
        market.settle();

        vm.prank(alice);
        market.redeem(aliceLong, 100 * 1e18);

        // Vault has at most 1 wei remaining
        assertLe(market.vault().totalDeposited(), 1);

        // Attacker redeems 1 wei without reverting
        vm.prank(attacker);
        market.redeem(attackerShort, 1);

        assertEq(market.vault().totalDeposited(), 0);
    }

    function test_last_redeemer_gets_full_remainder() public {
        vm.prank(alice);
        uint256 aliceLong = market.mintPosition(PositionToken.Side.LONG, 50 * 1e18);

        vm.prank(bob);
        uint256 bobLong = market.mintPosition(PositionToken.Side.LONG, 50 * 1e18);

        vm.prank(attacker);
        uint256 shortId = market.mintPosition(PositionToken.Side.SHORT, 100 * 1e18);

        vm.warp(expiryTimestamp + 1);
        oracle.setReading(regionId, expiryTimestamp, 10000); // 50-50 split
        market.settle();

        vm.prank(alice);
        market.redeem(aliceLong, 50 * 1e18);

        vm.prank(bob);
        market.redeem(bobLong, 50 * 1e18);

        vm.prank(attacker);
        market.redeem(shortId, 100 * 1e18);

        assertEq(market.vault().totalDeposited(), 0);
    }

    function test_no_advantage_to_position_size() public {
        // Alice mints 1000 units in one batch
        vm.prank(alice);
        uint256 aliceLong = market.mintPosition(PositionToken.Side.LONG, 1000 * 1e18);

        // Bob mints 1000 units in 10 batches of 100
        uint256 bobLong = 0;
        for (uint256 i = 0; i < 10; i++) {
            vm.prank(bob);
            bobLong = market.mintPosition(PositionToken.Side.LONG, 100 * 1e18);
        }

        vm.warp(expiryTimestamp + 1);
        oracle.setReading(regionId, expiryTimestamp, 10000);
        market.settle();

        vm.prank(alice);
        uint256 alicePayout = market.redeem(aliceLong, 1000 * 1e18);

        vm.prank(bob);
        uint256 bobPayout = market.redeem(bobLong, 1000 * 1e18);

        assertEq(alicePayout, bobPayout);
    }

    function test_oracle_reading_timing_neutral() public {
        oracle.setReading(regionId, expiryTimestamp, 10000);
        oracle.setReading(regionId, expiryTimestamp + 2 hours, 18000);

        vm.warp(expiryTimestamp + 3 hours);
        market.settle();

        assertEq(market.finalOracleValue(), 10000);
    }
}
