// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../src/access/BreezeAccessControl.sol";
import "../../src/oracle/MockWeatherOracle.sol";
import "../../src/oracle/StrikeProbabilityOracle.sol";
import "../../src/vault/BreezeLiquidityVault.sol";
import "../../src/policy/WeatherPolicyMarket.sol";

contract PsToken is ERC20 {
    constructor() ERC20("Mock USDT", "mUSDT") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Settlement has to measure the same quantity the premium was priced on.
///
/// `weather-seed/src/climatology.ts` sums daily precipitation into a MONTHLY TOTAL and
/// counts how often that total breached the strike. So a 40mm threshold means "40mm
/// across the month", and a 20% probability is the frequency of a *month* coming in dry.
///
/// Settlement compared a SINGLE reading at expiry against that threshold. One day's
/// rainfall is essentially always below a monthly total, so drought cover triggered on
/// almost every policy while being charged the monthly-total probability. The pricing was
/// right; the settlement was measuring something else entirely and the gap was a
/// systematic transfer from LPs to buyers.
///
/// The first test below is the defect, stated as an arithmetic fact rather than as
/// history — a per-day value that is unambiguously WET still settles as a drought under
/// point settlement.
contract PolicyPeriodSettlementTest is Test {
    BreezeAccessControl accessControl;
    MockWeatherOracle weather;
    StrikeProbabilityOracle pricing;
    BreezeLiquidityVault vault;
    WeatherPolicyMarket market;
    PsToken token;

    address admin = address(this);
    address farmer = address(0xFA524E);
    address lp = address(0x11B);

    bytes32 constant TOKYO = keccak256("TOKYO_RAINFALL");
    uint8 constant RAINFALL = 0;
    uint8 constant TEMPERATURE = 1;
    uint8 constant AUGUST = 8;

    /// 40mm across the month.
    uint256 constant THRESHOLD = 40e6;
    uint256 constant TERM = 30 days;
    uint256 constant INTERVAL = 1 days;
    uint256 constant SAMPLES = TERM / INTERVAL;
    uint256 constant LEAD = 60 days;

    function setUp() public {
        vm.warp(INTERVAL);

        accessControl = new BreezeAccessControl(admin);
        accessControl.grantRole(accessControl.ORACLE_UPDATER_ROLE(), admin);

        token = new PsToken();
        weather = new MockWeatherOracle(address(accessControl));
        pricing = new StrikeProbabilityOracle(address(accessControl));
        vault = new BreezeLiquidityVault(token, address(accessControl), "Breeze LP", "bLP");

        market = new WeatherPolicyMarket(
            address(accessControl),
            address(weather),
            address(pricing),
            address(vault),
            address(token)
        );
        vault.setMarketAuthorization(address(market), true);

        pricing.setStrikeProbability(TOKYO, RAINFALL, true, THRESHOLD, AUGUST, 2000, 30);
        pricing.setStrikeProbability(TOKYO, TEMPERATURE, true, THRESHOLD, AUGUST, 2000, 30);

        token.mint(farmer, 1_000_000e18);
        token.mint(lp, 2_000_000e18);
        vm.prank(farmer);
        token.approve(address(market), type(uint256).max);
        vm.prank(lp);
        token.approve(address(vault), type(uint256).max);
        vm.prank(lp);
        vault.deposit(500_000e18, lp);
    }

    function _start() internal view returns (uint256) {
        uint256 earliest = block.timestamp + LEAD;
        return ((earliest + INTERVAL - 1) / INTERVAL) * INTERVAL;
    }

    function _buy(uint8 variable, uint256 payout) internal returns (uint256) {
        uint256 start = _start();
        vm.prank(farmer);
        return market.buyPolicy(TOKYO, variable, true, THRESHOLD, AUGUST, payout, start, TERM);
    }

    /// Post `perSample` at every point on a policy's settlement grid.
    function _fill(uint256 id, int256 perSample, uint256 howMany) internal {
        uint256 start = market.getPolicy(id).coverageStart;
        for (uint256 i = 0; i < howMany; i++) {
            weather.setReading(TOKYO, start + i * INTERVAL, perSample);
        }
    }

    function _expire(uint256 id) internal {
        vm.warp(market.getPolicy(id).expiry + 1);
    }

    /// Keep the feed fresh without touching the grid — this timestamp is past expiry
    /// and therefore outside the sampled window.
    function _freshen(int256 value) internal {
        weather.setReading(TOKYO, block.timestamp, value);
    }

    // =================================================================
    // The defect
    // =================================================================

    /// 2mm every single day for 30 days is 60mm — a WET month, comfortably above a 40mm
    /// drought strike. Point settlement compared the 2mm daily reading against the 40mm
    /// monthly threshold and paid the claim in full.
    function test_a_wet_month_would_have_settled_as_a_drought_under_point_settlement()
        public
    {
        uint256 id = _buy(RAINFALL, 10_000e18);
        _expire(id);
        _fill(id, 2e6, SAMPLES);
        _freshen(2e6);

        (int256 index,,) = market.policyIndex(id);
        assertEq(uint256(index), 60e6, "period total is not the sum of the samples");

        // What the old code compared: one sample against a monthly threshold.
        assertLt(2e6, THRESHOLD, "the per-day reading is not below the monthly strike");
        // What the premium was priced on, and what settlement now uses.
        assertGt(uint256(index), THRESHOLD, "the month is not actually wet");

        uint256 before = token.balanceOf(farmer);
        assertEq(market.settlePolicy(id), 0, "a wet month still paid out");
        assertEq(token.balanceOf(farmer), before);
    }

    /// And a genuinely dry month still pays, so the fix has not simply disabled claims.
    function test_a_dry_month_still_pays_in_full() public {
        uint256 payout = 10_000e18;
        uint256 id = _buy(RAINFALL, payout);
        _expire(id);
        _fill(id, 1e6, SAMPLES); // 30mm across the month, below the 40mm strike
        _freshen(1e6);

        (int256 index,,) = market.policyIndex(id);
        assertEq(uint256(index), 30e6);
        assertLt(uint256(index), THRESHOLD, "the month is not actually dry");

        uint256 before = token.balanceOf(farmer);
        assertEq(market.settlePolicy(id), payout);
        assertEq(token.balanceOf(farmer) - before, payout);
    }

    /// Flood cover is the mirror image and must not be broken by the same change.
    function test_flood_cover_triggers_on_the_period_total() public {
        pricing.setStrikeProbability(TOKYO, RAINFALL, false, THRESHOLD, AUGUST, 2000, 30);

        uint256 start = _start();
        vm.prank(farmer);
        uint256 id =
            market.buyPolicy(TOKYO, RAINFALL, false, THRESHOLD, AUGUST, 10_000e18, start, TERM);

        _expire(id);
        _fill(id, 5e6, SAMPLES); // 150mm — well above the strike
        _freshen(5e6);

        assertEq(market.settlePolicy(id), 10_000e18, "flood cover did not trigger");
    }

    // =================================================================
    // Aggregation is a property of the variable, not of the buyer
    // =================================================================

    /// Letting a buyer choose the statistic would decouple settlement from the
    /// probability the premium came from — the whole defect, reintroduced as a feature.
    function test_aggregation_comes_from_the_variable() public {
        assertTrue(market.variableConfigured(RAINFALL));
        assertEq(uint256(market.variableAggregation(RAINFALL)), uint256(WeatherPolicyMarket.Aggregation.SUM));

        uint256 id = _buy(RAINFALL, 10_000e18);
        assertEq(
            uint256(market.getPolicy(id).aggregation),
            uint256(WeatherPolicyMarket.Aggregation.SUM)
        );
    }

    /// An unconfigured variable must be refused rather than silently defaulting to SUM.
    /// The enum's zero value is SUM, so a temperature policy priced on monthly MEANS
    /// would otherwise have settled on the monthly total — off by a factor of 30.
    function test_unconfigured_variable_cannot_be_sold() public {
        uint256 start = _start();
        vm.prank(farmer);
        vm.expectRevert(
            abi.encodeWithSelector(
                WeatherPolicyMarket.VariableNotConfigured.selector, TEMPERATURE
            )
        );
        market.buyPolicy(TOKYO, TEMPERATURE, true, THRESHOLD, AUGUST, 10_000e18, start, TERM);
    }

    function test_average_aggregation_divides_by_samples_present() public {
        market.setVariableAggregation(TEMPERATURE, WeatherPolicyMarket.Aggregation.AVERAGE);

        uint256 id = _buy(TEMPERATURE, 10_000e18);
        _expire(id);
        _fill(id, 30e6, SAMPLES);
        _freshen(30e6);

        (int256 index, uint256 present,) = market.policyIndex(id);
        assertEq(present, SAMPLES);
        assertEq(uint256(index), 30e6, "average of a constant series is not that constant");
    }

    /// A configuration change must not reinterpret cover already in force.
    function test_changing_the_aggregation_does_not_touch_live_policies() public {
        uint256 id = _buy(RAINFALL, 10_000e18);
        market.setVariableAggregation(RAINFALL, WeatherPolicyMarket.Aggregation.AVERAGE);

        assertEq(
            uint256(market.getPolicy(id).aggregation),
            uint256(WeatherPolicyMarket.Aggregation.SUM),
            "an in-force policy had its settlement rule changed underneath it"
        );

        _expire(id);
        _fill(id, 2e6, SAMPLES);
        _freshen(2e6);
        // Still summed: 60mm, so no payout. Under AVERAGE it would be 2mm and would pay.
        assertEq(market.settlePolicy(id), 0);
    }

    // =================================================================
    // Missing readings
    // =================================================================

    /// A gap must not be papered over with the previous reading. `getReading` falls back
    /// to the latest value when the requested timestamp is absent, which is correct for a
    /// point query and would double-count in a sum.
    function test_a_missing_sample_is_skipped_not_substituted() public {
        uint256 id = _buy(RAINFALL, 10_000e18);
        _expire(id);
        _fill(id, 2e6, SAMPLES - 1); // 29 of 30 days
        _freshen(2e6);

        (int256 index, uint256 present, uint256 expected) = market.policyIndex(id);
        assertEq(expected, SAMPLES);
        assertEq(present, SAMPLES - 1, "the gap was filled by a fallback reading");
        assertEq(uint256(index), 58e6, "sum includes a substituted value");
    }

    /// Within tolerance, a policy still settles — real feeds drop days.
    function test_settles_with_a_tolerable_number_of_gaps() public {
        uint256 id = _buy(RAINFALL, 10_000e18);
        _expire(id);
        _fill(id, 2e6, SAMPLES - 2); // 28 of 30, exactly the climatology script's tolerance
        _freshen(2e6);

        assertTrue(market.hasSettleableIndex(id));
        market.settlePolicy(id);
        assertTrue(market.getPolicy(id).settled);
    }

    /// Past tolerance it must refuse, because an under-counted SUM biases drought cover
    /// toward paying out — the error runs against the LPs.
    function test_refuses_to_settle_with_too_many_gaps() public {
        uint256 id = _buy(RAINFALL, 10_000e18);
        _expire(id);
        _fill(id, 2e6, 10); // 10 of 30
        _freshen(2e6);

        assertFalse(market.hasSettleableIndex(id));
        vm.expectRevert(
            abi.encodeWithSelector(
                WeatherPolicyMarket.InsufficientSampleCoverage.selector, 10, SAMPLES
            )
        );
        market.settlePolicy(id);
    }

    /// The escape hatch has to answer the SAME question. If `settlePolicy` refuses for
    /// thin coverage and `voidUnsettleablePolicy` refuses because a reading exists, the
    /// policy is neither settleable nor voidable and its vault reservation is locked
    /// forever — the exact trap the void path was written to prevent.
    function test_a_policy_too_thin_to_settle_can_still_be_voided() public {
        uint256 id = _buy(RAINFALL, 10_000e18);
        assertEq(vault.totalReserved(), 10_000e18);

        _expire(id);
        _fill(id, 2e6, 10);
        vm.warp(market.getPolicy(id).expiry + market.SETTLEMENT_GRACE() + 1);
        _freshen(2e6); // a perfectly fresh, perfectly useless reading

        assertFalse(market.hasSettleableIndex(id), "coverage is sufficient - test is vacuous");

        uint256 before = token.balanceOf(farmer);
        market.voidUnsettleablePolicy(id);

        assertEq(vault.totalReserved(), 0, "capital stayed locked forever");
        assertGt(token.balanceOf(farmer), before, "premium not refunded");
    }

    // =================================================================
    // Term and grid constraints
    // =================================================================

    /// Settlement gas scales with the covered period, so the term is bounded by what one
    /// settlement can afford to read. A policy that cannot be settled cannot release its
    /// reservation — the same liveness trap the obligations loop was.
    function test_term_beyond_the_sample_bound_is_refused() public {
        uint256 samples = market.MAX_SAMPLES();
        uint256 tooLong = (samples + 1) * INTERVAL;
        uint256 start = _start();

        vm.prank(farmer);
        vm.expectRevert(
            abi.encodeWithSelector(
                WeatherPolicyMarket.TooManySamples.selector, samples + 1, samples
            )
        );
        market.buyPolicy(TOKYO, RAINFALL, true, THRESHOLD, AUGUST, 10_000e18, start, tooLong);
    }

    function test_term_at_exactly_the_sample_bound_is_allowed() public {
        uint256 ok = market.MAX_SAMPLES() * INTERVAL;
        uint256 start = _start();

        vm.prank(farmer);
        market.buyPolicy(TOKYO, RAINFALL, true, THRESHOLD, AUGUST, 10_000e18, start, ok);
        assertEq(market.totalOutstandingPayout(), 10_000e18);
    }

    /// A term shorter than one publication interval has no samples at all, so it could
    /// never be settled.
    function test_term_shorter_than_one_interval_is_refused() public {
        uint256 start = _start();
        vm.prank(farmer);
        vm.expectRevert(WeatherPolicyMarket.InvalidTerm.selector);
        market.buyPolicy(TOKYO, RAINFALL, true, THRESHOLD, AUGUST, 10_000e18, start, INTERVAL - 1);
    }

    /// The grid is anchored at `coverageStart`, so an unaligned start would ask for
    /// readings at times a daily feed never publishes — every sample missing, and a
    /// policy that could only ever be voided.
    function test_unaligned_coverage_start_is_refused() public {
        uint256 unaligned = _start() + 1;
        vm.prank(farmer);
        vm.expectRevert(
            abi.encodeWithSelector(
                WeatherPolicyMarket.UnalignedCoverageStart.selector, unaligned, INTERVAL
            )
        );
        market.buyPolicy(TOKYO, RAINFALL, true, THRESHOLD, AUGUST, 10_000e18, unaligned, TERM);
    }

    // =================================================================
    // Administration
    // =================================================================

    function test_sampling_interval_is_bounded() public {
        vm.expectRevert(WeatherPolicyMarket.InvalidParameter.selector);
        market.setSamplingInterval(1 hours - 1);

        vm.expectRevert(WeatherPolicyMarket.InvalidParameter.selector);
        market.setSamplingInterval(7 days + 1);

        market.setSamplingInterval(6 hours);
        assertEq(market.samplingInterval(), 6 hours);
    }

    /// Floored so the tolerance cannot be widened until an under-counted SUM becomes an
    /// easy way to trigger drought cover.
    function test_sample_coverage_floor_cannot_be_undercut() public {
        uint256 floorBps = market.MIN_SAMPLE_COVERAGE_FLOOR_BPS();

        vm.expectRevert(WeatherPolicyMarket.InvalidParameter.selector);
        market.setMinSampleCoverageBps(floorBps - 1);

        market.setMinSampleCoverageBps(floorBps);
        assertEq(market.minSampleCoverageBps(), floorBps);
    }

    function test_only_admin_can_configure_settlement() public {
        vm.startPrank(farmer);
        vm.expectRevert(WeatherPolicyMarket.UnauthorizedCaller.selector);
        market.setSamplingInterval(2 days);
        vm.expectRevert(WeatherPolicyMarket.UnauthorizedCaller.selector);
        market.setMinSampleCoverageBps(10000);
        vm.expectRevert(WeatherPolicyMarket.UnauthorizedCaller.selector);
        market.setVariableAggregation(TEMPERATURE, WeatherPolicyMarket.Aggregation.AVERAGE);
        vm.stopPrank();
    }

    /// Settlement cost is bounded, and the bound is worth measuring rather than asserting.
    function test_settlement_gas_is_bounded_at_the_maximum_term() public {
        uint256 samples = market.MAX_SAMPLES();
        uint256 start = _start();
        vm.prank(farmer);
        uint256 id = market.buyPolicy(
            TOKYO, RAINFALL, true, THRESHOLD, AUGUST, 10_000e18, start, samples * INTERVAL
        );

        vm.warp(market.getPolicy(id).expiry + 1);
        _fill(id, 1e6, samples);
        _freshen(1e6);

        uint256 before = gasleft();
        market.settlePolicy(id);
        uint256 used = before - gasleft();
        console.log("settlement gas at MAX_SAMPLES:", samples, used);

        assertLt(used, 3_000_000, "settlement at the maximum term is too expensive to rely on");
    }
}
