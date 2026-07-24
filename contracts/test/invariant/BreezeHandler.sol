// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../src/core/BreezeMarketFactory.sol";
import "../../src/core/BreezeMarket.sol";
import "../../src/core/PositionToken.sol";
import "../../src/oracle/MockWeatherOracle.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockInvUSDT is ERC20 {
    constructor() ERC20("Mock USD", "USDT") {
        _mint(msg.sender, 100_000_000 * 1e18);
    }
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract BreezeHandler is Test {
    BreezeMarketFactory public factory;
    BreezeMarket public market;
    MockWeatherOracle public oracle;
    MockInvUSDT public usdt;
    PositionToken public positionToken;

    uint256 public ghost_totalCollateralDeposited;
    uint256 public ghost_totalPayoutRedeemed;

    address public user1 = address(0x1001);
    address public user2 = address(0x1002);

    constructor(
        BreezeMarketFactory factory_,
        BreezeMarket market_,
        MockWeatherOracle oracle_,
        MockInvUSDT usdt_,
        PositionToken positionToken_
    ) {
        factory = factory_;
        market = market_;
        oracle = oracle_;
        usdt = usdt_;
        positionToken = positionToken_;

        usdt.mint(user1, 10_000_000 * 1e18);
        usdt.mint(user2, 10_000_000 * 1e18);

        vm.prank(user1);
        usdt.approve(address(market.vault()), type(uint256).max);
        vm.prank(user2);
        usdt.approve(address(market.vault()), type(uint256).max);
    }

    function mintLong(uint256 rawAmount) public {
        if (market.status() != BreezeMarket.Status.OPEN) return;
        if (block.timestamp >= market.expiryTimestamp()) return;

        uint256 amount = bound(rawAmount, 1 * 1e18, 100_000 * 1e18);

        vm.prank(user1);
        try market.mintPosition(PositionToken.Side.LONG, amount) {
            ghost_totalCollateralDeposited += amount;
        } catch {}
    }

    function mintShort(uint256 rawAmount) public {
        if (market.status() != BreezeMarket.Status.OPEN) return;
        if (block.timestamp >= market.expiryTimestamp()) return;

        uint256 amount = bound(rawAmount, 1 * 1e18, 100_000 * 1e18);

        vm.prank(user2);
        try market.mintPosition(PositionToken.Side.SHORT, amount) {
            ghost_totalCollateralDeposited += amount;
        } catch {}
    }

    function settleMarket(int256 oracleVal) public {
        if (market.status() != BreezeMarket.Status.OPEN) return;

        int256 boundedVal = bound(oracleVal, 0, 20000);
        vm.warp(market.expiryTimestamp() + 1);

        oracle.setReading(market.regionId(), market.expiryTimestamp(), boundedVal);

        try market.settle() {} catch {}
    }

    function redeemUser1(uint256 rawAmount) public {
        if (market.status() != BreezeMarket.Status.SETTLED) return;

        uint256 tokenId = positionToken.getTokenId(address(market), PositionToken.Side.LONG);
        uint256 userBal = positionToken.balanceOf(user1, tokenId);
        if (userBal == 0) return;

        uint256 amount = bound(rawAmount, 1, userBal);

        vm.prank(user1);
        try market.redeem(tokenId, amount) returns (uint256 payout) {
            ghost_totalPayoutRedeemed += payout;
        } catch {}
    }

    function redeemUser2(uint256 rawAmount) public {
        if (market.status() != BreezeMarket.Status.SETTLED) return;

        uint256 tokenId = positionToken.getTokenId(address(market), PositionToken.Side.SHORT);
        uint256 userBal = positionToken.balanceOf(user2, tokenId);
        if (userBal == 0) return;

        uint256 amount = bound(rawAmount, 1, userBal);

        vm.prank(user2);
        try market.redeem(tokenId, amount) returns (uint256 payout) {
            ghost_totalPayoutRedeemed += payout;
        } catch {}
    }
}
