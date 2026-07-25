// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../src/access/BreezeAccessControl.sol";
import "../../src/core/BreezeMarket.sol";
import "../../src/core/PositionToken.sol";
import "../../src/oracle/MockWeatherOracle.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockDRUSDT is ERC20 {
    constructor() ERC20("Mock USD", "USDT") {
        _mint(msg.sender, 1_000_000 * 1e18);
    }
}

contract DoubleRedemptionSecurityTest is Test {
    BreezeAccessControl public accessControl;
    BreezeMarket public market;
    PositionToken public positionToken;
    MockWeatherOracle public oracle;
    MockDRUSDT public usdt;

    bytes32 public regionId = keccak256("TOKYO_RAINFALL");
    uint256 public expiryTimestamp;

    address public alice = address(0x1111);
    address public bob = address(0x2222);

    function setUp() public {
        expiryTimestamp = block.timestamp + 7 days;
        accessControl = new BreezeAccessControl(address(this));

        positionToken = new PositionToken("https://breezeswap.io/api/");
        oracle = new MockWeatherOracle(address(accessControl));
        usdt = new MockDRUSDT();

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
        usdt.transfer(alice, 1000 * 1e18);
        usdt.transfer(bob, 1000 * 1e18);

        vm.startPrank(alice);
        usdt.approve(address(market.vault()), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(bob);
        usdt.approve(address(market.vault()), type(uint256).max);
        vm.stopPrank();
    }

    function test_redeem_twice_reverts() public {
        vm.prank(alice);
        uint256 tokenId = market.mintPosition(PositionToken.Side.LONG, 100 * 1e18);

        vm.warp(expiryTimestamp + 1);
        oracle.setReading(regionId, expiryTimestamp, 10000);
        market.settle();

        vm.prank(alice);
        market.redeem(tokenId, 100 * 1e18);

        vm.prank(alice);
        vm.expectRevert();
        market.redeem(tokenId, 100 * 1e18);
    }

    function test_redeem_split_equals_full() public {
        vm.prank(alice);
        uint256 tokenId = market.mintPosition(PositionToken.Side.LONG, 100 * 1e18);

        vm.prank(bob);
        market.mintPosition(PositionToken.Side.SHORT, 100 * 1e18);

        vm.warp(expiryTimestamp + 1);
        oracle.setReading(regionId, expiryTimestamp, 10000); // 50% split = 100 payout for 100 Long
        market.settle();

        vm.prank(alice);
        uint256 payout1 = market.redeem(tokenId, 40 * 1e18);

        vm.prank(alice);
        uint256 payout2 = market.redeem(tokenId, 60 * 1e18);

        assertEq(payout1 + payout2, 100 * 1e18);
    }

    function test_redeem_more_than_held_reverts() public {
        vm.prank(alice);
        uint256 tokenId = market.mintPosition(PositionToken.Side.LONG, 50 * 1e18);

        vm.warp(expiryTimestamp + 1);
        oracle.setReading(regionId, expiryTimestamp, 10000);
        market.settle();

        vm.prank(alice);
        vm.expectRevert();
        market.redeem(tokenId, 51 * 1e18);
    }

    function test_redeem_zero_amount_reverts() public {
        vm.prank(alice);
        uint256 tokenId = market.mintPosition(PositionToken.Side.LONG, 50 * 1e18);

        vm.warp(expiryTimestamp + 1);
        oracle.setReading(regionId, expiryTimestamp, 10000);
        market.settle();

        vm.prank(alice);
        vm.expectRevert(BreezeMarket.ZeroAmount.selector);
        market.redeem(tokenId, 0);
    }
}
