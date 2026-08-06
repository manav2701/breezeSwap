// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../src/access/BreezeAccessControl.sol";
import "../../src/vault/BreezeLiquidityVault.sol";
import "../../src/vault/JuniorTranche.sol";

contract JlToken is ERC20 {
    constructor() ERC20("Mock USDT", "mUSDT") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Two halves of one finding.
///
/// `WaterfallMonteCarloTest` holds total LP capital constant and carves the junior
/// tranche out of it. Measured that way the waterfall beat the flat pool on 4 of 5
/// seeds but LOST on the mean, because a senior tranche 25% thinner moves 25%
/// further per unit of residual loss once junior is exhausted. Tranching
/// redistributes loss; it does not reduce it.
///
/// So two things had to change:
///
///   1. Junior capital must be ADDITIVE. A vault cannot see where a deposit came
///      from, but it can decide whether junior capital BUYS CAPACITY — and capping
///      the share it may make up means shifting senior LPs into junior earns nothing.
///   2. Junior must cover a DEFINED BAND rather than an open-ended first slice, so
///      its exposure is bounded in time and therefore priceable. That is a genuine
///      trade-off, not a free win: loss above the exhaustion point lands on senior.
contract JuniorLayerTest is Test {
    BreezeAccessControl accessControl;
    JlToken token;
    BreezeLiquidityVault vault;
    JuniorTranche junior;

    address admin = address(this);
    address seniorLp = address(0xA11CE);
    address juniorLp = address(0x104E);
    address market = address(0x1EA5E);

    function setUp() public {
        vm.warp(1_700_000_000);
        accessControl = new BreezeAccessControl(admin);
        token = new JlToken();
        vault = new BreezeLiquidityVault(token, address(accessControl), "Breeze LP", "bLP");
        junior = new JuniorTranche(token, address(accessControl), "Breeze Junior", "bJNR");

        vault.setJuniorTranche(address(junior));
        junior.setSeniorVault(address(vault));
        vault.setMarketAuthorization(market, true);

        address[4] memory actors = [seniorLp, juniorLp, market, admin];
        for (uint256 i = 0; i < actors.length; i++) {
            token.mint(actors[i], 10_000_000e18);
            vm.startPrank(actors[i]);
            token.approve(address(vault), type(uint256).max);
            token.approve(address(junior), type(uint256).max);
            vm.stopPrank();
        }
    }

    function _senior(uint256 amount) internal {
        vm.prank(seniorLp);
        vault.deposit(amount, seniorLp);
    }

    function _junior(uint256 amount) internal {
        vm.prank(juniorLp);
        junior.deposit(amount, juniorLp);
    }

    function _cover(uint256 amount) internal returns (uint256) {
        vm.prank(market);
        return vault.coverLoss(amount);
    }

    // =================================================================
    // Additive capital
    // =================================================================

    /// The headline claim. Same total capital, two arrangements: capacity must never
    /// be higher for the arrangement that thins the senior tranche.
    function test_shifting_senior_capital_into_junior_cannot_buy_capacity() public {
        _senior(140_000e18);
        uint256 allSenior = vault.totalBackingAssets();

        // Rebuild the same 140k as a 50/50 split, which puts junior far above its
        // permitted share of backing.
        setUp();
        _senior(70_000e18);
        _junior(70_000e18);
        uint256 split = vault.totalBackingAssets();

        console.log("backing, 140k all senior :", allSenior);
        console.log("backing, 70k + 70k split :", split);

        assertLe(split, allSenior, "thinning senior bought capacity");
        assertLt(split, allSenior, "a 50/50 split was treated as equivalent to all-senior");
        assertLe(vault.juniorBackingShareBps(), vault.maxJuniorBackingShareBps());
    }

    /// And the incentive the right way round: genuinely new subordinated capital
    /// does enlarge the protocol.
    function test_new_junior_capital_enlarges_capacity() public {
        _senior(100_000e18);
        uint256 before = vault.totalBackingAssets();

        _junior(30_000e18);

        assertEq(
            vault.totalBackingAssets(),
            before + 30_000e18,
            "new junior capital bought no capacity at all"
        );
        assertEq(vault.juniorUncreditedBacking(), 0);
    }

    function test_junior_beyond_the_share_cap_stops_counting() public {
        _senior(100_000e18);
        _junior(200_000e18);

        uint256 credited = vault.juniorBackingCredited();
        assertLt(credited, 200_000e18, "the whole junior balance was credited");
        assertEq(vault.juniorUncreditedBacking(), 200_000e18 - credited);

        uint256 countedBefore = vault.totalBackingAssets();
        _junior(500_000e18);
        assertEq(
            vault.totalBackingAssets(),
            countedBefore,
            "piling on junior capital kept inflating capacity"
        );
    }

    /// Uncredited junior capital backs nothing, so it cannot be holding anything up.
    /// Trapping it would be a defect introduced by the cap itself.
    function test_uncredited_junior_capital_stays_withdrawable() public {
        _senior(100_000e18);
        _junior(200_000e18);

        // Reserve everything the pool will allow, so the shared free amount is zero.
        uint256 room = vault.reservableByMarket(market);
        vm.prank(market);
        vault.reserve(room);
        // Dust, not headroom: `minRequiredAssets` rounds the floor UP, so the last
        // wei or two is never reservable. What matters is that nothing of substance
        // is free, or the withdrawal below would succeed for the wrong reason.
        assertLt(vault.freeBackingAssets(), 1e18, "pool still had headroom - test is vacuous");

        uint256 uncredited = vault.juniorUncreditedBacking();
        assertGt(uncredited, 0);
        assertGe(
            junior.availableLiquidity(),
            uncredited,
            "junior capital that backs nothing was trapped by the utilisation floor"
        );

        vm.prank(juniorLp);
        junior.requestWithdrawal();
        vm.warp(block.timestamp + junior.withdrawalCooldown());
        vm.prank(juniorLp);
        junior.withdraw(uncredited, juniorLp, juniorLp);
        assertEq(token.balanceOf(juniorLp), 10_000_000e18 - 200_000e18 + uncredited);
    }

    /// Junior is still paid on its full balance. It bears first loss on the whole
    /// amount, so withholding yield from the uncredited part would take the risk and
    /// not pay for it.
    function test_uncredited_junior_capital_is_still_paid() public {
        _senior(100_000e18);
        _junior(200_000e18);

        assertGt(vault.juniorUncreditedBacking(), 0, "no uncredited capital - test is vacuous");

        uint256 cut = vault.juniorProfitShare(10_000e18);
        // Weighted on 200k at 2x against 100k senior at 1x => 400/500 of the profit.
        assertEq(cut, (10_000e18 * 400_000) / 500_000);
    }

    /// A hole the share cap opened, and the reason `minRequiredSeniorAssets` exists.
    ///
    /// Once junior is oversubscribed, credited junior capital is `senior * k` — a
    /// FUNCTION of senior assets. So a senior withdrawal of W removes W of senior
    /// backing and another `W * k` of credited junior backing. Sizing senior's exit
    /// off the shared free amount let a bank run drain counted backing by roughly
    /// 1.5x the headroom that actually existed, straight through the utilisation
    /// floor. `NightmareScenariosTest.test_S2` caught it; this pins it down.
    function test_senior_exit_accounts_for_its_effect_on_credited_junior() public {
        _senior(100_000e18);
        _junior(200_000e18);

        vm.prank(market);
        vault.reserve(60_000e18);

        uint256 floorAssets = vault.minRequiredAssets();
        assertGt(vault.juniorUncreditedBacking(), 0, "junior is not oversubscribed - test is vacuous");

        // The naive figure. Withdrawing this much would breach the floor, because it
        // takes credited junior capital down with it.
        uint256 naive = vault.freeBackingAssets();
        uint256 allowed = vault.availableLiquidity();
        assertLt(allowed, naive, "senior exit is still sized off the shared free amount");

        vm.prank(seniorLp);
        vault.requestWithdrawal();
        vm.warp(block.timestamp + vault.withdrawalCooldown());
        vm.prank(seniorLp);
        vault.withdraw(allowed, seniorLp, seniorLp);

        console.log("floor required   :", floorAssets);
        console.log("naive free       :", naive);
        console.log("actually allowed :", allowed);
        console.log("backing after    :", vault.totalBackingAssets());

        assertGe(
            vault.totalBackingAssets(),
            floorAssets,
            "senior exit drained counted backing below the utilisation floor"
        );

        // And it must not be over-restrictive either: the pool should now be sitting
        // essentially on the floor, not well above it.
        assertLt(
            vault.totalBackingAssets() - floorAssets,
            1_000e18,
            "senior exit left far more retained than the floor requires"
        );
    }

    function test_share_cap_is_bounded() public {
        vm.expectRevert(BreezeLiquidityVault.InvalidJuniorBackingShare.selector);
        vault.setMaxJuniorBackingShareBps(0);

        vm.expectRevert(BreezeLiquidityVault.InvalidJuniorBackingShare.selector);
        vault.setMaxJuniorBackingShareBps(5001);

        vault.setMaxJuniorBackingShareBps(5000);
        assertEq(vault.maxJuniorBackingShareBps(), 5000);
    }

    /// At the 5000 ceiling the two tranches are the same size, and the arithmetic
    /// must not divide by zero getting there.
    function test_share_cap_at_its_ceiling_credits_parity() public {
        vault.setMaxJuniorBackingShareBps(5000);
        _senior(100_000e18);
        _junior(400_000e18);

        assertEq(vault.juniorBackingCredited(), 100_000e18);
        assertEq(vault.totalBackingAssets(), 200_000e18);
        assertEq(vault.juniorBackingShareBps(), 5000);
    }

    // =================================================================
    // The layer band
    // =================================================================

    function test_layer_reports_its_band_in_assets() public {
        _senior(100_000e18);
        _junior(40_000e18);

        uint256 basis = vault.totalBackingAssets(); // 140k
        assertEq(junior.effectiveLayerBasis(), basis);
        assertEq(junior.layerWidthBps(), junior.exhaustionBps() - junior.attachmentBps());
        assertEq(junior.attachmentPoint(), (basis * junior.attachmentBps()) / 10000);
        assertEq(junior.exhaustionPoint(), (basis * junior.exhaustionBps()) / 10000);
        assertEq(junior.layerLimit(), (basis * junior.layerWidthBps()) / 10000);
    }

    /// The trade-off, stated as a test. Junior stops paying at its exhaustion point
    /// even though it still holds capital, and the residual goes to senior.
    function test_loss_above_the_exhaustion_point_lands_on_senior() public {
        _senior(100_000e18);
        _junior(40_000e18);

        uint256 limit = junior.layerLimit();
        assertLt(limit, 40_000e18, "layer limit does not bind - test proves nothing");

        uint256 seniorBefore = vault.totalAssets();
        uint256 juniorBefore = junior.backingAssets();

        _cover(50_000e18);

        uint256 juniorLoss = juniorBefore - junior.backingAssets();
        uint256 seniorLoss = seniorBefore - vault.totalAssets();

        console.log("layer limit  :", limit);
        console.log("junior loss  :", juniorLoss);
        console.log("senior loss  :", seniorLoss);

        assertEq(juniorLoss, limit, "junior paid something other than its layer limit");
        assertEq(seniorLoss, 50_000e18 - limit, "senior did not take the residual");
        assertGt(
            junior.backingAssets(),
            0,
            "junior was drained anyway - the band was not enforced"
        );
    }

    /// Without the band this is what happens instead, and it is the behaviour the
    /// band replaces: junior absorbs to zero and its exposure has no bound.
    function test_a_full_width_band_reproduces_absorb_until_empty() public {
        junior.setLayerParams(0, 10000, 365 days);
        _senior(100_000e18);
        _junior(40_000e18);

        _cover(50_000e18);
        assertEq(junior.backingAssets(), 0, "full-width band did not exhaust junior");
    }

    /// The aggregate limit is what makes the exposure priceable: a long series of
    /// small losses must not grind the tranche past its band.
    function test_repeated_small_losses_respect_the_aggregate_limit() public {
        _senior(200_000e18);
        _junior(80_000e18);

        uint256 limit = junior.layerLimit();
        uint256 juniorBefore = junior.backingAssets();

        for (uint256 i = 0; i < 40; i++) {
            vm.warp(block.timestamp + 3 days);
            _cover(3_000e18);
        }

        uint256 absorbed = juniorBefore - junior.backingAssets();
        console.log("aggregate limit :", limit);
        console.log("absorbed        :", absorbed);

        assertGt(absorbed, 0, "junior absorbed nothing across 40 losses");
        assertLe(absorbed, limit, "a drip of small losses walked through the aggregate limit");
        assertEq(junior.layerRemaining(), limit - absorbed);
    }

    /// The basis is snapshotted, not live. A basis that shrank as the layer paid
    /// would be a limit that tightens exactly when it is being used.
    function test_layer_basis_does_not_shrink_as_the_layer_pays() public {
        _senior(200_000e18);
        _junior(80_000e18);

        _cover(5_000e18); // starts the period
        uint256 basis = junior.layerBasis();
        uint256 limit = junior.layerLimit();
        assertGt(basis, 0);

        _cover(20_000e18);

        assertEq(junior.layerBasis(), basis, "basis moved mid-period");
        assertEq(junior.layerLimit(), limit, "limit moved mid-period");
    }

    function test_limit_resets_when_the_period_rolls() public {
        _senior(200_000e18);
        _junior(80_000e18);

        uint256 limit = junior.layerLimit();
        _cover(limit + 10_000e18); // consume the whole band
        assertEq(junior.layerRemaining(), 0);

        // Inside the period junior is done paying.
        uint256 held = junior.backingAssets();
        _cover(10_000e18);
        assertEq(junior.backingAssets(), held, "junior paid past an exhausted band");

        vm.warp(block.timestamp + junior.layerPeriod());
        assertGt(junior.layerRemaining(), 0, "period never rolled");

        _cover(5_000e18);
        assertLt(junior.backingAssets(), held, "junior did not resume paying in the new period");
    }

    /// The views must agree with what a draw would actually do, or an LP sizing
    /// their risk from them is reading fiction.
    function test_absorbable_now_matches_what_a_draw_obtains() public {
        _senior(100_000e18);
        _junior(40_000e18);

        uint256 predicted = junior.absorbableNow();
        uint256 juniorBefore = junior.backingAssets();

        _cover(500_000e18); // ask for far more than either constraint allows

        assertEq(juniorBefore - junior.backingAssets(), predicted, "views disagreed with the draw");
    }

    /// When assets rather than the band are the binding constraint, the draw is
    /// clamped by assets — both limits are real.
    function test_assets_bind_when_they_are_smaller_than_the_band() public {
        _senior(400_000e18);
        _junior(10_000e18);

        assertGt(junior.layerLimit(), 10_000e18, "band is the tighter limit - test is vacuous");
        assertEq(junior.absorbableNow(), 10_000e18);

        _cover(50_000e18);
        assertEq(junior.backingAssets(), 0);
    }

    // =================================================================
    // Layer parameters
    // =================================================================

    function test_layer_params_are_bounded() public {
        // Exhaustion must sit above attachment, or the band is empty or inverted.
        vm.expectRevert(JuniorTranche.InvalidLayer.selector);
        junior.setLayerParams(3000, 3000, 365 days);

        vm.expectRevert(JuniorTranche.InvalidLayer.selector);
        junior.setLayerParams(3000, 2000, 365 days);

        vm.expectRevert(JuniorTranche.InvalidLayer.selector);
        junior.setLayerParams(0, 10001, 365 days);

        vm.expectRevert(JuniorTranche.InvalidLayer.selector);
        junior.setLayerParams(0, 5000, 29 days);

        vm.expectRevert(JuniorTranche.InvalidLayer.selector);
        junior.setLayerParams(0, 5000, 1096 days);
    }

    /// A band change is a change to what junior LPs agreed to cover, so it starts a
    /// fresh period rather than reinterpreting loss already absorbed.
    function test_changing_the_band_starts_a_fresh_period() public {
        _senior(200_000e18);
        _junior(80_000e18);
        _cover(20_000e18);
        assertGt(junior.layerConsumed(), 0);

        junior.setLayerParams(500, 3000, 180 days);

        assertEq(junior.layerConsumed(), 0, "consumption carried into the new band");
        assertEq(junior.layerStart(), block.timestamp);
        assertEq(junior.layerBasis(), vault.totalBackingAssets());
        assertEq(junior.layerRemaining(), junior.layerLimit());
    }

    function test_only_admin_can_set_the_band() public {
        vm.prank(seniorLp);
        vm.expectRevert(JuniorTranche.UnauthorizedCaller.selector);
        junior.setLayerParams(0, 5000, 365 days);
    }

    /// With no senior vault the layer still has to be well defined, or a standalone
    /// deployment silently has a zero band.
    function test_standalone_tranche_sizes_its_band_on_its_own_capital() public {
        JuniorTranche solo = new JuniorTranche(token, address(accessControl), "Solo", "sJNR");
        token.mint(juniorLp, 100_000e18);
        vm.startPrank(juniorLp);
        token.approve(address(solo), type(uint256).max);
        solo.deposit(100_000e18, juniorLp);
        vm.stopPrank();

        assertEq(solo.effectiveLayerBasis(), 100_000e18);
        assertEq(solo.layerLimit(), (100_000e18 * solo.layerWidthBps()) / 10000);
    }
}
