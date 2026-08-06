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

contract CloseAcctToken is ERC20 {
    constructor() ERC20("Mock USDT", "mUSDT") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Round-trip accounting on the close path.
///
/// A position opened and closed with no intervening price movement, no funding,
/// and no fees must return the collateral that was posted. Any shortfall is
/// value destroyed by the accounting itself rather than by the market.
contract PerpCloseAccountingTest is Test {
    BreezeAccessControl accessControl;
    MockWeatherOracle oracle;
    FeeConfig feeConfig;
    ProtocolTreasury treasury;
    InsuranceFund insuranceFund;
    CloseAcctToken collateralToken;
    BreezePerpMarket perpMarket;

    address admin = address(this);
    address alice = address(0x2222);

    bytes32 constant REGION_ID = keccak256("TOKYO_RAINFALL");

    function setUp() public {
        accessControl = new BreezeAccessControl(admin);
        oracle = new MockWeatherOracle(address(accessControl));
        collateralToken = new CloseAcctToken();

        feeConfig = new FeeConfig(address(accessControl));
        // Minimum permitted rate (0.01%) so fees stay far below the tolerances
        // below and cannot mask a curve-accounting error.
        feeConfig.setTradingFeeBps(feeConfig.MIN_FEE_BPS());

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
        vm.prank(alice);
        collateralToken.approve(address(perpMarket), type(uint256).max);
    }

    /// Loss is measured against the collateral posted, not the wallet balance —
    /// a tolerance relative to a large wallet hides a total loss on a small position.
    function _roundTripLossBps(bool isLong, uint256 collateral, uint256 leverage)
        internal
        returns (uint256 lossBps)
    {
        uint256 before = collateralToken.balanceOf(alice);
        vm.startPrank(alice);
        uint256 posId = perpMarket.openPosition(isLong, collateral, leverage);
        perpMarket.closePosition(posId);
        vm.stopPrank();
        uint256 lost = before - collateralToken.balanceOf(alice);
        lossBps = (lost * 10000) / collateral;
    }

    function test_open_then_immediately_close_long_returns_collateral() public {
        // Fee is 1bp on open and 1bp on close, so ~2bps is the floor. Allow 10bps.
        assertLe(_roundTripLossBps(true, 1_000 * 1e18, 1), 10, "long round trip lost value");
    }

    function test_open_then_immediately_close_short_returns_collateral() public {
        assertLe(_roundTripLossBps(false, 1_000 * 1e18, 1), 10, "short round trip lost value");
    }

    /// A position large relative to the virtual reserves must still round-trip
    /// close to flat. Price impact is incurred once on the way in and refunded
    /// on the way out; it must not be charged twice.
    function test_large_position_round_trip_does_not_destroy_collateral() public {
        assertLe(_roundTripLossBps(true, 50_000 * 1e18, 3), 10, "large round trip lost value");
    }

    /// Leverage multiplies notional, so an accounting error on the close path
    /// scales with it while the posted collateral does not.
    function test_round_trip_loss_does_not_scale_with_leverage() public {
        uint256 collateral = 1_000 * 1e18;

        vm.startPrank(alice);
        uint256 before1x = collateralToken.balanceOf(alice);
        uint256 p1 = perpMarket.openPosition(true, collateral, 1);
        perpMarket.closePosition(p1);
        uint256 loss1x = before1x - collateralToken.balanceOf(alice);

        uint256 before3x = collateralToken.balanceOf(alice);
        uint256 p3 = perpMarket.openPosition(true, collateral, 3);
        perpMarket.closePosition(p3);
        uint256 loss3x = before3x - collateralToken.balanceOf(alice);
        vm.stopPrank();

        // Same collateral in, same market state, no price move: leverage must not
        // change what an immediate round trip costs.
        assertApproxEqAbs(loss3x, loss1x, 1e15, "round trip loss scales with leverage");
    }
}
