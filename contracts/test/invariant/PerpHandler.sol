// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../src/access/BreezeAccessControl.sol";
import "../../src/oracle/MockWeatherOracle.sol";
import "../../src/perp/BreezePerpMarket.sol";
import "../../src/perp/InsuranceFund.sol";
import "../../src/perp/VirtualAMM.sol";

contract PerpHandler is Test {
    BreezePerpMarket public perpMarket;
    ERC20 public collateralToken;
    MockWeatherOracle public oracle;

    address[] public traders;
    uint256[] public openPositionIds;

    bytes32 constant REGION_ID = keccak256("TOKYO_RAINFALL");

    constructor(BreezePerpMarket _market, ERC20 _token, MockWeatherOracle _oracle) {
        perpMarket = _market;
        collateralToken = _token;
        oracle = _oracle;

        traders.push(address(0x101));
        traders.push(address(0x102));
        traders.push(address(0x103));
    }

    function openLong(uint256 traderIndex, uint256 collateralAmount, uint256 leverage) public {
        address trader = traders[traderIndex % traders.length];
        collateralAmount = bound(collateralAmount, 100 * 1e18, 5_000 * 1e18);
        leverage = bound(leverage, 1, 3);

        vm.startPrank(trader);
        collateralToken.approve(address(perpMarket), collateralAmount);
        try perpMarket.openPosition(true, collateralAmount, leverage) returns (uint256 posId) {
            openPositionIds.push(posId);
        } catch {}
        vm.stopPrank();
    }

    function openShort(uint256 traderIndex, uint256 collateralAmount, uint256 leverage) public {
        address trader = traders[traderIndex % traders.length];
        collateralAmount = bound(collateralAmount, 100 * 1e18, 5_000 * 1e18);
        leverage = bound(leverage, 1, 3);

        vm.startPrank(trader);
        collateralToken.approve(address(perpMarket), collateralAmount);
        try perpMarket.openPosition(false, collateralAmount, leverage) returns (uint256 posId) {
            openPositionIds.push(posId);
        } catch {}
        vm.stopPrank();
    }

    function closePosition(uint256 posIdx) public {
        if (openPositionIds.length == 0) return;
        uint256 posId = openPositionIds[posIdx % openPositionIds.length];

        (address trader, , , , , , , bool isOpen) = perpMarket.positions(posId);
        if (!isOpen) return;

        vm.prank(trader);
        try perpMarket.closePosition(posId) {} catch {}
    }

    function liquidatePosition(uint256 posIdx) public {
        if (openPositionIds.length == 0) return;
        uint256 posId = openPositionIds[posIdx % openPositionIds.length];

        (, , , , , , , bool isOpen) = perpMarket.positions(posId);
        if (!isOpen || !perpMarket.isLiquidatable(posId)) return;

        vm.prank(traders[0]);
        try perpMarket.liquidate(posId) {} catch {}
    }
}
