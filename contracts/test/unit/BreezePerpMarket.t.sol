// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../src/access/BreezeAccessControl.sol";
import "../../src/oracle/MockWeatherOracle.sol";
import "../../src/fees/FeeConfig.sol";
import "../../src/fees/ProtocolTreasury.sol";
import "../../src/perp/BreezePerpMarket.sol";
import "../../src/perp/InsuranceFund.sol";
import "../../src/perp/VirtualAMM.sol";

contract MockPerpUSDT is ERC20 {
    constructor() ERC20("Mock USDT", "mUSDT") {
        _mint(msg.sender, 10_000_000 * 1e18);
    }
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract BreezePerpMarketTest is Test {
    BreezeAccessControl accessControl;
    MockWeatherOracle oracle;
    FeeConfig feeConfig;
    ProtocolTreasury treasury;
    InsuranceFund insuranceFund;
    MockPerpUSDT collateralToken;
    BreezePerpMarket perpMarket;

    address admin = address(this);
    address pauser = address(0x1111);
    address alice = address(0x2222);
    address bob = address(0x3333);

    bytes32 constant REGION_ID = keccak256("TOKYO_RAINFALL");

    function setUp() public {
        accessControl = new BreezeAccessControl(admin);
        accessControl.grantRole(accessControl.PAUSER_ROLE(), pauser);

        oracle = new MockWeatherOracle(address(accessControl));
        collateralToken = new MockPerpUSDT();

        feeConfig = new FeeConfig(address(accessControl));
        treasury = new ProtocolTreasury(address(collateralToken), address(accessControl));
        insuranceFund = new InsuranceFund(address(collateralToken), address(accessControl));

        VirtualAMM.Reserves memory initialReserves = VirtualAMM.Reserves({
            collateralReserve: 1_000_000 * 1e18,
            weatherReserve: 40_000 * 1e18
        });

        perpMarket = new BreezePerpMarket(
            initialReserves,
            address(oracle),
            address(insuranceFund),
            address(feeConfig),
            address(treasury),
            address(accessControl),
            address(collateralToken),
            REGION_ID
        );

        insuranceFund.setMarketAuthorization(address(perpMarket), true);

        collateralToken.mint(alice, 100_000 * 1e18);
        collateralToken.mint(bob, 100_000 * 1e18);

        vm.prank(alice);
        collateralToken.approve(address(perpMarket), type(uint256).max);

        vm.prank(bob);
        collateralToken.approve(address(perpMarket), type(uint256).max);
    }

    function test_open_long_position_full_lifecycle() public {
        vm.startPrank(alice);
        uint256 posId = perpMarket.openPosition(true, 1_000 * 1e18, 2);
        vm.stopPrank();

        assertEq(posId, 0);
        assertEq(perpMarket.totalLongOpenInterest(), 999 * 1e18);

        (address trader, bool isLong, uint256 collateral, uint256 leverage, uint256 virtualSize, , , bool isOpen) = perpMarket.positions(posId);
        assertEq(trader, alice);
        assertTrue(isLong);
        assertEq(collateral, 999 * 1e18);
        assertEq(leverage, 2);
        assertTrue(virtualSize > 0);
        assertTrue(isOpen);
    }

    function test_leverage_cap_enforced() public {
        vm.startPrank(alice);
        vm.expectRevert(BreezePerpMarket.InvalidLeverage.selector);
        perpMarket.openPosition(true, 1_000 * 1e18, 4); // 4x exceeds 3x cap
        vm.stopPrank();
    }

    function test_cannot_close_others_position() public {
        vm.prank(alice);
        uint256 posId = perpMarket.openPosition(true, 1_000 * 1e18, 2);

        vm.prank(bob);
        vm.expectRevert("not position owner");
        perpMarket.closePosition(posId);
    }

    function test_paused_market_blocks_open() public {
        vm.prank(pauser);
        perpMarket.pauseOpens();

        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        perpMarket.openPosition(true, 1_000 * 1e18, 2);
        vm.stopPrank();
    }

    function test_paused_market_still_allows_close() public {
        // Alice opens position before pause
        vm.prank(alice);
        uint256 posId = perpMarket.openPosition(true, 1_000 * 1e18, 2);

        // Pause market
        vm.prank(pauser);
        perpMarket.pauseOpens();
        assertTrue(perpMarket.paused());

        // CRITICAL REQUIREMENT: Alice MUST still be able to close position while market is paused
        vm.prank(alice);
        int256 pnl = perpMarket.closePosition(posId);

        (, , , , , , , bool isOpen) = perpMarket.positions(posId);
        assertFalse(isOpen);
    }
}
