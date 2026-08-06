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
import "../../src/perp/PerilExposureRegistry.sol";
import "../../src/perp/VirtualAMM.sol";
import "../../src/vault/BreezeLiquidityVault.sol";

contract PaToken is ERC20 {
    constructor() ERC20("Mock USDT", "mUSDT") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Correlated markets must not each fill their own capacity against one weather
/// event.
///
/// `maxNotionalCapacity()` bounds each market against the shared backing pool. Nothing
/// bounded the correlated SET: two rainfall markets on regions that see the same storm
/// could each take their full allowance, and the pool would look diversified while
/// holding one large bet. This is the control that replaced pool isolation — isolation
/// protects unrelated markets from each other, and weather markets are not unrelated.
///
/// Sized so the group cap is the binding constraint rather than each market's own
/// concentration limit, since otherwise a refusal proves nothing about aggregation.
contract PerilAggregationTest is Test {
    BreezeAccessControl accessControl;
    MockWeatherOracle oracle;
    FeeConfig feeConfig;
    ProtocolTreasury treasury;
    InsuranceFund insuranceFund;
    BreezeLiquidityVault vault;
    PerilExposureRegistry registry;
    PaToken token;

    BreezePerpMarket tokyo;
    BreezePerpMarket osaka;

    address admin = address(this);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address lp = address(0x11B);

    bytes32 constant TOKYO = keccak256("TOKYO_RAINFALL");
    bytes32 constant OSAKA = keccak256("OSAKA_RAINFALL");
    bytes32 constant JAPAN_RAIN = keccak256("PERIL_JAPAN_RAINFALL");
    bytes32 constant CHILE_RAIN = keccak256("PERIL_CHILE_RAINFALL");

    uint256 constant BACKING = 1_000_000e18;

    function setUp() public {
        accessControl = new BreezeAccessControl(admin);
        accessControl.grantRole(accessControl.ORACLE_UPDATER_ROLE(), admin);
        oracle = new MockWeatherOracle(address(accessControl));
        token = new PaToken();

        feeConfig = new FeeConfig(address(accessControl));
        treasury = new ProtocolTreasury(address(token), address(accessControl));
        insuranceFund = new InsuranceFund(address(token), address(accessControl));
        vault = new BreezeLiquidityVault(token, address(accessControl), "Breeze LP", "bLP");
        registry = new PerilExposureRegistry(address(accessControl), address(vault));

        tokyo = _market(TOKYO);
        osaka = _market(OSAKA);

        token.mint(alice, 5_000_000e18);
        token.mint(bob, 5_000_000e18);
        token.mint(lp, 5_000_000e18);
        vm.startPrank(alice);
        token.approve(address(tokyo), type(uint256).max);
        token.approve(address(osaka), type(uint256).max);
        vm.stopPrank();
        vm.startPrank(bob);
        token.approve(address(tokyo), type(uint256).max);
        token.approve(address(osaka), type(uint256).max);
        vm.stopPrank();
        vm.prank(lp);
        token.approve(address(vault), type(uint256).max);

        vm.prank(lp);
        vault.deposit(BACKING, lp);

        tokyo.setLiquidityVault(address(vault));
        osaka.setLiquidityVault(address(vault));

        oracle.setReading(TOKYO, block.timestamp, 25e6);
        oracle.setReading(OSAKA, block.timestamp, 25e6);
    }

    function _market(bytes32 region) internal returns (BreezePerpMarket m) {
        m = new BreezePerpMarket(
            VirtualAMM.Reserves({collateralReserve: 20_000_000e18, weatherReserve: 800_000e18}),
            address(oracle),
            address(insuranceFund),
            address(feeConfig),
            address(treasury),
            address(accessControl),
            address(token),
            region
        );
        insuranceFund.setMarketAuthorization(address(m), true);
        vault.setMarketAuthorization(address(m), true);

        // Skew cap off, so a refusal is unambiguously the capacity or peril cap. And the
        // capacity surcharge off, so notional arithmetic stays exact — it is measured in
        // `PerpCapacityPricingTest`, not here.
        m.setMaxSkew(0);
        m.setUtilizationFeeBps(0);
    }

    /// Put both markets under one registry, grouped as declared.
    function _register(bytes32 tokyoGroup, bytes32 osakaGroup) internal {
        registry.setMarketRegistration(address(tokyo), true);
        registry.setMarketRegistration(address(osaka), true);
        registry.setPerilGroup(TOKYO, tokyoGroup);
        registry.setPerilGroup(OSAKA, osakaGroup);
        tokyo.setPerilRegistry(address(registry));
        osaka.setPerilRegistry(address(registry));
    }

    function _open(BreezePerpMarket m, address who, uint256 collateral)
        internal
        returns (uint256)
    {
        vm.prank(who);
        return m.openPosition(true, collateral, 3);
    }

    // =================================================================
    // The gap being closed
    // =================================================================

    /// Without a registry, the second market's own capacity is all that stops it — and
    /// its own capacity knows nothing about the first market's exposure to the same peril.
    function test_without_a_registry_correlated_markets_each_fill_their_own_capacity()
        public
    {
        _open(tokyo, alice, 200_000e18);
        assertGt(tokyo.requiredVaultReserve(), 0);

        // Osaka accepts a position of the same size, against the same storm.
        _open(osaka, bob, 200_000e18);

        uint256 combined = tokyo.requiredVaultReserve() + osaka.requiredVaultReserve();
        console.log("combined reserve, no registry :", combined);
        console.log("40% of backing                :", (BACKING * 4000) / 10000);
        assertGt(
            combined,
            (BACKING * 4000) / 10000,
            "the two markets did not exceed a single peril's cap - test proves nothing"
        );
    }

    /// With one, the same second trade is refused.
    function test_group_cap_refuses_the_second_correlated_market() public {
        _register(JAPAN_RAIN, JAPAN_RAIN);

        _open(tokyo, alice, 200_000e18);
        uint256 committed = tokyo.requiredVaultReserve();
        assertGt(committed, 0);

        // Osaka's OWN capacity would still allow this — its concentration limit is 50% of
        // the pool and it has reserved nothing.
        assertGt(osaka.maxNotionalCapacity(), 299_700e18, "own capacity is not the loose limit");

        // The group's does not: 40% of backing, less what Tokyo already holds.
        uint256 room = registry.availableGroupReserve(address(osaka));
        assertEq(room, (BACKING * 4000) / 10000 - committed);
        assertEq(osaka.maxPerilNotionalCapacity(), (room * 10000) / osaka.skewReserveBps());
        assertLt(
            osaka.effectiveNotionalCapacity(),
            osaka.maxNotionalCapacity(),
            "the peril cap is not binding"
        );

        vm.prank(bob);
        vm.expectRevert();
        osaka.openPosition(true, 100_000e18, 3);
    }

    /// And a smaller trade that fits inside the group's remaining room is accepted, so the
    /// cap rations rather than freezes.
    function test_a_trade_inside_the_remaining_group_room_is_accepted() public {
        _register(JAPAN_RAIN, JAPAN_RAIN);
        _open(tokyo, alice, 200_000e18);

        uint256 room = osaka.availableNotional(true);
        assertGt(room, 0, "no room left at all - test is vacuous");

        _open(osaka, bob, 60_000e18);
        assertGt(osaka.worstCaseNotionalExposure(), 0);
        assertLe(osaka.worstCaseNotionalExposure(), room + 1);
    }

    /// Grouping has to be what does the work. Declaring the two regions as separate perils
    /// lets both trade — otherwise the cap is just a tighter global limit wearing a
    /// correlation costume.
    function test_uncorrelated_markets_are_not_pooled_together() public {
        _register(JAPAN_RAIN, CHILE_RAIN);

        _open(tokyo, alice, 200_000e18);

        // The exact trade the same-group case refused.
        _open(osaka, bob, 100_000e18);

        assertGt(osaka.requiredVaultReserve(), 0, "the second market was still refused");
        assertEq(registry.perilGroupOfMarket(address(tokyo)), JAPAN_RAIN);
        assertEq(registry.perilGroupOfMarket(address(osaka)), CHILE_RAIN);
    }

    /// The aggregate cap bounds the sum of the groups, since group caps alone say nothing
    /// about their total.
    function test_aggregate_cap_binds_across_separate_groups() public {
        _register(JAPAN_RAIN, CHILE_RAIN);
        // Tighten the aggregate below the sum of two full groups. 4500 was not enough —
        // it left 150,300 of room against a 149,850 requirement, so the trade squeezed
        // through and the test passed while proving nothing.
        registry.setExposureCaps(4000, 4200);

        _open(tokyo, alice, 200_000e18);
        uint256 committed = tokyo.requiredVaultReserve();

        uint256 room = registry.availableGroupReserve(address(osaka));
        assertEq(
            room,
            (BACKING * 4200) / 10000 - committed,
            "aggregate cap did not bind for the other group"
        );
        assertLt(
            room,
            (BACKING * 4000) / 10000,
            "the group cap is still the binding one - test measures the wrong limit"
        );

        vm.prank(bob);
        vm.expectRevert();
        osaka.openPosition(true, 100_000e18, 3);
    }

    // =================================================================
    // Defaults and degradation
    // =================================================================

    /// An unconfigured region maps to group zero, which puts every unconfigured market in
    /// ONE bucket. Unknown correlation is treated as full correlation, so forgetting to
    /// declare a peril tightens the book rather than silently removing the cap.
    function test_unconfigured_regions_are_treated_as_one_correlated_group() public {
        registry.setMarketRegistration(address(tokyo), true);
        registry.setMarketRegistration(address(osaka), true);
        tokyo.setPerilRegistry(address(registry));
        osaka.setPerilRegistry(address(registry));

        assertEq(registry.perilGroupOfMarket(address(tokyo)), bytes32(0));
        assertEq(registry.perilGroupOfMarket(address(osaka)), bytes32(0));

        _open(tokyo, alice, 200_000e18);

        vm.prank(bob);
        vm.expectRevert();
        osaka.openPosition(true, 100_000e18, 3);
    }

    /// A market with no registry behaves exactly as it did before.
    function test_no_registry_leaves_capacity_untouched() public view {
        assertEq(tokyo.maxPerilNotionalCapacity(), type(uint256).max);
        assertEq(tokyo.effectiveNotionalCapacity(), tokyo.maxNotionalCapacity());
    }

    /// A market that has opted out of backing has no capital commitment to aggregate, so
    /// a group cap over it would be measuring nothing.
    function test_zero_coverage_ratio_disables_the_peril_cap() public {
        _register(JAPAN_RAIN, JAPAN_RAIN);
        osaka.setSkewReserveBps(0);
        assertEq(osaka.maxPerilNotionalCapacity(), type(uint256).max);
        assertEq(osaka.effectiveNotionalCapacity(), type(uint256).max);
    }

    /// A registry that reverts must not be able to stop trading. The cap is a control on
    /// declared correlation, not a proof of total correlation, and a misconfiguration
    /// should not be a market-wide halt.
    function test_a_broken_registry_does_not_block_trading() public {
        // An address with no code: every call reverts.
        tokyo.setPerilRegistry(address(0xDEAD));
        assertEq(tokyo.maxPerilNotionalCapacity(), type(uint256).max);
        _open(tokyo, alice, 100_000e18);
        assertGt(tokyo.requiredVaultReserve(), 0);
    }

    /// A market pointing at something that cannot report its reserve counts as zero,
    /// which is the permissive direction and is stated as such rather than assumed away.
    function test_an_unreadable_market_counts_as_zero_exposure() public {
        registry.setMarketRegistration(address(0xDEAD), true);
        assertEq(registry.aggregateReserve(), 0);
        assertEq(registry.perilGroupOfMarket(address(0xDEAD)), bytes32(0));
    }

    // =================================================================
    // Exits and repair
    // =================================================================

    /// Closing must never be gated by an aggregate cap — it is the action that relieves it.
    function test_closing_is_never_blocked_by_the_peril_cap() public {
        _register(JAPAN_RAIN, JAPAN_RAIN);
        uint256 id = _open(tokyo, alice, 200_000e18);

        // Tighten until the book is over its own cap.
        registry.setExposureCaps(1000, 1000);
        assertLt(tokyo.effectiveNotionalCapacity(), tokyo.worstCaseNotionalExposure());

        vm.prank(alice);
        tokyo.closePosition(id);
        assertEq(tokyo.worstCaseNotionalExposure(), 0);
    }

    /// A book over its cap must still be repairable, or tightening the cap deadlocks the
    /// market one-way until the crowded side happens to unwind.
    function test_a_balancing_trade_is_allowed_while_over_the_cap() public {
        _register(JAPAN_RAIN, JAPAN_RAIN);
        _open(tokyo, alice, 200_000e18);

        registry.setExposureCaps(1000, 1000);
        assertLt(tokyo.effectiveNotionalCapacity(), tokyo.worstCaseNotionalExposure());

        // Growing the smaller side does not raise worst-case exposure, so it is permitted.
        uint256 before = tokyo.worstCaseNotionalExposure();
        vm.prank(bob);
        tokyo.openPosition(false, 50_000e18, 3);
        assertEq(tokyo.worstCaseNotionalExposure(), before, "worst case moved on a balancing trade");
    }

    /// Freeing a peer's exposure returns the room to the group, since exposure is pulled
    /// live rather than mirrored in registry state.
    function test_room_returns_when_a_peer_closes() public {
        _register(JAPAN_RAIN, JAPAN_RAIN);
        uint256 id = _open(tokyo, alice, 200_000e18);

        uint256 constrained = registry.availableGroupReserve(address(osaka));
        vm.prank(alice);
        tokyo.closePosition(id);
        uint256 released = registry.availableGroupReserve(address(osaka));

        assertGt(released, constrained, "room did not return after the peer closed");

        // Approximate, not exact. Backing is not quite `BACKING` any more — the round trip
        // paid trading fees out of the market and swept the residue to the vault, so the
        // pool the cap is a share of has moved by a few wei.
        assertApproxEqAbs(released, (BACKING * 4000) / 10000, 1e15);
    }

    /// Deregistering a market removes it from the aggregation.
    function test_deregistering_removes_a_market_from_the_group() public {
        _register(JAPAN_RAIN, JAPAN_RAIN);
        _open(tokyo, alice, 200_000e18);

        uint256 withPeer = registry.availableGroupReserve(address(osaka));
        registry.setMarketRegistration(address(tokyo), false);
        assertGt(registry.availableGroupReserve(address(osaka)), withPeer);
        assertFalse(registry.isRegistered(address(tokyo)));
    }

    // =================================================================
    // Bounds and access
    // =================================================================

    /// The pull loop is over governance-registered markets and must stay bounded — the
    /// mistake `openPositionObligations` made was iterating something users could inflate.
    function test_registered_market_count_is_capped() public {
        uint256 cap = registry.MAX_MARKETS();
        for (uint256 i = registry.registeredMarketCount(); i < cap; i++) {
            registry.setMarketRegistration(address(uint160(0x70000 + i)), true);
        }
        assertEq(registry.registeredMarketCount(), cap);

        vm.expectRevert(abi.encodeWithSelector(PerilExposureRegistry.TooManyMarkets.selector, cap));
        registry.setMarketRegistration(address(0xBEEF), true);
    }

    function test_exposure_caps_are_bounded() public {
        uint256 ceiling = registry.MAX_GROUP_EXPOSURE_CEILING_BPS();

        vm.expectRevert(PerilExposureRegistry.InvalidParameter.selector);
        registry.setExposureCaps(0, 8000);

        vm.expectRevert(PerilExposureRegistry.InvalidParameter.selector);
        registry.setExposureCaps(ceiling + 1, 10000);

        vm.expectRevert(PerilExposureRegistry.InvalidParameter.selector);
        registry.setExposureCaps(4000, 10001);

        // A group cap above the aggregate cap is incoherent — the group could never fill.
        vm.expectRevert(PerilExposureRegistry.InvalidParameter.selector);
        registry.setExposureCaps(5000, 4000);

        registry.setExposureCaps(3000, 6000);
        assertEq(registry.maxGroupExposureBps(), 3000);
        assertEq(registry.maxAggregateExposureBps(), 6000);
    }

    function test_only_admin_can_configure_the_registry() public {
        vm.startPrank(alice);
        vm.expectRevert(PerilExposureRegistry.UnauthorizedCaller.selector);
        registry.setMarketRegistration(address(tokyo), true);
        vm.expectRevert(PerilExposureRegistry.UnauthorizedCaller.selector);
        registry.setPerilGroup(TOKYO, JAPAN_RAIN);
        vm.expectRevert(PerilExposureRegistry.UnauthorizedCaller.selector);
        registry.setExposureCaps(3000, 6000);
        vm.expectRevert(PerilExposureRegistry.UnauthorizedCaller.selector);
        registry.setLiquidityVault(address(vault));
        vm.stopPrank();
    }

    function test_only_admin_can_point_a_market_at_a_registry() public {
        vm.prank(alice);
        vm.expectRevert(BreezePerpMarket.UnauthorizedCaller.selector);
        tokyo.setPerilRegistry(address(registry));
    }

    /// Group membership follows the market's own `regionId`, so a market cannot be
    /// registered under a peril that contradicts what it actually trades.
    function test_group_follows_the_markets_own_region() public {
        registry.setPerilGroup(TOKYO, JAPAN_RAIN);
        assertEq(registry.perilGroupOfMarket(address(tokyo)), JAPAN_RAIN);
        assertEq(registry.perilGroupOfMarket(address(osaka)), bytes32(0));

        registry.setPerilGroup(OSAKA, JAPAN_RAIN);
        assertEq(registry.perilGroupOfMarket(address(osaka)), JAPAN_RAIN);
    }
}
