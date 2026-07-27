// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../src/access/BreezeAccessControl.sol";
import "../../src/oracle/MockWeatherOracle.sol";
import "../../src/perp/BreezePerpMarket.sol";
import "../../src/perp/InsuranceFund.sol";
import "../../src/perp/VirtualAMM.sol";

contract MockPerpUSDTLiq is ERC20 {
    constructor() ERC20("Mock USDT", "mUSDT") {
        _mint(msg.sender, 10_000_000 * 1e18);
    }
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract PerpLiquidationTest is Test {
    BreezeAccessControl accessControl;
    MockWeatherOracle oracle;
    InsuranceFund insuranceFund;
    MockPerpUSDTLiq collateralToken;
    BreezePerpMarket perpMarket;

    address admin = address(this);
    address pauser = address(0x1111);
    address alice = address(0x2222);
    address bob = address(0x3333);
    address liquidator = address(0x4444);

    bytes32 constant REGION_ID = keccak256("TOKYO_RAINFALL");

    function setUp() public {
        accessControl = new BreezeAccessControl(admin);
        accessControl.grantRole(accessControl.PAUSER_ROLE(), pauser);

        oracle = new MockWeatherOracle(address(accessControl));
        collateralToken = new MockPerpUSDTLiq();
        insuranceFund = new InsuranceFund(address(collateralToken), address(accessControl));

        VirtualAMM.Reserves memory initialReserves = VirtualAMM.Reserves({
            collateralReserve: 1_000_000 * 1e18,
            weatherReserve: 40_000 * 1e18
        });

        perpMarket = new BreezePerpMarket(
            initialReserves,
            address(oracle),
            address(insuranceFund),
            address(accessControl),
            address(collateralToken),
            REGION_ID
        );

        insuranceFund.setMarketAuthorization(address(perpMarket), true);

        // Top up insurance fund with 50,000 USD
        collateralToken.mint(address(this), 50_000 * 1e18);
        collateralToken.approve(address(insuranceFund), 50_000 * 1e18);
        insuranceFund.deposit(50_000 * 1e18);

        collateralToken.mint(alice, 100_000 * 1e18);
        collateralToken.mint(bob, 1_000_000 * 1e18);

        vm.prank(alice);
        collateralToken.approve(address(perpMarket), type(uint256).max);

        vm.prank(bob);
        collateralToken.approve(address(perpMarket), type(uint256).max);
    }

    function test_liquidation_only_when_liquidatable() public {
        // Alice opens 1,000 USD 3x LONG
        vm.prank(alice);
        uint256 posId = perpMarket.openPosition(true, 1_000 * 1e18, 3);

        // Liquidator attempts to liquidate healthy position -> reverts
        vm.prank(liquidator);
        vm.expectRevert(BreezePerpMarket.PositionNotLiquidatable.selector);
        perpMarket.liquidate(posId);
    }

    function test_paused_market_still_allows_liquidate() public {
        // Alice opens 1,000 USD 3x LONG
        vm.prank(alice);
        uint256 posId = perpMarket.openPosition(true, 1_000 * 1e18, 3);

        // Bob opens huge SHORT to crash mark price and make Alice liquidatable
        vm.prank(bob);
        perpMarket.openPosition(false, 300_000 * 1e18, 3);

        assertTrue(perpMarket.isLiquidatable(posId));

        // Pause market
        vm.prank(pauser);
        perpMarket.pauseOpens();
        assertTrue(perpMarket.paused());

        // CRITICAL REQUIREMENT: Liquidations MUST still succeed while market is paused
        uint256 balBefore = collateralToken.balanceOf(liquidator);
        vm.prank(liquidator);
        uint256 reward = perpMarket.liquidate(posId);

        assertTrue(reward > 0);
        assertTrue(collateralToken.balanceOf(liquidator) > balBefore);
    }

    function test_bad_debt_covered_by_insurance_fund() public {
        // Alice opens 1,000 USD 3x LONG
        vm.prank(alice);
        uint256 posId = perpMarket.openPosition(true, 1_000 * 1e18, 3);

        // Bob opens large SHORT, driving Alice into negative equity (bad debt)
        vm.prank(bob);
        perpMarket.openPosition(false, 250_000 * 1e18, 3);

        int256 alicePnl = perpMarket.calculateUnrealizedPnl(posId);
        assertTrue(int256(1_000 * 1e18) + alicePnl < 0); // Negative equity

        uint256 insBalBefore = insuranceFund.balance();

        vm.prank(liquidator);
        perpMarket.liquidate(posId);

        // Insurance fund balance should decrease to cover shortfall
        assertTrue(insuranceFund.balance() < insBalBefore);
    }
}
