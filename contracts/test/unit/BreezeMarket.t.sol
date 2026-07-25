// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../src/access/BreezeAccessControl.sol";
import "../../src/core/BreezeMarket.sol";
import "../../src/core/PositionToken.sol";
import "../../src/oracle/MockWeatherOracle.sol";
import "../../src/vault/CollateralVault.sol";

contract MockERC20Token is ERC20 {
    constructor() ERC20("Mock USD", "USDT0") {
        _mint(msg.sender, 1_000_000 * 1e18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract BreezeMarketTest is Test {
    BreezeAccessControl public accessControl;
    BreezeMarket public market;
    PositionToken public positionToken;
    MockWeatherOracle public oracle;
    MockERC20Token public collateral;

    bytes32 public regionId = keccak256("SEOUL_RAINFALL");
    uint256 public expiryTimestamp;
    int256 public thresholdLow = 5000;
    int256 public thresholdHigh = 15000;

    address public alice = address(0x1111);
    address public bob = address(0x2222);

    function setUp() public {
        expiryTimestamp = block.timestamp + 7 days;
        accessControl = new BreezeAccessControl(address(this));
        
        positionToken = new PositionToken("https://breezeswap.io/api/");
        oracle = new MockWeatherOracle(address(accessControl));
        collateral = new MockERC20Token();

        market = new BreezeMarket(
            regionId,
            BreezeMarket.WeatherVariable.RAINFALL,
            thresholdLow,
            thresholdHigh,
            expiryTimestamp,
            address(oracle),
            address(collateral),
            address(positionToken),
            PayoffCalculator.PayoffType.CAPPED,
            address(accessControl)
        );

        positionToken.setMinter(address(market), true);

        collateral.mint(alice, 10_000 * 1e18);
        collateral.mint(bob, 10_000 * 1e18);

        vm.startPrank(alice);
        collateral.approve(address(market.vault()), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(bob);
        collateral.approve(address(market.vault()), type(uint256).max);
        vm.stopPrank();
    }

    function test_FullLifecycleMintSettleRedeem() public {
        // 1. Alice mints 1000 Long, Bob mints 1000 Short
        vm.prank(alice);
        uint256 longTokenId = market.mintPosition(PositionToken.Side.LONG, 1000 * 1e18);

        vm.prank(bob);
        uint256 shortTokenId = market.mintPosition(PositionToken.Side.SHORT, 1000 * 1e18);

        assertEq(positionToken.balanceOf(alice, longTokenId), 1000 * 1e18);
        assertEq(positionToken.balanceOf(bob, shortTokenId), 1000 * 1e18);

        // 2. Fast forward past expiry
        vm.warp(expiryTimestamp + 1);

        // 3. Set oracle value (10,000 = 50% midpoint between 5,000 and 15,000)
        oracle.setReading(regionId, expiryTimestamp, 10000);

        // 4. Settle
        market.settle();
        assertTrue(market.status() == BreezeMarket.Status.SETTLED);

        // 5. Redeem: Each gets 1000 tokens * 50% = 1000 USDT payout
        uint256 aliceBalBefore = collateral.balanceOf(alice);
        vm.prank(alice);
        uint256 alicePayout = market.redeem(longTokenId, 1000 * 1e18);

        uint256 bobBalBefore = collateral.balanceOf(bob);
        vm.prank(bob);
        uint256 bobPayout = market.redeem(shortTokenId, 1000 * 1e18);

        assertEq(alicePayout, 1000 * 1e18);
        assertEq(bobPayout, 1000 * 1e18);
        assertEq(collateral.balanceOf(alice) - aliceBalBefore, 1000 * 1e18);
        assertEq(collateral.balanceOf(bob) - bobBalBefore, 1000 * 1e18);
    }

    function test_CannotMintAfterExpiry() public {
        vm.warp(expiryTimestamp);
        vm.prank(alice);
        vm.expectRevert(BreezeMarket.MarketExpired.selector);
        market.mintPosition(PositionToken.Side.LONG, 100);
    }

    function test_CannotSettleBeforeExpiry() public {
        oracle.setReading(regionId, block.timestamp, 10000);
        vm.expectRevert(BreezeMarket.MarketNotExpired.selector);
        market.settle();
    }

    function test_CannotSettleTwice() public {
        vm.warp(expiryTimestamp + 1);
        oracle.setReading(regionId, expiryTimestamp, 10000);
        market.settle();

        vm.expectRevert(BreezeMarket.MarketAlreadySettled.selector);
        market.settle();
    }

    function test_CannotRedeemBeforeSettlement() public {
        vm.prank(alice);
        uint256 tokenId = market.mintPosition(PositionToken.Side.LONG, 100);

        vm.prank(alice);
        vm.expectRevert(BreezeMarket.MarketNotSettled.selector);
        market.redeem(tokenId, 100);
    }

    function test_CannotRedeemSameTokensTwice() public {
        vm.prank(alice);
        uint256 tokenId = market.mintPosition(PositionToken.Side.LONG, 100 * 1e18);

        vm.warp(expiryTimestamp + 1);
        oracle.setReading(regionId, expiryTimestamp, 10000);
        market.settle();

        vm.prank(alice);
        market.redeem(tokenId, 100 * 1e18);

        // Attempting to redeem again fails because tokens were burned
        vm.prank(alice);
        vm.expectRevert();
        market.redeem(tokenId, 100 * 1e18);
    }

    function test_SettlementRevertsIfOracleDataStale() public {
        // Reading set at expiryTimestamp
        oracle.setReading(regionId, expiryTimestamp, 10000);
        
        // Fast forward block.timestamp far into future past maxAge (86,400s)
        vm.warp(expiryTimestamp + 90_000);

        vm.expectRevert(BreezeMarket.OracleDataStale.selector);
        market.settle();
    }

    function test_SettlementRevertsIfOracleDataInvalid() public {
        vm.warp(expiryTimestamp + 1);
        // No reading set in oracle
        vm.expectRevert(BreezeMarket.InvalidOracleData.selector);
        market.settle();
    }

    function test_OddRoundingAmounts() public {
        // Mint odd collateral amount
        vm.prank(alice);
        uint256 longId = market.mintPosition(PositionToken.Side.LONG, 333333333333333333);

        vm.prank(bob);
        uint256 shortId = market.mintPosition(PositionToken.Side.SHORT, 777777777777777777);

        vm.warp(expiryTimestamp + 1);
        oracle.setReading(regionId, expiryTimestamp, 10000);
        market.settle();

        vm.prank(alice);
        uint256 p1 = market.redeem(longId, 333333333333333333);

        vm.prank(bob);
        uint256 p2 = market.redeem(shortId, 777777777777777777);

        assertTrue(p1 > 0 && p2 > 0);
    }
}
