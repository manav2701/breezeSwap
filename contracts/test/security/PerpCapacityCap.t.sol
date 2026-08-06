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
import "../../src/vault/BreezeLiquidityVault.sol";

contract CapToken is ERC20 {
    constructor() ERC20("Mock USDT", "mUSDT") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Preventive notional capacity: the market refuses exposure its backing
/// cannot already support, instead of accepting it and reserving afterwards.
///
/// The distinction is not cosmetic. Under the reactive model a trade could be
/// accepted and then only partially backed, so the market could reach a state its
/// capital did not cover and only discover it on the way out. Under the preventive
/// model that state is unreachable.
contract PerpCapacityCapTest is Test {
    BreezeAccessControl accessControl;
    MockWeatherOracle oracle;
    FeeConfig feeConfig;
    ProtocolTreasury treasury;
    InsuranceFund insuranceFund;
    BreezeLiquidityVault vault;
    CapToken token;
    BreezePerpMarket market;

    address admin = address(this);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address lp = address(0x11B);

    bytes32 constant REGION = keccak256("TOKYO_RAINFALL");

    function setUp() public {
        accessControl = new BreezeAccessControl(admin);
        accessControl.grantRole(accessControl.ORACLE_UPDATER_ROLE(), admin);
        oracle = new MockWeatherOracle(address(accessControl));
        token = new CapToken();

        feeConfig = new FeeConfig(address(accessControl));
        feeConfig.setTradingFeeBps(feeConfig.MIN_FEE_BPS());
        treasury = new ProtocolTreasury(address(token), address(accessControl));
        insuranceFund = new InsuranceFund(address(token), address(accessControl));
        vault = new BreezeLiquidityVault(token, address(accessControl), "Breeze LP", "bLP");

        market = new BreezePerpMarket(
            VirtualAMM.Reserves({collateralReserve: 5_000_000e18, weatherReserve: 200_000e18}),
            address(oracle),
            address(insuranceFund),
            address(feeConfig),
            address(treasury),
            address(accessControl),
            address(token),
            REGION
        );

        insuranceFund.setMarketAuthorization(address(market), true);
        vault.setMarketAuthorization(address(market), true);

        // Skew cap off by default here: these tests are about the capacity cap,
        // and two overlapping limits make it ambiguous which one refused a trade.
        market.setMaxSkew(0);

        token.mint(alice, 5_000_000e18);
        token.mint(bob, 5_000_000e18);
        token.mint(lp, 5_000_000e18);
        vm.prank(alice);
        token.approve(address(market), type(uint256).max);
        vm.prank(bob);
        token.approve(address(market), type(uint256).max);
        vm.prank(lp);
        token.approve(address(vault), type(uint256).max);

        oracle.setReading(REGION, block.timestamp, 25e6);
    }

    function _fundVault(uint256 amount) internal {
        vm.prank(lp);
        vault.deposit(amount, lp);
        market.setLiquidityVault(address(vault));
    }

    // -----------------------------------------------------------------
    // Capacity arithmetic
    // -----------------------------------------------------------------

    /// Capacity is the notional whose required reserve equals the backing on hand.
    function test_capacity_is_backing_divided_by_coverage_ratio() public {
        _fundVault(100_000e18);

        // A single market may reserve at most 50% of the pool: 50k. At a 75%
        // coverage ratio that backs 50k / 0.75 of notional.
        uint256 expected = (50_000e18 * 10000) / market.skewReserveBps();
        assertEq(market.maxNotionalCapacity(), expected);
    }

    /// A market with no vault has opted out of backing entirely; capping it at
    /// zero would freeze it rather than express that choice.
    function test_capacity_unbounded_without_a_vault() public view {
        assertEq(market.maxNotionalCapacity(), type(uint256).max);
    }

    function test_capacity_unbounded_when_coverage_ratio_is_zero() public {
        _fundVault(100_000e18);
        market.setSkewReserveBps(0);
        assertEq(market.maxNotionalCapacity(), type(uint256).max);
    }

    /// Raising the coverage ratio makes the same capital support less notional.
    function test_higher_coverage_ratio_shrinks_capacity() public {
        _fundVault(100_000e18);
        uint256 at75 = market.maxNotionalCapacity();
        market.setSkewReserveBps(10000);
        assertLt(market.maxNotionalCapacity(), at75);
    }

    function test_more_lp_capital_raises_capacity() public {
        _fundVault(100_000e18);
        uint256 before = market.maxNotionalCapacity();

        vm.prank(lp);
        vault.deposit(100_000e18, lp);

        assertGt(market.maxNotionalCapacity(), before);
    }

    // -----------------------------------------------------------------
    // Enforcement
    // -----------------------------------------------------------------

    /// The headline behaviour: a trade beyond capacity is refused up front with a
    /// capacity error, naming the limit it breached.
    function test_trade_beyond_capacity_is_refused_with_capacity_error() public {
        _fundVault(100_000e18);
        uint256 cap = market.maxNotionalCapacity();

        // Notional comfortably past the cap. The error reports the notional the
        // trade would have created, which is net of the trading fee — so it has to
        // be computed the same way, and computed BEFORE `expectRevert`, since a
        // view call in between would consume the cheatcode.
        uint256 collateral = cap;
        (uint256 fee,,,) = feeConfig.calculateFeeSplit(collateral);
        uint256 resultingNotional = (collateral - fee) * 3;

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                BreezePerpMarket.ExceedsNotionalCapacity.selector, resultingNotional, cap
            )
        );
        market.openPosition(true, collateral, 3);
    }

    /// Refusal must happen before any token moves. A rejected trade should not
    /// have touched the trader's balance or the fee sinks.
    function test_refusal_moves_no_tokens() public {
        _fundVault(100_000e18);
        uint256 cap = market.maxNotionalCapacity();

        uint256 traderBefore = token.balanceOf(alice);
        uint256 marketBefore = token.balanceOf(address(market));
        uint256 fundBefore = insuranceFund.balance();
        uint256 treasuryBefore = token.balanceOf(address(treasury));

        vm.prank(alice);
        vm.expectRevert();
        market.openPosition(true, cap, 3);

        assertEq(token.balanceOf(alice), traderBefore, "trader balance moved on a refused trade");
        assertEq(token.balanceOf(address(market)), marketBefore);
        assertEq(insuranceFund.balance(), fundBefore, "fees taken on a refused trade");
        assertEq(token.balanceOf(address(treasury)), treasuryBefore);
    }

    /// A trade exactly at capacity is admissible — the cap is a ceiling, not a
    /// strict inequality that wastes the last unit of capital.
    function test_trade_exactly_at_capacity_is_accepted() public {
        _fundVault(100_000e18);

        uint256 room = market.availableNotional(true);
        uint256 collateral = room / 3;

        vm.prank(alice);
        uint256 id = market.openPosition(true, collateral, 3);

        assertLe(
            market.worstCaseNotionalExposure(),
            market.maxNotionalCapacity(),
            "accepted trade left exposure above capacity"
        );
        (,,,,,,, bool isOpen) = market.positions(id);
        assertTrue(isOpen);
    }

    /// Once accepted, exposure must never sit above capacity — this is the
    /// property the reactive model could not guarantee.
    function test_exposure_never_exceeds_capacity_across_many_opens() public {
        _fundVault(200_000e18);

        for (uint256 i = 0; i < 30; i++) {
            address t = i % 2 == 0 ? alice : bob;
            vm.prank(t);
            try market.openPosition(i % 3 == 0, 20_000e18, 1 + (i % 3)) {} catch {}

            assertLe(
                market.worstCaseNotionalExposure(),
                market.maxNotionalCapacity(),
                "exposure escaped capacity"
            );
        }
    }

    // -----------------------------------------------------------------
    // The cap must not deadlock the market
    // -----------------------------------------------------------------

    /// Capacity shrinks when LPs leave, which can put an already-compliant book
    /// above the line through nobody's fault. Balancing trades must remain
    /// available or the book can never be repaired.
    function test_balancing_trade_allowed_when_book_is_already_over_capacity() public {
        _fundVault(400_000e18);

        vm.prank(alice);
        market.openPosition(true, 50_000e18, 3);

        // Collapse capacity below current exposure by raising the requirement.
        market.setSkewReserveBps(10000);
        vm.prank(lp);
        vault.requestWithdrawal();
        vm.warp(block.timestamp + vault.withdrawalCooldown());
        uint256 free = vault.maxRedeem(lp);
        if (free > 0) {
            vm.prank(lp);
            vault.redeem(free, lp, lp);
        }

        assertGt(
            market.worstCaseNotionalExposure(),
            market.maxNotionalCapacity(),
            "book is not actually over capacity - test is vacuous"
        );

        // A short does not raise worst-case exposure while longs dominate, so it
        // must be permitted even though the book is over the line.
        vm.prank(bob);
        uint256 id = market.openPosition(false, 20_000e18, 1);
        (,,,,,,, bool isOpen) = market.positions(id);
        assertTrue(isOpen, "balancing trade refused - market is deadlocked");
    }

    /// Growing the smaller side up to parity does not increase worst-case
    /// exposure, so `availableNotional` must report it as available.
    function test_available_notional_reports_room_to_parity_on_the_smaller_side() public {
        _fundVault(400_000e18);

        vm.prank(alice);
        market.openPosition(true, 50_000e18, 3);

        market.setSkewReserveBps(10000);
        assertGe(
            market.availableNotional(false),
            market.totalLongNotional() - market.totalShortNotional(),
            "no room reported to balance the book"
        );
    }

    /// Closing must never be gated by capacity. An exit is unconditional.
    function test_closing_is_never_blocked_by_capacity() public {
        _fundVault(400_000e18);

        vm.prank(alice);
        uint256 id = market.openPosition(true, 80_000e18, 3);

        // Strip the backing entirely.
        market.setSkewReserveBps(10000);
        market.setLiquidityVault(address(0));
        vault.setMarketAuthorization(address(market), false);

        vm.prank(alice);
        market.closePosition(id); // must not revert
        (,,,,,,, bool isOpen) = market.positions(id);
        assertFalse(isOpen);
    }

    // -----------------------------------------------------------------
    // Access control
    // -----------------------------------------------------------------

    function test_only_admin_can_change_coverage_ratio() public {
        vm.prank(alice);
        vm.expectRevert(BreezePerpMarket.UnauthorizedCaller.selector);
        market.setSkewReserveBps(5000);
    }

    function test_coverage_ratio_cannot_exceed_full_collateralisation() public {
        uint256 maxBps = market.MAX_SKEW_RESERVE_BPS();
        vm.expectRevert(BreezePerpMarket.InvalidParameter.selector);
        market.setSkewReserveBps(maxBps + 1);
    }
}
