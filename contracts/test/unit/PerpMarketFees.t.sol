// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../src/access/BreezeAccessControl.sol";
import "../../src/oracle/MockWeatherOracle.sol";
import "../../src/fees/FeeConfig.sol";
import "../../src/fees/ProtocolTreasury.sol";
import "../../src/perp/InsuranceFund.sol";
import "../../src/perp/BreezePerpMarket.sol";
import "../../src/perp/VirtualAMM.sol";

contract MockFeeUSDT is ERC20 {
    constructor() ERC20("Mock USDT", "mUSDT") {
        _mint(msg.sender, 10_000_000 * 1e18);
    }
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract PerpMarketFeesTest is Test {
    BreezeAccessControl accessControl;
    MockWeatherOracle oracle;
    FeeConfig feeConfig;
    ProtocolTreasury treasury;
    InsuranceFund insuranceFund;
    MockFeeUSDT collateralToken;
    BreezePerpMarket perpMarket;

    address admin = address(this);
    address alice = address(0x1111);
    address bob = address(0x2222);

    bytes32 constant REGION_ID = keccak256("TOKYO_RAINFALL");

    function setUp() public {
        accessControl = new BreezeAccessControl(admin);
        oracle = new MockWeatherOracle(address(accessControl));
        collateralToken = new MockFeeUSDT();

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

    function test_fee_deducted_on_open() public {
        uint256 rawCollateral = 10_000 * 1e18; // 10,000 mUSDT
        (uint256 feeAmount, uint256 insuranceShare, uint256 firstLossShare, uint256 treasuryShare) =
            feeConfig.calculateFeeSplit(rawCollateral);

        uint256 insBalBefore = collateralToken.balanceOf(address(insuranceFund));
        uint256 treBalBefore = collateralToken.balanceOf(address(treasury));

        vm.prank(alice);
        uint256 posId = perpMarket.openPosition(true, rawCollateral, 2);

        (, , uint256 netCollateral, , , , , ) = perpMarket.positions(posId);

        // Assert net collateral recorded = rawCollateral - feeAmount
        assertEq(netCollateral, rawCollateral - feeAmount);

        // No first-loss reserve is configured on this market, so that leg joins the
        // liquidation backstop rather than being stranded. This is the compatibility
        // path: a market never wired to a reserve behaves exactly as before.
        assertEq(
            collateralToken.balanceOf(address(insuranceFund)) - insBalBefore,
            insuranceShare + firstLossShare,
            "first-loss leg went missing when no reserve was configured"
        );
        assertEq(collateralToken.balanceOf(address(treasury)) - treBalBefore, treasuryShare);
        assertEq(insuranceShare + firstLossShare + treasuryShare, feeAmount);
    }

    function test_fee_deducted_on_close() public {
        uint256 rawCollateral = 10_000 * 1e18;

        vm.prank(alice);
        uint256 posId = perpMarket.openPosition(true, rawCollateral, 2);

        uint256 insBalBefore = collateralToken.balanceOf(address(insuranceFund));
        uint256 treBalBefore = collateralToken.balanceOf(address(treasury));

        vm.prank(alice);
        perpMarket.closePosition(posId);

        assertTrue(collateralToken.balanceOf(address(insuranceFund)) > insBalBefore);
        assertTrue(collateralToken.balanceOf(address(treasury)) > treBalBefore);
    }
}
