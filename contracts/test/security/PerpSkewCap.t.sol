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

contract SkewToken is ERC20 {
    constructor() ERC20("Mock USDT", "mUSDT") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Open-interest skew bounds the protocol's unhedged exposure.
///
/// Funding only nets out across matched long/short interest. Everything beyond
/// that has no trader on the other side and is carried by protocol capital, so
/// the imbalance has to be capped rather than left to grow.
contract PerpSkewCapTest is Test {
    BreezeAccessControl accessControl;
    MockWeatherOracle oracle;
    FeeConfig feeConfig;
    ProtocolTreasury treasury;
    InsuranceFund insuranceFund;
    SkewToken collateralToken;
    BreezePerpMarket perpMarket;

    address admin = address(this);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address attacker = address(0xBAD);

    uint256 constant COLLATERAL_RESERVE = 1_000_000 * 1e18;
    bytes32 constant REGION_ID = keccak256("TOKYO_RAINFALL");

    function setUp() public {
        accessControl = new BreezeAccessControl(admin);
        oracle = new MockWeatherOracle(address(accessControl));
        collateralToken = new SkewToken();

        feeConfig = new FeeConfig(address(accessControl));
        feeConfig.setTradingFeeBps(feeConfig.MIN_FEE_BPS());
        treasury = new ProtocolTreasury(address(collateralToken), address(accessControl));
        insuranceFund = new InsuranceFund(address(collateralToken), address(accessControl));

        VirtualAMM.Reserves memory initialReserves = VirtualAMM.Reserves({
            collateralReserve: COLLATERAL_RESERVE,
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

        collateralToken.mint(alice, 2_000_000e18);
        collateralToken.mint(bob, 2_000_000e18);

        vm.prank(alice);
        collateralToken.approve(address(perpMarket), type(uint256).max);
        vm.prank(bob);
        collateralToken.approve(address(perpMarket), type(uint256).max);
    }

    function test_default_cap_is_seeded_from_initial_reserve() public view {
        uint256 expected =
            (COLLATERAL_RESERVE * PerpConstants.DEFAULT_MAX_SKEW_BPS_OF_RESERVE) / 10000;
        assertEq(perpMarket.maxSkew(), expected);
        assertEq(perpMarket.maxSkew(), 250_000e18);
    }

    function test_position_within_cap_is_allowed() public {
        vm.prank(alice);
        perpMarket.openPosition(true, 200_000e18, 1);

        assertLe(perpMarket.currentSkew(), perpMarket.maxSkew());
    }

    function test_position_breaching_cap_reverts() public {
        vm.prank(alice);
        vm.expectRevert();
        perpMarket.openPosition(true, 300_000e18, 1);
    }

    function test_accumulated_one_sided_flow_cannot_exceed_cap() public {
        // Repeated smaller trades must not sneak past the ceiling.
        vm.startPrank(alice);
        perpMarket.openPosition(true, 150_000e18, 1);
        vm.expectRevert();
        perpMarket.openPosition(true, 150_000e18, 1);
        vm.stopPrank();

        assertLe(perpMarket.currentSkew(), perpMarket.maxSkew());
    }

    /// The cap constrains imbalance, not volume: a balanced book can grow past it.
    function test_balanced_flow_is_not_constrained_by_cap() public {
        vm.prank(alice);
        perpMarket.openPosition(true, 200_000e18, 1);
        vm.prank(bob);
        perpMarket.openPosition(false, 200_000e18, 1);

        // Both sides are large but nearly matched, so the market stays open.
        vm.prank(alice);
        perpMarket.openPosition(true, 200_000e18, 1);

        assertLe(perpMarket.currentSkew(), perpMarket.maxSkew());
        assertGt(perpMarket.totalLongOpenInterest(), perpMarket.maxSkew());
    }

    /// Trading that reduces the imbalance must stay available even at the cap.
    function test_opposing_side_can_always_close_the_gap() public {
        vm.prank(alice);
        perpMarket.openPosition(true, 240_000e18, 1);

        uint256 skewBefore = perpMarket.currentSkew();

        vm.prank(bob);
        perpMarket.openPosition(false, 200_000e18, 1);

        assertLt(perpMarket.currentSkew(), skewBefore, "counter-flow was blocked");
    }

    function test_matched_open_interest_reports_the_netted_portion() public {
        vm.prank(alice);
        perpMarket.openPosition(true, 100_000e18, 1);
        vm.prank(bob);
        perpMarket.openPosition(false, 40_000e18, 1);

        // Matched is the smaller side; the rest is skew.
        assertEq(perpMarket.matchedOpenInterest(), perpMarket.totalShortOpenInterest());
        assertEq(
            perpMarket.currentSkew(),
            perpMarket.totalLongOpenInterest() - perpMarket.totalShortOpenInterest()
        );
    }

    function test_non_admin_cannot_change_cap() public {
        vm.prank(attacker);
        vm.expectRevert(BreezePerpMarket.UnauthorizedCaller.selector);
        perpMarket.setMaxSkew(type(uint256).max);
    }

    function test_admin_can_disable_cap() public {
        perpMarket.setMaxSkew(0);

        vm.prank(alice);
        perpMarket.openPosition(true, 500_000e18, 1);

        assertGt(perpMarket.currentSkew(), 250_000e18);
    }

    /// Closes carry no skew check, so ordinary activity can leave the book above
    /// the cap. From there the market must still be repairable — a rule that
    /// only tests the resulting skew would reject the very trades that fix it
    /// and freeze the market one-way.
    function test_counterflow_still_allowed_when_book_is_over_cap() public {
        // Build a large balanced book, then unwind one side to breach the cap.
        vm.prank(alice);
        perpMarket.openPosition(true, 200_000e18, 1);
        vm.prank(bob);
        uint256 shortId = perpMarket.openPosition(false, 200_000e18, 1);
        vm.prank(alice);
        perpMarket.openPosition(true, 200_000e18, 1);

        vm.prank(bob);
        perpMarket.closePosition(shortId);

        uint256 skewBefore = perpMarket.currentSkew();
        assertGt(skewBefore, perpMarket.maxSkew(), "setup did not breach the cap");

        // A short reduces the imbalance and must be permitted.
        vm.prank(bob);
        perpMarket.openPosition(false, 100_000e18, 1);

        assertLt(perpMarket.currentSkew(), skewBefore, "repairing trade was blocked");
    }

    function test_worsening_trade_still_blocked_when_over_cap() public {
        vm.prank(alice);
        perpMarket.openPosition(true, 200_000e18, 1);
        vm.prank(bob);
        uint256 shortId = perpMarket.openPosition(false, 200_000e18, 1);
        vm.prank(alice);
        perpMarket.openPosition(true, 200_000e18, 1);
        vm.prank(bob);
        perpMarket.closePosition(shortId);

        // Same direction as the crowd, while already over the cap.
        vm.prank(alice);
        vm.expectRevert();
        perpMarket.openPosition(true, 50_000e18, 1);
    }

    /// Lowering the cap must not permanently freeze a book that is already past it.
    function test_lowering_the_cap_does_not_freeze_rebalancing() public {
        vm.prank(alice);
        perpMarket.openPosition(true, 200_000e18, 1);

        perpMarket.setMaxSkew(1);

        uint256 skewBefore = perpMarket.currentSkew();
        vm.prank(bob);
        perpMarket.openPosition(false, 100_000e18, 1);

        assertLt(perpMarket.currentSkew(), skewBefore, "market frozen by a lowered cap");
    }

    function test_closing_a_position_reduces_skew() public {
        vm.prank(alice);
        uint256 posId = perpMarket.openPosition(true, 200_000e18, 1);
        assertGt(perpMarket.currentSkew(), 0);

        vm.prank(alice);
        perpMarket.closePosition(posId);

        assertEq(perpMarket.currentSkew(), 0);
    }
}
