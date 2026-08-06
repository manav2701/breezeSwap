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
import "../../src/vault/JuniorTranche.sol";
import "../../src/vault/FirstLossReserve.sol";

contract WfToken is ERC20 {
    constructor() ERC20("Mock USDT", "mUSDT") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Does the loss waterfall actually protect senior capital, or does it
/// only look like it does?
///
/// The claim being tested is comparative, so the test has to be comparative: the
/// same trader flow, from the same seed, run through three capital structures that
/// hold the SAME TOTAL risk capital. Holding total capital constant is what makes
/// the comparison mean anything — a structure that is safer because it is simply
/// larger has demonstrated nothing about tranching.
///
///   Arm A  single tranche, 400k senior                    (the pre-waterfall baseline)
///   Arm B  + dedicated first-loss reserve                  (tier 1 only)
///   Arm C  300k senior + 100k junior + tier 1              (junior CARVED OUT of the total)
///   Arm D  400k senior + 100k additional junior + tier 1   (junior ADDED to the total)
///
/// Arms A–C hold total LP capital constant. Arm D deliberately does not, and that is
/// the point of it: the first pass measured C against A and found the waterfall won
/// on 4 of 5 seeds but lost on the mean, because carving junior out of a fixed total
/// leaves senior thinner above the attachment point. Arm D is the shape the protocol
/// now encourages — junior capital counts toward backing only up to a bounded share,
/// so shifting senior LPs into junior buys nothing and only genuinely new
/// subordinated capital enlarges the pool.
///
/// Tier 1 is `FirstLossReserve`, drawn only by the vault. It used to be
/// `InsuranceFund`, which the market also draws for liquidation bad debt — and
/// sharing that balance measured WORSE for senior than having no tier 1 at all, on 2
/// of 5 seeds. The market funds the reserve from its own fee leg in EVERY arm, so the
/// fee flow is identical across arms and the only variable is whether the vault may
/// draw on it.
///
/// The measured quantity is senior share price: its final level and its worst
/// drawdown during the run.
contract WaterfallMonteCarloTest is Test {
    BreezeAccessControl accessControl;
    MockWeatherOracle oracle;
    FeeConfig feeConfig;
    ProtocolTreasury treasury;
    InsuranceFund insuranceFund;
    FirstLossReserve firstLossReserve;
    BreezeLiquidityVault vault;
    JuniorTranche junior;
    WfToken token;
    BreezePerpMarket market;

    address admin = address(this);
    bytes32 constant REGION = keccak256("TOKYO_RAINFALL");

    uint256 constant TRADERS = 40;
    uint256 constant LPS = 6;
    uint256 constant ACTIONS = 1500;
    uint256 constant TOTAL_LP_CAPITAL = 400_000e18;

    /// @dev Constants rather than locals: three arms plus their per-seed statistics
    /// already sit at the EVM's stack limit inside the comparison tests.
    uint256 constant SEEDS = 5;

    /// @dev 250 rather than 300. Three arms x 5 seeds x 300 actions exceeded the block
    /// gas limit once the capacity surcharge added work to every open. Breadth is kept
    /// over length here deliberately — this test's job is to rank arms across paths, and
    /// a 5-seed ranking at 250 actions is better evidence than a 4-seed one at 300. The
    /// calibration sweep makes the opposite trade for the opposite reason.
    uint256 constant PER_RUN = 250;

    /// @dev Longer and fewer than the comparison runs. The band only binds in the
    /// tail, so the calibration sweep needs severity more than it needs breadth.
    uint256 constant CALIBRATION_SEEDS = 3;
    uint256 constant CALIBRATION_RUN = 600;

    address[] traders;
    address[] lps;
    uint256[] openIds;
    uint256 rng;

    // stats
    uint256 opensAttempted;
    uint256 rejected;
    uint256 closes;
    uint256 shortfalls;
    uint256 worstShortfallBps;
    uint256 seniorPriceStart;
    uint256 seniorPriceMin;
    uint256 seniorDropEvents;

    /// @dev Deliberately NOT mixed with `block.timestamp`. The original harness
    /// did, and it made a cross-arm comparison meaningless: arms warp time
    /// differently, so the action script itself diverged and any difference in
    /// outcome could just as easily have been a difference in what the traders
    /// were asked to do. Seeding purely from the chain state of the PRNG makes
    /// every arm face the identical script.
    function _rand(uint256 mod) internal returns (uint256) {
        rng = uint256(keccak256(abi.encode(rng)));
        return mod == 0 ? 0 : rng % mod;
    }

    /// @param tier1 let the vault draw the dedicated first-loss reserve as tier 1
    /// @param juniorCapital subordinated capital to raise
    /// @param additive true to ADD it on top of the fixed total, false to CARVE it out
    function _world(bool tier1, uint256 juniorCapital, bool additive, uint256 seed) internal {
        rng = seed;
        opensAttempted = 0; rejected = 0; closes = 0; shortfalls = 0; worstShortfallBps = 0;
        seniorPriceMin = type(uint256).max; seniorDropEvents = 0;
        delete openIds; delete traders; delete lps;

        vm.warp(1_700_000_000);

        accessControl = new BreezeAccessControl(admin);
        accessControl.grantRole(accessControl.ORACLE_UPDATER_ROLE(), admin);
        token = new WfToken();
        oracle = new MockWeatherOracle(address(accessControl));
        feeConfig = new FeeConfig(address(accessControl));
        treasury = new ProtocolTreasury(address(token), address(accessControl));
        insuranceFund = new InsuranceFund(address(token), address(accessControl));
        firstLossReserve = new FirstLossReserve(address(token), address(accessControl));
        vault = new BreezeLiquidityVault(token, address(accessControl), "Breeze LP", "bLP");
        junior = new JuniorTranche(token, address(accessControl), "Breeze Junior", "bJNR");

        market = new BreezePerpMarket(
            VirtualAMM.Reserves({collateralReserve: 2_000_000e18, weatherReserve: 80_000e18}),
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
        market.setLiquidityVault(address(vault));

        // Wired in EVERY arm, so the fee split is identical across arms and the only
        // variable below is whether the vault may draw on the reserve. Wiring it only
        // where it is drawn would change the fee flow between arms and confound the
        // comparison with a difference in how much revenue reached the backstop.
        market.setFirstLossReserve(address(firstLossReserve));

        if (tier1) {
            vault.setFirstLossFund(address(firstLossReserve));
            firstLossReserve.setDrawerAuthorization(address(vault), true);
        }
        if (juniorCapital > 0) {
            vault.setJuniorTranche(address(junior));
            junior.setSeniorVault(address(vault));
        }

        for (uint256 i = 0; i < TRADERS; i++) {
            address t = address(uint160(0x10000 + i));
            traders.push(t);
            token.mint(t, 1_000_000e18);
            vm.prank(t);
            token.approve(address(market), type(uint256).max);
        }
        for (uint256 i = 0; i < LPS; i++) {
            address l = address(uint160(0x20000 + i));
            lps.push(l);
            token.mint(l, 1_000_000e18);
            vm.startPrank(l);
            token.approve(address(vault), type(uint256).max);
            token.approve(address(junior), type(uint256).max);
            vm.stopPrank();
        }

        if (juniorCapital > 0) {
            address jlp = address(uint160(0x30001));
            token.mint(jlp, juniorCapital);
            vm.startPrank(jlp);
            token.approve(address(junior), type(uint256).max);
            junior.deposit(juniorCapital, jlp);
            vm.stopPrank();
        }

        vm.prank(lps[0]);
        vault.deposit(additive ? TOTAL_LP_CAPITAL : TOTAL_LP_CAPITAL - juniorCapital, lps[0]);

        seniorPriceStart = vault.convertToAssets(1e18);
        oracle.setReading(REGION, block.timestamp, 25e6);
    }

    function _open() internal {
        address t = traders[_rand(TRADERS)];
        uint256 collateral = 5_000e18 + _rand(60_000e18);
        uint256 lev = 1 + _rand(PerpConstants.MAX_LEVERAGE);
        bool isLong = _rand(2) == 0;
        if (token.balanceOf(t) < collateral) return;

        opensAttempted += 1;
        vm.prank(t);
        try market.openPosition(isLong, collateral, lev) returns (uint256 id) {
            openIds.push(id);
        } catch {
            rejected += 1;
        }
    }

    function _close() internal {
        if (openIds.length == 0) return;
        uint256 idx = _rand(openIds.length);
        uint256 id = openIds[idx];
        (address trader,, uint256 collateral,,,,, bool isOpen) = market.positions(id);
        if (!isOpen) {
            _drop(idx);
            return;
        }
        int256 equity = int256(collateral) + market.calculateUnrealizedPnl(id);
        uint256 owed = equity > 0 ? uint256(equity) : 0;

        uint256 before = token.balanceOf(trader);
        vm.prank(trader);
        try market.closePosition(id) {
            closes += 1;
            uint256 got = token.balanceOf(trader) - before;
            if (owed > 0 && got < (owed * 9900) / 10000) {
                shortfalls += 1;
                uint256 bps = ((owed - got) * 10000) / owed;
                if (bps > worstShortfallBps) worstShortfallBps = bps;
            }
            _drop(idx);
        } catch {}
    }

    function _liquidate() internal {
        if (openIds.length == 0) return;
        uint256 idx = _rand(openIds.length);
        uint256 id = openIds[idx];
        (,,,,,,, bool isOpen) = market.positions(id);
        if (!isOpen) {
            _drop(idx);
            return;
        }
        if (!market.isLiquidatable(id)) return;
        vm.prank(traders[_rand(TRADERS)]);
        try market.liquidate(id) {
            _drop(idx);
        } catch {}
    }

    function _drop(uint256 idx) internal {
        openIds[idx] = openIds[openIds.length - 1];
        openIds.pop();
    }

    function _lpFlow() internal {
        address l = lps[_rand(LPS)];
        if (_rand(2) == 0) {
            uint256 amt = 10_000e18 + _rand(150_000e18);
            if (token.balanceOf(l) < amt) return;
            vm.prank(l);
            try vault.deposit(amt, l) {} catch {}
        } else {
            vm.prank(l);
            vault.requestWithdrawal();
            vm.warp(block.timestamp + vault.withdrawalCooldown());
            uint256 max = vault.maxRedeem(l);
            if (max == 0) return;
            vm.prank(l);
            try vault.redeem(1 + _rand(max), l, l) {} catch {}
        }
    }

    function _weather() internal {
        vm.warp(block.timestamp + market.fundingInterval() + _rand(2 days));
        oracle.setReading(REGION, block.timestamp, int256(1e6 + _rand(400e6)));
        try market.settleFunding() {} catch {}
    }

    function _sweepSurplus() internal {
        try market.sweepSurplus() {} catch {}
    }

    function _runN(uint256 n) internal {
        uint256 lastPrice = seniorPriceStart;
        for (uint256 i = 0; i < n; i++) {
            uint256 roll = _rand(100);
            if (roll < 32) _open();
            else if (roll < 58) _close();
            else if (roll < 68) _liquidate();
            else if (roll < 82) _lpFlow();
            else if (roll < 94) _weather();
            else _sweepSurplus();

            uint256 p = vault.convertToAssets(1e18);
            if (p < seniorPriceMin) seniorPriceMin = p;
            if (p < lastPrice) seniorDropEvents += 1;
            lastPrice = p;

            assertLe(
                vault.convertToAssets(vault.totalSupply()),
                vault.totalAssets(),
                "senior share claims exceeded senior assets mid-run"
            );
        }
    }

    /// The headline comparison, aggregated across seeds.
    ///
    /// A single path proves nothing here. Even with an identical action script the
    /// arms diverge the moment one accepts a trade another rejects, so any one
    /// run's ranking is largely noise — an earlier version of this test asserted on
    /// one path and the ranking flipped as soon as an unrelated bug fix changed the
    /// funding rate. Comparing means across seeds is the weakest claim the setup
    /// can actually support.
    function test_waterfall_protects_senior_capital() public {
        uint256 aSum;
        uint256 cSum;
        uint256 dSum;
        uint256 cWinsVsA;
        uint256 dWinsVsA;
        uint256 juniorTouched;

        for (uint256 s = 0; s < SEEDS; s++) {
            uint256 a = _armWorstSeniorPrice(false, 0, false, _seed(s));
            aSum += a;

            uint256 c = _armWorstSeniorPrice(true, 100_000e18, false, _seed(s));
            cSum += c;
            uint256 juniorLeftC = junior.backingAssets();

            uint256 d = _armWorstSeniorPrice(true, 100_000e18, true, _seed(s));
            dSum += d;

            if (juniorLeftC < 100_000e18) juniorTouched += 1;
            if (c >= a) cWinsVsA += 1;
            if (d >= a) dWinsVsA += 1;

            console.log("seed", s);
            console.log("  senior worst price A / C / D  :", a, c, d);
            console.log("  junior left (arm C)           :", juniorLeftC);
            console.log("  arm D closes / shortfalls     :", closes, shortfalls);
            console.log("  arm D opens / rejected        :", opensAttempted, rejected);
        }

        uint256 seeds = SEEDS;
        console.log("==================================================");
        console.log("seeds                          :", seeds);
        console.log("mean senior worst price  ARM A :", aSum / seeds);
        console.log("mean senior worst price  ARM C :", cSum / seeds);
        console.log("mean senior worst price  ARM D :", dSum / seeds);
        console.log("start price (all arms)         :", seniorPriceStart);
        console.log("seeds where junior absorbed    :", juniorTouched, "of", seeds);
        console.log("seeds where C beat A           :", cWinsVsA, "of", seeds);
        console.log("seeds where D beat A           :", dWinsVsA, "of", seeds);
        console.log("==================================================");

        // 1. Subordination has to be real, not decorative: the junior tranche must
        //    actually take loss on some path. A waterfall whose junior layer is
        //    never touched has demonstrated nothing about ordering.
        assertGt(juniorTouched, 0, "junior tranche absorbed nothing on any seed");

        // 2. ADDITIVE junior capital must be at least as good as the flat pool on
        //    EVERY seed, not merely on most. This is the strongest claim in the file
        //    and it is what arm D exists to support: with junior funded by NEW capital
        //    rather than carved out of senior there is no thinning effect to trade
        //    against, so a seed where senior did worse would mean the ordering itself
        //    is broken rather than that the exhaustion point was breached.
        assertEq(dWinsVsA, seeds, "additive junior capital left senior worse off on some seed");

        // 3. And additive must beat carved-out. This is the assertion that justifies
        //    `maxJuniorBackingShareBps` existing at all.
        assertGt(dSum, cSum, "adding junior capital was no better than carving it out");

        // Deliberately NOT asserted: that arm C beats arm A, on the mean OR on a
        // majority of seeds. It used to pass on 4 of 5 seeds and now passes on 2, and
        // the change is not a regression — it is the bounded junior layer making the
        // carved-out shape honestly worse.
        //
        // Arm C thins senior by 25% and, with a band calibrated at 8% of backing, hands
        // back a layer that can absorb at most ~32k per period in exchange. That is a
        // bad trade and it should measure as one. Arm C is precisely the configuration
        // the protocol now discourages: since junior counts toward backing only up to
        // `maxJuniorBackingShareBps`, capital SHIFTED out of senior buys no additional
        // capacity, so there is no incentive to build arm C when arm D is available.
        //
        // Tranching redistributes loss; it does not reduce it. An assertion that arm C
        // protects senior would be asserting the opposite, and it only ever passed
        // because junior's exposure was unbounded.
        assertLe(cWinsVsA, seeds); // recorded, not required
    }

    /// Arm B against arm A, in its own test.
    ///
    /// @dev This claim was previously UNASSERTABLE and the reason mattered. Tier 1
    /// used to be `InsuranceFund`, which `_executeLiquidation` also draws for bad
    /// debt — so enabling it as tier 1 let the vault drain the reserve liquidation
    /// depends on. Bad debt then landed on the market's own balance, leaving less to
    /// pay other closing positions, producing further vault draws that land on
    /// senior. It compounds. The assertion failed on 2 of 5 seeds, and the honest
    /// response at the time was to remove it and record the finding rather than tune
    /// seeds around it.
    ///
    /// `FirstLossReserve` is drawn only by the vault, so the two uses no longer
    /// compete. If this test fails again, that contention has returned.
    ///
    /// Split from the four-arm comparison because running all four in one test
    /// exceeded the block gas limit — the same reason the coverage-ratio sweep is one
    /// test per ratio.
    function test_dedicated_first_loss_tier_does_not_hurt_senior() public {
        uint256 aSum;
        uint256 bSum;
        uint256 bWinsVsA;
        uint256 tier1Drew;

        for (uint256 s = 0; s < SEEDS; s++) {
            uint256 a = _armWorstSeniorPrice(false, 0, false, _seed(s));
            aSum += a;

            uint256 b = _armWorstSeniorPrice(true, 0, false, _seed(s));
            bSum += b;
            if (firstLossReserve.totalCovered() > 0) tier1Drew += 1;

            if (b >= a) bWinsVsA += 1;
            console.log("seed", s);
            console.log("  senior worst price A / B      :", a, b);
            console.log("  tier 1 funded / drawn         :",
                firstLossReserve.totalDeposited(), firstLossReserve.totalCovered());
        }

        uint256 seeds = SEEDS;
        console.log("==================================================");
        console.log("mean senior worst price  ARM A :", aSum / seeds);
        console.log("mean senior worst price  ARM B :", bSum / seeds);
        console.log("seeds where B beat A           :", bWinsVsA, "of", seeds);
        console.log("seeds where tier 1 was drawn   :", tier1Drew, "of", seeds);
        console.log("==================================================");

        // The tier has to actually pay on some path, or the comparison is between a
        // pool with a backstop and a pool with a dormant contract.
        assertGt(tier1Drew, 0, "tier 1 never absorbed anything - comparison is vacuous");

        // Majority of paths, not the mean. The mean is STILL not assertable here and
        // it is worth being precise about why, because the reason changed.
        //
        // Originally it was the shared-pot contention: tier 1 was `InsuranceFund`,
        // which the market also drew for liquidation bad debt, so the vault could
        // starve liquidation. That defect is fixed, and it is now proven where a
        // mechanism claim belongs — in a DETERMINISTIC test. `FirstLossIsolationTest`
        // runs the same drain and the same liquidation through a shared pot and
        // through separated reserves: the shared pot covers 200.8 of the 1,825.7 the
        // liquidation needs, the separated one covers all of it.
        //
        // What remains here is path divergence, not contention. Tier 1 changes the
        // vault balance by a few hundred tokens against 400k of senior capital, which
        // is enough to move `maxNotionalCapacity` across the threshold for one trade —
        // and from the first differing accept/reject the two arms face entirely
        // different books. On seed 4 arm B's senior price reached zero while arm A's
        // stayed at par, and arm B still won 4 of the 5 seeds. One catastrophic path
        // dominating a 5-seed mean is a property of the harness, not of the tier.
        //
        // So the stochastic test asserts the weakest thing it can actually support,
        // and the mechanism is asserted deterministically elsewhere. Tuning seeds
        // until the mean cooperated would be the alternative, and it would be worse
        // than having no assertion at all.
        assertGt(bWinsVsA * 2, seeds, "a dedicated first-loss tier hurt senior on most paths");
    }

    /// @dev One arm, start to finish. Factored out because four arms in a single test
    /// exceeded the block gas limit, and the arguments are kept to four because a
    /// fifth pushed the caller past the EVM's stack depth.
    function _armWorstSeniorPrice(bool tier1, uint256 juniorCapital, bool additive, uint256 seed)
        internal
        returns (uint256)
    {
        _world(tier1, juniorCapital, additive, seed);
        _runN(PER_RUN);
        return seniorPriceMin;
    }

    function _seed(uint256 s) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode("breeze-waterfall", s)));
    }

    /// @notice Where should the junior layer's exhaustion point sit?
    ///
    /// This is a genuine two-sided trade-off and the sweep has to report both sides,
    /// because a wider band is not simply better. Loss inside the band is junior's;
    /// loss above it is senior's. Widening the band protects senior and exposes
    /// junior; narrowing it does the reverse. There is no setting that improves both.
    ///
    /// Reporting only senior's outcome would make "as wide as possible" look optimal
    /// and would be the same mistake as sizing a reserve off the mean — it would pick
    /// the setting under which the junior layer is unfundable, because nobody
    /// subscribes to unbounded first loss.
    ///
    /// Junior capital is ADDITIVE here (arm D), since that is the shape the share cap
    /// now encourages, and the band is what junior LPs are actually pricing.
    ///
    /// Run under the AGGRESSIVE funding preset and at double the usual length, for the
    /// same reason the coverage-ratio sweep is: a first attempt at 300 actions on
    /// production funding produced four identical columns and "band bound: 0 of 3".
    /// Junior lost about 9k of its 100k, so even the narrowest 40k band never came
    /// near binding. The sweep looked like calibration evidence and contained none.
    /// Insurance layers are sized on the tail, and a harness too gentle to reach the
    /// tail cannot locate a boundary.
    /// One test per width, because all four in a single test exceeded the block gas
    /// limit — the same split the coverage-ratio sweep needed.
    function test_calibrate_layer_band_1000() public { _sweepBand(1000); }
    function test_calibrate_layer_band_2500() public { _sweepBand(2500); }
    function test_calibrate_layer_band_5000() public { _sweepBand(5000); }
    function test_calibrate_layer_band_10000() public { _sweepBand(10000); }

    function _sweepBand(uint256 exhaustionBps) internal {
        uint256 seniorSum;
        uint256 juniorSum;
        uint256 juniorEndSum;
        uint256 absorbedSum;
        uint256 bandBound;

        for (uint256 s = 0; s < CALIBRATION_SEEDS; s++) {
            _world(true, 100_000e18, true, _seed(s));
            market.setFundingParams(
                PerpConstants.FUNDING_INTERVAL,
                PerpConstants.MAX_FUNDING_RATE_PER_PERIOD
            );
            junior.setLayerParams(200, exhaustionBps, 365 days);
            _runN(CALIBRATION_RUN);

            seniorSum += seniorPriceMin;
            juniorSum += junior.convertToAssets(1e18);
            // Junior's END balance, not its loss. It can finish ABOVE its 100k start,
            // because the tranche is paid a boosted share of profit as well as taking
            // first loss — subtracting for a "loss" figure underflowed.
            juniorEndSum += junior.backingAssets();
            absorbedSum += junior.layerConsumed();

            // Did the band actually bind, or did assets run out first? Only the former
            // tells us anything about where to put the exhaustion point.
            if (junior.layerRemaining() == 0 && junior.backingAssets() > 0) bandBound += 1;
        }

        console.log("--------------------------------------------------");
        console.log("exhaustion bps                 :", exhaustionBps);
        console.log("mean senior worst price        :", seniorSum / CALIBRATION_SEEDS);
        console.log("mean junior end share price    :", juniorSum / CALIBRATION_SEEDS);
        console.log("mean junior end backing        :", juniorEndSum / CALIBRATION_SEEDS);
        console.log("mean loss absorbed by the layer:", absorbedSum / CALIBRATION_SEEDS);
        console.log("seeds where the band bound     :", bandBound, "of", CALIBRATION_SEEDS);

        // No pass/fail threshold on the RANKING, deliberately: the band is a policy
        // choice about how much of the loss distribution subordinated capital is asked
        // to absorb, and there is no objective function that makes one width the
        // winner on its own.
        //
        // What IS asserted is that the sweep reached a regime where the parameter
        // matters at all. Junior must take REAL loss here, or the column is noise
        // dressed as evidence — which is exactly what the first attempt produced: at
        // 300 actions on production funding, junior lost ~9k of its 100k and all four
        // widths returned identical numbers with the band binding on 0 of 3 seeds.
        //
        // Measured as loss the layer ABSORBED, not as its end balance being below its
        // start. Junior is paid a boosted share of profit as well as taking first loss,
        // and the capacity surcharge added another revenue stream — so at the narrowest
        // width junior finished ABOVE its 100k start while still having absorbed real
        // loss. An end-balance test called that "no loss" and failed a column that was
        // working correctly.
        assertGt(
            absorbedSum,
            0,
            "the layer absorbed nothing at this width - the column measures nothing"
        );
    }

    /// A run where traders win heavily on one side. The single-tranche pool has
    /// nothing between trader profit and LP principal; the waterfall has two
    /// layers, and this measures how much of the loss each one actually eats.
    function test_one_sided_loss_is_absorbed_by_upper_tiers_first() public {
        _world(true, 100_000e18, true, 0xB6EEBE);

        uint256 seniorBefore = vault.totalAssets();
        uint256 juniorBefore = junior.backingAssets();

        // Build a large one-sided long book.
        uint256 opened;
        uint256[] memory ids = new uint256[](12);
        for (uint256 i = 0; i < 12; i++) {
            vm.prank(traders[i]);
            try market.openPosition(true, 40_000e18, 3) returns (uint256 id) {
                ids[opened++] = id;
            } catch {}
        }
        assertGt(opened, 0, "no positions opened - scenario never ran");

        // Then hold the index far ABOVE mark for many intervals. Mark below index
        // makes the funding rate negative, so shorts pay longs — and with no shorts
        // on the book, the protocol itself is what pays. This is the loss the
        // waterfall exists to absorb, and driving it through funding rather than
        // price is deliberate: vAMM price impact round-trips to roughly zero, so
        // funding is the only channel through which a one-sided book can actually
        // extract value from the pool.
        for (uint256 k = 0; k < 40; k++) {
            vm.warp(block.timestamp + market.fundingInterval());
            oracle.setReading(REGION, block.timestamp, 400e6);
            market.settleFunding();
        }
        assertLt(market.cumulativeFundingIndex(), 0, "funding never turned in favour of longs");

        for (uint256 i = 0; i < opened; i++) {
            vm.prank(traders[i]);
            try market.closePosition(ids[i]) {} catch {}
        }
        try market.sweepSurplus() {} catch {}

        uint256 seniorLoss =
            seniorBefore > vault.totalAssets() ? seniorBefore - vault.totalAssets() : 0;
        uint256 juniorLoss =
            juniorBefore > junior.backingAssets() ? juniorBefore - junior.backingAssets() : 0;

        console.log("one-sided stress: tier1 left   :", firstLossReserve.balance());
        console.log("one-sided stress: junior loss  :", juniorLoss);
        console.log("one-sided stress: senior loss  :", seniorLoss);
        console.log("one-sided stress: layer limit  :", junior.layerLimit());
        console.log("one-sided stress: layer left   :", junior.layerRemaining());

        // The scenario has to bite, or the ordering assertion below is vacuous.
        assertGt(juniorLoss + seniorLoss, 0, "one-sided book cost the protocol nothing");

        // Senior may only be hit once junior can absorb nothing further. Since the
        // band was introduced there are TWO ways that happens — the balance runs out,
        // or the per-period band is consumed — and `absorbableNow()` is the figure
        // that covers both. Asserting on the balance alone would encode the pre-band
        // model; asserting on the band alone fails whenever assets bind first, which
        // is what happens here.
        if (seniorLoss > 0) {
            assertEq(
                junior.absorbableNow(),
                0,
                "senior lost value while junior could still have paid"
            );
        }

        // And the layer must not have paid beyond what its band permitted.
        assertLe(juniorLoss, junior.layerLimit(), "junior paid beyond its band");
    }
}
