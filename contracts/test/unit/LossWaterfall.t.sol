// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../src/access/BreezeAccessControl.sol";
import "../../src/vault/BreezeLiquidityVault.sol";
import "../../src/vault/JuniorTranche.sol";
import "../../src/perp/InsuranceFund.sol";

contract WaterfallToken is ERC20 {
    constructor() ERC20("Mock USDT", "mUSDT") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// Tests the three-tier loss waterfall end to end: insurance fund, then junior
/// tranche, then senior LPs. The properties that matter are ORDER (a tier is
/// never touched while a tier above it has capital) and COMPENSATION (the tranche
/// taking first loss earns strictly more than the one it protects).
contract LossWaterfallTest is Test {
    BreezeAccessControl accessControl;
    WaterfallToken token;
    BreezeLiquidityVault vault;
    JuniorTranche junior;
    InsuranceFund fund;

    address admin = address(this);
    address pauser = address(0x1111);
    address seniorLp = address(0x5E01);
    address juniorLp = address(0x104E);
    address market = address(0x1EA5E);
    address funder = address(0xF00D);

    function setUp() public {
        accessControl = new BreezeAccessControl(admin);
        accessControl.grantRole(accessControl.PAUSER_ROLE(), pauser);

        token = new WaterfallToken();
        vault = new BreezeLiquidityVault(token, address(accessControl), "Breeze LP", "bLP");
        junior = new JuniorTranche(token, address(accessControl), "Breeze Junior", "bJNR");
        fund = new InsuranceFund(address(token), address(accessControl));

        // Wire the waterfall.
        vault.setJuniorTranche(address(junior));
        vault.setFirstLossFund(address(fund));
        junior.setSeniorVault(address(vault));

        // The vault draws tier 1, so it must be an authorised drawer on the fund.
        fund.setMarketAuthorization(address(vault), true);
        vault.setMarketAuthorization(market, true);

        address[5] memory actors = [seniorLp, juniorLp, market, funder, admin];
        for (uint256 i = 0; i < actors.length; i++) {
            token.mint(actors[i], 10_000_000e18);
            vm.startPrank(actors[i]);
            token.approve(address(vault), type(uint256).max);
            token.approve(address(junior), type(uint256).max);
            token.approve(address(fund), type(uint256).max);
            vm.stopPrank();
        }
    }

    function _fundTier1(uint256 amount) internal {
        vm.prank(funder);
        fund.deposit(amount);
    }

    function _depositSenior(uint256 amount) internal {
        vm.prank(seniorLp);
        vault.deposit(amount, seniorLp);
    }

    function _depositJunior(uint256 amount) internal {
        vm.prank(juniorLp);
        junior.deposit(amount, juniorLp);
    }

    function _coverLoss(uint256 amount) internal returns (uint256) {
        vm.prank(market);
        return vault.coverLoss(amount);
    }

    /// @dev Remove the junior layer's per-period band from the picture, so a test can
    /// assert tier ORDERING without also encoding a calibrated width.
    ///
    /// Junior now covers a defined band rather than absorbing until empty, and the
    /// width is calibrated (currently 2%–10% of backing). A test about ordering that
    /// hardcodes amounts is really testing the width, and would need re-tuning on
    /// every recalibration — which is the fastest way to end up with numbers edited to
    /// match the code. `JuniorLayerTest` owns the band; these tests own the ordering.
    function _pinBandWideOpen() internal {
        junior.setLayerParams(0, 10000, 365 days);
    }

    // -----------------------------------------------------------------
    // Tier ordering
    // -----------------------------------------------------------------

    /// The whole point of tier 1: a loss small enough for protocol capital never
    /// reaches a depositor at all.
    function test_tier1_absorbs_loss_alone() public {
        _fundTier1(10_000e18);
        _depositSenior(100_000e18);
        _depositJunior(50_000e18);

        uint256 covered = _coverLoss(6_000e18);

        assertEq(covered, 6_000e18, "loss not fully covered");
        assertEq(fund.balance(), 4_000e18, "tier 1 not drawn");
        assertEq(junior.totalAssets(), 50_000e18, "junior touched while tier 1 had capital");
        assertEq(vault.totalAssets(), 100_000e18, "senior touched while tier 1 had capital");
    }

    /// Tier 2 begins only where tier 1 runs out, and senior is still untouched.
    function test_tier2_absorbs_only_the_residual() public {
        _pinBandWideOpen();
        _fundTier1(10_000e18);
        _depositSenior(100_000e18);
        _depositJunior(50_000e18);

        uint256 covered = _coverLoss(30_000e18);

        assertEq(covered, 30_000e18);
        assertEq(fund.balance(), 0, "tier 1 not exhausted first");
        assertEq(junior.totalAssets(), 30_000e18, "junior absorbed the wrong amount");
        assertEq(vault.totalAssets(), 100_000e18, "senior lost value while junior had capital");
    }

    /// Senior takes loss only once both tiers above it are EXHAUSTED, and takes
    /// exactly the residual — no more.
    ///
    /// @dev "Exhausted" used to mean "empty". It no longer does for junior, and the
    /// change is deliberate: the tranche now covers a defined band, so its aggregate
    /// exposure per period is `exhaustionBps - attachmentBps` of backing rather than
    /// its whole balance. Once that band is consumed the loss belongs to senior even
    /// though junior still holds capital — which is a real trade-off, not a free win,
    /// and is the reason the band is calibrated rather than chosen. See
    /// `JuniorLayerTest` and `WaterfallMonteCarloTest.test_calibrate_layer_band`.
    function test_tier3_absorbs_only_after_tiers_above_are_exhausted() public {
        _fundTier1(10_000e18);
        _depositSenior(100_000e18);
        _depositJunior(50_000e18);

        uint256 fromJunior = junior.absorbableNow();
        assertGt(fromJunior, 0, "junior can absorb nothing - test is vacuous");

        uint256 covered = _coverLoss(75_000e18);

        assertEq(covered, 75_000e18);
        assertEq(fund.balance(), 0);
        assertEq(junior.layerRemaining(), 0, "junior's band was not exhausted before senior paid");
        assertEq(
            vault.totalAssets(),
            100_000e18 - (75_000e18 - 10_000e18 - fromJunior),
            "senior loss is not the residual"
        );
    }

    /// Junior LP is wiped out while senior LP is whole. This is the trade the
    /// tranche exists to express, so it needs to be true at the share level and
    /// not merely in the pool totals.
    function test_junior_wiped_before_senior_loses_a_cent() public {
        _pinBandWideOpen();
        _depositSenior(100_000e18);
        _depositJunior(20_000e18);

        uint256 seniorSharePriceBefore = vault.convertToAssets(1e18);

        _coverLoss(20_000e18);

        assertEq(junior.convertToAssets(junior.balanceOf(juniorLp)), 0, "junior LP retained value");
        assertEq(
            vault.convertToAssets(1e18),
            seniorSharePriceBefore,
            "senior share price moved while junior still had capital to lose"
        );
    }

    /// A loss larger than every tier combined is capped at what exists. The market
    /// must handle the partial fill; the vault must not revert or over-pay.
    /// @dev The expected total is derived from what each tier reports it can supply
    /// rather than written as a literal. It used to be `16_000e18` — the sum of every
    /// balance — which stopped being right the moment junior gained a banded limit.
    /// A literal here would have to be re-tuned on every recalibration, and a number
    /// that gets re-tuned to match the code is not a test.
    function test_loss_exceeding_all_tiers_is_clamped() public {
        _fundTier1(1_000e18);
        _depositSenior(10_000e18);
        _depositJunior(5_000e18);

        uint256 fromTier1 = fund.balance();
        uint256 fromJunior = junior.absorbableNow();
        uint256 fromSenior = token.balanceOf(address(vault));
        assertGt(fromJunior, 0, "junior can absorb nothing - test is vacuous");

        uint256 covered = _coverLoss(1_000_000e18);

        assertEq(covered, fromTier1 + fromJunior + fromSenior, "clamped to the wrong total");
        assertLe(covered, 16_000e18, "paid out more than every tier holds");
        assertEq(token.balanceOf(address(vault)), 0, "vault retained capital it should have paid");
        assertEq(vault.totalAssets(), 0);

        // Junior keeps whatever its band protected. This is the layer working, not a
        // tier refusing to pay: its per-period exposure is bounded by design.
        assertEq(junior.backingAssets(), 5_000e18 - fromJunior);
        assertEq(junior.layerRemaining(), 0);
    }

    /// Every tier is optional. With neither configured the contract must behave
    /// exactly as the single-tranche pool it replaced.
    function test_waterfall_degrades_to_single_tranche_when_unset() public {
        vault.setJuniorTranche(address(0));
        vault.setFirstLossFund(address(0));

        _depositSenior(100_000e18);
        uint256 covered = _coverLoss(40_000e18);

        assertEq(covered, 40_000e18);
        assertEq(vault.totalAssets(), 60_000e18);
    }

    /// The per-tier event is the only external evidence of ordering, so it has to
    /// reconcile exactly against the amount covered.
    function test_waterfall_event_reconciles_to_covered_amount() public {
        _pinBandWideOpen();
        _fundTier1(5_000e18);
        _depositSenior(50_000e18);
        _depositJunior(10_000e18);

        vm.recordLogs();
        uint256 covered = _coverLoss(30_000e18);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        bool found;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] != keccak256("LossWaterfall(address,uint256,uint256,uint256,uint256)")) {
                continue;
            }
            (uint256 requested, uint256 t1, uint256 t2, uint256 t3) =
                abi.decode(logs[i].data, (uint256, uint256, uint256, uint256));
            assertEq(requested, 30_000e18);
            assertEq(t1, 5_000e18, "tier 1 attribution wrong");
            assertEq(t2, 10_000e18, "tier 2 attribution wrong");
            assertEq(t3, 15_000e18, "tier 3 attribution wrong");
            assertEq(t1 + t2 + t3, covered, "tiers do not sum to covered");
            found = true;
        }
        assertTrue(found, "LossWaterfall never emitted");
    }

    // -----------------------------------------------------------------
    // Compensation for subordination
    // -----------------------------------------------------------------

    /// Junior must earn strictly more per unit of capital than senior. If it does
    /// not, the tranche is a worse product than the pool it split from and nobody
    /// rational subscribes.
    function test_junior_yield_exceeds_senior_yield_per_unit_capital() public {
        _depositSenior(100_000e18);
        _depositJunior(100_000e18); // equal capital isolates the multiplier

        vm.prank(market);
        vault.absorbProfit(10_000e18);

        // Let both recognition schedules run out.
        vm.warp(block.timestamp + 91 days);

        uint256 seniorGain = vault.totalAssets() - 100_000e18;
        uint256 juniorGain = junior.totalAssets() - 100_000e18;

        assertGt(juniorGain, seniorGain, "junior did not out-earn senior on equal capital");
        // On equal capital at 2x, weighting gives junior 2/3 and senior 1/3.
        assertApproxEqAbs(juniorGain, (uint256(10_000e18) * 2) / 3, 2);
        assertApproxEqAbs(seniorGain, uint256(10_000e18) / 3, 2);
        assertApproxEqAbs(juniorGain + seniorGain, 10_000e18, 2, "profit leaked");
    }

    /// The per-unit rate is what an LP actually chooses between, and weighting
    /// makes it exactly the multiplier at every ratio of the two tranches. Checked
    /// across three very different splits so a formula that happens to be right at
    /// one size cannot pass.
    function test_per_unit_yield_ratio_equals_multiplier_at_every_split() public {
        uint256[3] memory juniorSizes = [uint256(10_000e18), 100_000e18, 400_000e18];

        for (uint256 i = 0; i < juniorSizes.length; i++) {
            uint256 s = 100_000e18;
            uint256 j = juniorSizes[i];

            // Fresh pair per split so earlier profit does not skew the weights.
            BreezeLiquidityVault v =
                new BreezeLiquidityVault(token, address(accessControl), "S", "S");
            JuniorTranche t = new JuniorTranche(token, address(accessControl), "J", "J");
            v.setJuniorTranche(address(t));
            t.setSeniorVault(address(v));
            v.setMarketAuthorization(market, true);

            vm.startPrank(seniorLp);
            token.approve(address(v), type(uint256).max);
            v.deposit(s, seniorLp);
            vm.stopPrank();
            vm.startPrank(juniorLp);
            token.approve(address(t), type(uint256).max);
            t.deposit(j, juniorLp);
            vm.stopPrank();

            uint256 profit = 10_000e18;
            uint256 juniorCut = v.juniorProfitShare(profit);
            uint256 seniorCut = profit - juniorCut;

            // juniorCut/j vs seniorCut/s, compared without division.
            assertApproxEqRel(
                juniorCut * s * 10000,
                seniorCut * j * v.juniorYieldMultiplierBps(),
                1e12, // 1e-6 relative, i.e. integer rounding only
                "per-unit yield ratio is not the multiplier"
            );
        }
    }

    /// Senior must always retain some yield. A junior tranche that can claim the
    /// entire profit drives senior yield to zero while senior risk stays put, and
    /// the senior capital the tranche exists to protect then leaves.
    function test_senior_always_retains_some_yield_however_large_junior_grows() public {
        _depositSenior(1_000e18);
        _depositJunior(500_000e18); // junior 500x senior, at the 3x ceiling

        vault.setJuniorYieldMultiplierBps(vault.MAX_JUNIOR_YIELD_MULTIPLIER_BPS());

        uint256 share = vault.juniorProfitShare(7_000e18);
        assertLt(share, 7_000e18, "junior claimed the entire profit");

        vm.prank(market);
        vault.absorbProfit(7_000e18);
        vm.warp(block.timestamp + 91 days);

        assertGt(vault.totalAssets(), 1_000e18, "senior earned nothing at all");
        assertGt(junior.totalAssets(), 500_000e18, "junior earned nothing");
    }

    function test_no_junior_tranche_means_senior_keeps_all_profit() public {
        vault.setJuniorTranche(address(0));
        _depositSenior(100_000e18);

        vm.prank(market);
        vault.absorbProfit(5_000e18);
        vm.warp(block.timestamp + 91 days);

        assertEq(vault.totalAssets(), 105_000e18);
    }

    /// An empty junior tranche has absorbed nothing, so it is owed nothing.
    function test_empty_junior_tranche_earns_nothing() public {
        _depositSenior(100_000e18);
        assertEq(vault.juniorProfitShare(10_000e18), 0);

        vm.prank(market);
        vault.absorbProfit(10_000e18);
        vm.warp(block.timestamp + 91 days);

        assertEq(vault.totalAssets(), 110_000e18);
        assertEq(junior.totalAssets(), 0);
    }

    /// Junior profit is vested, not credited instantly — otherwise a depositor
    /// could arrive one block before a profit event and leave with the whole boost
    /// having carried none of the first-loss exposure.
    function test_junior_profit_vests_rather_than_landing_instantly() public {
        _depositSenior(50_000e18);
        _depositJunior(50_000e18);

        vm.prank(market);
        vault.absorbProfit(10_000e18);

        assertEq(junior.totalAssets(), 50_000e18, "junior profit recognised immediately");
        assertGt(junior.backingAssets(), 50_000e18, "junior never received the tokens");

        vm.warp(block.timestamp + junior.profitUnlockPeriod());
        assertGt(junior.totalAssets(), 50_000e18, "junior profit never vested");
    }

    /// Unrecognised junior profit still pays claims. It is real capital; only its
    /// attribution to LPs is deferred.
    function test_unvested_junior_profit_still_absorbs_loss() public {
        _pinBandWideOpen();
        _depositSenior(50_000e18);
        _depositJunior(10_000e18);

        vm.prank(market);
        vault.absorbProfit(4_000e18);
        // Junior now holds 10k principal + an unvested cut.
        uint256 juniorCapital = junior.backingAssets();
        assertGt(juniorCapital, 10_000e18);

        uint256 seniorBefore = vault.totalAssets();
        _coverLoss(juniorCapital);

        assertEq(junior.backingAssets(), 0, "unvested profit was withheld from the claim");
        assertEq(vault.totalAssets(), seniorBefore, "senior paid while junior still held capital");
    }

    // -----------------------------------------------------------------
    // Capacity
    // -----------------------------------------------------------------

    /// Junior capital must ENLARGE the protocol, not merely resegment it. If it
    /// did not count toward capacity, adding a first-loss tranche would make the
    /// pool safer without letting a single extra trade through.
    /// @dev Counted only up to `maxJuniorBackingShareBps`. A 100k/100k split puts
    /// junior at 50% of the pool, well past its permitted third, so it is credited
    /// for part of its balance and not all of it. The claim being tested is still
    /// that junior capital enlarges the protocol — the cap governs how far, and
    /// exists because the simulation showed capital MOVED from senior into junior
    /// leaves senior thinner without reducing total loss. See `JuniorLayerTest`.
    function test_junior_capital_increases_reservable_capacity() public {
        _depositSenior(100_000e18);
        uint256 before = vault.reservableLiquidity();

        _depositJunior(100_000e18);

        uint256 credited = vault.juniorBackingCredited();
        assertGt(credited, 0, "junior capital added no capacity");
        assertLt(credited, 100_000e18, "the whole junior balance was credited");
        assertEq(vault.totalBackingAssets(), 100_000e18 + credited);
        assertGt(vault.reservableLiquidity(), before, "junior capital added no capacity");
        assertLe(vault.juniorBackingShareBps(), vault.maxJuniorBackingShareBps());
    }

    /// The same test with the cap pinned wide open, so the underlying arithmetic —
    /// junior counts one-for-one toward backing — is still asserted somewhere.
    function test_junior_capital_counts_fully_when_within_its_share() public {
        vault.setMaxJuniorBackingShareBps(5000);
        _depositSenior(100_000e18);
        uint256 before = vault.reservableLiquidity();

        _depositJunior(100_000e18);

        assertEq(vault.juniorBackingCredited(), 100_000e18);
        assertEq(vault.totalBackingAssets(), 200_000e18);
        assertEq(vault.reservableLiquidity(), before * 2, "junior capital added no capacity");
    }

    /// Both tranches draw on the same headroom, so the utilisation floor cannot be
    /// breached from either side.
    ///
    /// @dev The share cap is pinned to 5000 here so junior counts one-for-one and the
    /// figures stay whole. This test is about the utilisation floor spanning two
    /// tranches, not about how much junior capital counts — leaving the default in
    /// place would make it fail on arithmetic that `JuniorLayerTest` already covers.
    function test_utilisation_floor_holds_across_both_tranches() public {
        vault.setMaxJuniorBackingShareBps(5000);
        _depositSenior(100_000e18);
        _depositJunior(100_000e18);

        // 80% of combined backing is 160k, but no single market may hold more than
        // 50% (100k), so reaching full utilisation takes two markets.
        address market2 = address(0x2EA5E);
        vault.setMarketAuthorization(market2, true);
        vm.prank(market);
        vault.reserve(100_000e18);
        vm.prank(market2);
        vault.reserve(60_000e18);

        assertEq(vault.freeBackingAssets(), 0, "reserved to the cap yet headroom remains");
        assertEq(vault.availableLiquidity(), 0, "senior can exit at full utilisation");
        assertEq(junior.availableLiquidity(), 0, "junior can exit at full utilisation");
    }

    /// Sequential withdrawals must not each consume the same free amount.
    ///
    /// @dev Sized so junior stays inside its permitted share of backing throughout,
    /// which is what isolates the property under test. An earlier version had senior
    /// withdraw down to parity with junior, which pushed part of junior's balance
    /// OUTSIDE the counted share — and uncredited junior capital is deliberately
    /// withdrawable on top of the shared headroom, so the test failed while the
    /// contract was right. See `test_uncredited_junior_capital_is_not_shared_headroom`.
    function test_tranches_cannot_double_spend_shared_headroom() public {
        vault.setMaxJuniorBackingShareBps(5000);
        _depositSenior(300_000e18);
        _depositJunior(100_000e18);

        // 100k reserved on 400k combined backing. Aggregate floor is 125k, but the
        // single-market concentration floor is 100k/0.5 = 200k and binds, so 200k free.
        vm.prank(market);
        vault.reserve(100_000e18);

        assertEq(vault.freeBackingAssets(), 200_000e18);
        assertEq(vault.juniorUncreditedBacking(), 0, "junior is over its share - test is impure");

        // Senior takes the whole free amount.
        vm.prank(seniorLp);
        vault.requestWithdrawal();
        vm.warp(block.timestamp + vault.withdrawalCooldown());
        vm.prank(seniorLp);
        vault.withdraw(200_000e18, seniorLp, seniorLp);

        // Junior now sees none of it, and has no uncredited excess to fall back on.
        assertEq(vault.freeBackingAssets(), 0, "headroom survived being spent");
        assertEq(vault.juniorUncreditedBacking(), 0);
        assertEq(junior.availableLiquidity(), 0, "junior could spend headroom senior already took");
    }

    /// Uncredited junior capital is a separate pot, not extra shared headroom.
    ///
    /// @dev Worth an explicit test because it looks like a hole in the utilisation
    /// floor and is not one. Capital above `maxJuniorBackingShareBps` is excluded from
    /// `totalBackingAssets`, so no trade was ever accepted on the strength of it and
    /// removing it leaves counted backing unchanged. The alternative — clamping it to
    /// the shared headroom — would trap junior capital that buys no capacity at all,
    /// which would make the share cap punitive rather than incentive-aligned and would
    /// deter exactly the additive subordinated capital the cap exists to encourage.
    ///
    /// The cost is real and stated plainly: that capital does absorb loss while it is
    /// present, so letting it leave reduces protection the protocol never counted on.
    function test_uncredited_junior_capital_is_not_shared_headroom() public {
        vault.setMaxJuniorBackingShareBps(5000);
        _depositSenior(60_000e18);
        _depositJunior(100_000e18);

        vm.prank(market);
        vault.reserve(60_000e18);

        uint256 uncredited = vault.juniorUncreditedBacking();
        assertGt(uncredited, 0, "no uncredited capital - test is vacuous");
        assertEq(vault.freeBackingAssets(), 0, "shared headroom remains - test is impure");

        // Junior's availability is exactly its uncredited excess, not a second helping
        // of the shared free amount.
        assertEq(junior.availableLiquidity(), uncredited);

        uint256 countedBefore = vault.totalBackingAssets();
        vm.prank(juniorLp);
        junior.requestWithdrawal();
        vm.warp(block.timestamp + junior.withdrawalCooldown());
        vm.prank(juniorLp);
        junior.withdraw(uncredited, juniorLp, juniorLp);

        assertEq(
            vault.totalBackingAssets(),
            countedBefore,
            "withdrawing uncredited capital moved counted backing"
        );
    }

    /// Senior may not withdraw junior's tokens even when combined headroom exists.
    function test_senior_withdrawal_clamped_to_senior_assets() public {
        _depositSenior(10_000e18);
        _depositJunior(500_000e18);

        assertGt(vault.freeBackingAssets(), 10_000e18, "no shared headroom to test against");
        assertEq(vault.availableLiquidity(), 10_000e18, "senior limit not clamped to senior assets");
    }

    // -----------------------------------------------------------------
    // Junior exit discipline
    // -----------------------------------------------------------------

    /// First-loss capital that can leave as fast as protected capital is not
    /// first-loss capital.
    function test_junior_cooldown_is_longer_than_senior() public view {
        assertGt(junior.withdrawalCooldown(), vault.withdrawalCooldown());
    }

    /// @dev The public path reverts with ERC4626's own max-withdraw guard rather
    /// than the tranche's inner error, because `maxWithdraw` already reports zero
    /// while the cooldown is unserved. Both guards are deliberate; asserting the
    /// observable state alongside the revert is what makes the test meaningful.
    function test_junior_withdrawal_requires_served_cooldown() public {
        _depositJunior(10_000e18);

        assertFalse(junior.canWithdraw(juniorLp), "withdrawable with no request at all");
        assertEq(junior.maxWithdraw(juniorLp), 0);
        vm.prank(juniorLp);
        vm.expectRevert();
        junior.withdraw(1_000e18, juniorLp, juniorLp);

        vm.prank(juniorLp);
        junior.requestWithdrawal();

        assertFalse(junior.canWithdraw(juniorLp), "withdrawable before cooldown elapsed");
        vm.prank(juniorLp);
        vm.expectRevert();
        junior.withdraw(1_000e18, juniorLp, juniorLp);

        vm.warp(block.timestamp + junior.withdrawalCooldown());
        assertTrue(junior.canWithdraw(juniorLp), "cooldown served but still blocked");
        vm.prank(juniorLp);
        junior.withdraw(1_000e18, juniorLp, juniorLp);
        assertEq(junior.totalAssets(), 9_000e18);
    }

    /// A pre-warmed address must be worth nothing: the request snapshots shares
    /// held at request time, and an inbound transfer cancels the sender's claim.
    function test_junior_prewarmed_address_cannot_bypass_cooldown() public {
        address warm = address(0x77A7);
        vm.prank(warm);
        junior.requestWithdrawal(); // zero shares held

        _depositJunior(10_000e18);
        vm.warp(block.timestamp + junior.withdrawalCooldown() + 1);

        uint256 shares = junior.balanceOf(juniorLp);
        vm.prank(juniorLp);
        junior.transfer(warm, shares);

        assertEq(junior.maxRedeem(warm), 0, "warmed address redeemed shares it never waited for");
    }

    function test_junior_request_expires_after_window() public {
        _depositJunior(10_000e18);
        vm.prank(juniorLp);
        junior.requestWithdrawal();

        // Inside the window the exit is live.
        vm.warp(block.timestamp + junior.withdrawalCooldown() + 1);
        assertTrue(junior.canWithdraw(juniorLp));

        // Past it the request has lapsed and must be renewed.
        vm.warp(block.timestamp + junior.WITHDRAWAL_WINDOW() + 1);
        assertFalse(junior.canWithdraw(juniorLp), "matured request never expires");
        assertEq(junior.maxWithdraw(juniorLp), 0);

        vm.prank(juniorLp);
        vm.expectRevert();
        junior.withdraw(1_000e18, juniorLp, juniorLp);
    }

    /// Pausing must never trap LP capital, in either tranche.
    function test_junior_withdrawals_survive_pause() public {
        _depositJunior(10_000e18);
        vm.prank(juniorLp);
        junior.requestWithdrawal();
        vm.warp(block.timestamp + junior.withdrawalCooldown());

        vm.prank(pauser);
        junior.pauseDeposits();

        vm.prank(juniorLp);
        junior.withdraw(5_000e18, juniorLp, juniorLp);
        assertEq(junior.totalAssets(), 5_000e18);

        vm.prank(juniorLp);
        vm.expectRevert();
        junior.deposit(1e18, juniorLp);
    }

    // -----------------------------------------------------------------
    // Access control and parameter bounds
    // -----------------------------------------------------------------

    function test_only_senior_vault_can_draw_junior_loss() public {
        _depositJunior(10_000e18);

        vm.prank(market);
        vm.expectRevert(JuniorTranche.UnauthorizedCaller.selector);
        junior.absorbLoss(1_000e18);

        vm.expectRevert(JuniorTranche.UnauthorizedCaller.selector);
        junior.absorbLoss(1_000e18);
    }

    function test_only_senior_vault_can_pay_junior_profit() public {
        vm.prank(market);
        vm.expectRevert(JuniorTranche.UnauthorizedCaller.selector);
        junior.receiveProfit(1_000e18);
    }

    /// An unset senior vault must not make address(0) an authorised caller.
    function test_unset_senior_vault_authorises_nobody() public {
        junior.setSeniorVault(address(0));
        vm.prank(address(0));
        vm.expectRevert(JuniorTranche.UnauthorizedCaller.selector);
        junior.absorbLoss(1);
    }

    function test_only_admin_can_configure_waterfall() public {
        address stranger = address(0xBAD);

        vm.startPrank(stranger);
        vm.expectRevert(BreezeLiquidityVault.UnauthorizedCaller.selector);
        vault.setJuniorTranche(address(1));
        vm.expectRevert(BreezeLiquidityVault.UnauthorizedCaller.selector);
        vault.setFirstLossFund(address(1));
        vm.expectRevert(BreezeLiquidityVault.UnauthorizedCaller.selector);
        vault.setJuniorYieldMultiplierBps(15000);
        vm.expectRevert(JuniorTranche.UnauthorizedCaller.selector);
        junior.setSeniorVault(address(1));
        vm.stopPrank();
    }

    /// Junior must never be paid less than pro-rata — it carries strictly more
    /// risk, so sub-pro-rata compensation could not be justified at any level.
    function test_multiplier_cannot_be_set_below_prorata() public {
        uint256 floorBps = vault.MIN_JUNIOR_YIELD_MULTIPLIER_BPS();
        vm.expectRevert(BreezeLiquidityVault.InvalidYieldMultiplier.selector);
        vault.setJuniorYieldMultiplierBps(floorBps - 1);
    }

    /// The boost is paid out of senior's share, so an unbounded multiplier would
    /// let admin strip senior yield while leaving senior risk in place.
    function test_multiplier_cannot_exceed_ceiling() public {
        uint256 ceilingBps = vault.MAX_JUNIOR_YIELD_MULTIPLIER_BPS();
        vm.expectRevert(BreezeLiquidityVault.InvalidYieldMultiplier.selector);
        vault.setJuniorYieldMultiplierBps(ceilingBps + 1);
    }

    function test_multiplier_within_bounds_is_accepted() public {
        vault.setJuniorYieldMultiplierBps(15000);
        assertEq(vault.juniorYieldMultiplierBps(), 15000);

        _depositSenior(90_000e18);
        _depositJunior(10_000e18);
        // Weights: junior 10k x 1.5 = 15, senior 90k x 1 = 90. Share = 15/105.
        assertEq(vault.juniorProfitShare(10_000e18), (uint256(10_000e18) * 15) / 105);
    }

    // -----------------------------------------------------------------
    // Failure tolerance
    // -----------------------------------------------------------------

    /// A junior tranche that reverts must degrade to senior-funded cover rather
    /// than block a trader's exit. Exiting is never subordinate to the state of
    /// the backing structure.
    function test_reverting_junior_tranche_does_not_block_cover() public {
        _depositSenior(100_000e18);
        // Point the vault at a contract with no absorbLoss implementation.
        vault.setJuniorTranche(address(new RevertingTranche()));

        uint256 covered = _coverLoss(20_000e18);

        assertEq(covered, 20_000e18, "cover blocked by a broken junior tranche");
        assertEq(vault.totalAssets(), 80_000e18, "senior did not backfill");
    }

    /// Same requirement for tier 1: a de-authorised fund must not freeze exits.
    function test_deauthorised_first_loss_fund_does_not_block_cover() public {
        _fundTier1(10_000e18);
        _depositSenior(100_000e18);

        fund.setMarketAuthorization(address(vault), false);

        uint256 covered = _coverLoss(20_000e18);

        assertEq(covered, 20_000e18);
        assertEq(fund.balance(), 10_000e18, "drew from a fund that refused the call");
        assertEq(vault.totalAssets(), 80_000e18, "senior did not backfill");
    }
}

/// A junior tranche whose `absorbLoss` always reverts.
contract RevertingTranche {
    function backingAssets() external pure returns (uint256) {
        return 0;
    }
    function absorbLoss(uint256) external pure returns (uint256) {
        revert("nope");
    }
    function receiveProfit(uint256) external pure {
        revert("nope");
    }
}
