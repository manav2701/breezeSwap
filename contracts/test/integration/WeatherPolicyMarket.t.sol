// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../src/access/BreezeAccessControl.sol";
import "../../src/oracle/MockWeatherOracle.sol";
import "../../src/oracle/StrikeProbabilityOracle.sol";
import "../../src/vault/BreezeLiquidityVault.sol";
import "../../src/policy/WeatherPolicyMarket.sol";

contract PolicyToken is ERC20 {
    constructor() ERC20("Mock USDT", "mUSDT") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice End-to-end cover: a single buyer and a single LP, no counterparty.
contract WeatherPolicyMarketTest is Test {
    BreezeAccessControl accessControl;
    MockWeatherOracle weather;
    StrikeProbabilityOracle pricing;
    BreezeLiquidityVault vault;
    WeatherPolicyMarket policyMarket;
    PolicyToken token;

    address admin = address(this);
    address pauser = address(0x1111);
    address farmer = address(0xFA524E);
    address farmer2 = address(0xFA524F);
    address lp = address(0x11B);
    address lp2 = address(0x11C);
    address attacker = address(0xBAD);

    bytes32 constant TOKYO = keccak256("TOKYO_RAINFALL");
    bytes32 constant SEOUL = keccak256("SEOUL_RAINFALL");
    uint8 constant RAINFALL = 0;
    uint8 constant AUGUST = 8;
    uint8 constant JANUARY = 1;
    uint256 constant THRESHOLD = 40e6;
    uint256 constant TERM = 30 days;
    uint256 constant LEAD = 60 days; // comfortably past the 45-day sale window
    uint256 constant INTERVAL = 1 days; // matches the market's default sampling cadence
    uint256 constant SAMPLES = TERM / INTERVAL;

    function setUp() public {
        accessControl = new BreezeAccessControl(admin);
        accessControl.grantRole(accessControl.PAUSER_ROLE(), pauser);
        accessControl.grantRole(accessControl.ORACLE_UPDATER_ROLE(), admin);

        token = new PolicyToken();
        weather = new MockWeatherOracle(address(accessControl));
        pricing = new StrikeProbabilityOracle(address(accessControl));
        vault = new BreezeLiquidityVault(token, address(accessControl), "Breeze LP", "bLP");

        policyMarket = new WeatherPolicyMarket(
            address(accessControl),
            address(weather),
            address(pricing),
            address(vault),
            address(token)
        );

        vault.setMarketAuthorization(address(policyMarket), true);

        // Tokyo drought below 40mm: 6 of the last 30 Augusts => 20%.
        pricing.setStrikeProbability(TOKYO, RAINFALL, true, THRESHOLD, AUGUST, 2000, 30);
        pricing.setStrikeProbability(TOKYO, RAINFALL, true, THRESHOLD, JANUARY, 2000, 30);
        pricing.setStrikeProbability(SEOUL, RAINFALL, true, THRESHOLD, AUGUST, 2000, 30);

        token.mint(farmer, 1_000_000e18);
        token.mint(farmer2, 1_000_000e18);
        token.mint(lp, 2_000_000e18);
        token.mint(lp2, 2_000_000e18);

        vm.prank(farmer);
        token.approve(address(policyMarket), type(uint256).max);
        vm.prank(farmer2);
        token.approve(address(policyMarket), type(uint256).max);
        vm.prank(lp);
        token.approve(address(vault), type(uint256).max);
        vm.prank(lp2);
        token.approve(address(vault), type(uint256).max);

        vm.prank(lp);
        vault.deposit(500_000e18, lp);
    }

    /// LPs must serve the withdrawal cooldown before exiting.

    function _readyToWithdraw(address who) internal {

        vm.prank(who);

        vault.requestWithdrawal();

        vm.warp(block.timestamp + vault.withdrawalCooldown());

    }


    /// Cover must start on a publication boundary, since the settlement grid is
    /// anchored there — an unaligned start would ask the oracle for readings at times
    /// a daily feed never publishes.
    ///
    /// @dev Deliberately `pure` in effect: reads `INTERVAL` rather than calling
    /// `policyMarket.samplingInterval()`. An external view call here is evaluated as an
    /// argument, so it consumed the `vm.prank` or `vm.expectRevert` armed immediately
    /// before it — every buy then came from the test contract instead of the farmer, and
    /// every expected revert silently applied to the wrong call.
    function _start() internal view returns (uint256) {
        uint256 earliest = block.timestamp + LEAD;
        return ((earliest + INTERVAL - 1) / INTERVAL) * INTERVAL;
    }

    function _buy(uint256 payout) internal returns (uint256 policyId) {
        vm.prank(farmer);
        return
            policyMarket.buyPolicy(TOKYO, RAINFALL, true, THRESHOLD, AUGUST, payout, _start(), TERM);
    }

    function _setReading(bytes32 region, int256 value) internal {
        weather.setReading(region, block.timestamp, value);
    }

    /// Post readings across a policy's whole covered period so that the SUM comes to
    /// `periodTotal`.
    ///
    /// @dev Settlement aggregates the covered period rather than reading a single value
    /// at expiry, because the premium was priced off monthly TOTALS
    /// (`weather-seed/src/climatology.ts`). The tests already passed monthly-total-shaped
    /// values against a 40mm threshold, so the intent of each is preserved exactly by
    /// spreading that total across the samples.
    function _fillCoverage(uint256 policyId, bytes32 region, int256 periodTotal) internal {
        uint256 start = policyMarket.getPolicy(policyId).coverageStart;
        int256 perSample = periodTotal / int256(SAMPLES);
        for (uint256 i = 0; i < SAMPLES; i++) {
            weather.setReading(region, start + i * INTERVAL, perSample);
        }
    }

    /// Move past expiry, record the whole covered period, and leave the feed fresh.
    ///
    /// @dev The last grid sample sits one interval before expiry, so on its own it
    /// reads as stale — hence the extra reading at `block.timestamp`. It falls outside
    /// the sampling grid and so contributes nothing to the index.
    function _expireWith(uint256 policyId, int256 periodTotal) internal {
        uint256 expiry = policyMarket.getPolicy(policyId).expiry;
        vm.warp(expiry + 1);
        _fillCoverage(policyId, TOKYO, periodTotal);
        _setReading(TOKYO, periodTotal / int256(SAMPLES));
    }

    // =================================================================
    // Core flow
    // =================================================================

    function test_quote_matches_probability_plus_load() public view {
        // 20% of 10,000 = 2,000 fair value. Base load 30%, utilisation 0 => 2,600.
        assertEq(
            policyMarket.quote(TOKYO, RAINFALL, true, THRESHOLD, AUGUST, 10_000e18),
            2_600e18
        );
    }

    function test_single_lp_and_single_buyer_can_clear() public {
        uint256 id = _buy(10_000e18);
        WeatherPolicyMarket.Policy memory pol = policyMarket.getPolicy(id);
        address holder = pol.holder;
        uint256 payout = pol.payout;
        assertEq(holder, farmer);
        assertEq(payout, 10_000e18);
    }

    function test_buying_locks_capital_for_the_full_payout() public {
        uint256 payout = 10_000e18;
        _buy(payout);

        // GROSS. Reserving net of premium would leave the claim short by exactly
        // the premium once that premium vests into withdrawable LP value.
        assertEq(vault.totalReserved(), payout);
        assertEq(policyMarket.totalOutstandingPayout(), payout);
    }

    /// The defect this reservation model exists to prevent: an LP exits after
    /// the premium vests, and the buyer's claim comes up short.
    function test_claim_is_paid_in_full_even_after_every_lp_exits() public {
        uint256 payout = 100_000e18;
        uint256 id = _buy(payout);

        // Let the premium fully vest, then let the LP take everything they can.
        vm.warp(block.timestamp + vault.profitUnlockPeriod() + 1);
        _readyToWithdraw(lp);
        uint256 redeemable = vault.maxRedeem(lp);
        vm.prank(lp);
        vault.redeem(redeemable, lp, lp);

        _expireWith(id, 10e6);
        uint256 before = token.balanceOf(farmer);
        policyMarket.settlePolicy(id);

        assertEq(token.balanceOf(farmer) - before, payout, "claim short-changed by LP exit");
    }

    /// A high-probability strike is where net reservation degenerated worst:
    /// premium is most of the payout, so almost nothing was reserved.
    function test_high_probability_strike_is_still_fully_collateralised() public {
        pricing.setStrikeProbability(SEOUL, RAINFALL, true, THRESHOLD, JANUARY, 7000, 30);

        uint256 payout = 100_000e18;
        vm.prank(farmer);
        uint256 id = policyMarket.buyPolicy(
            SEOUL, RAINFALL, true, THRESHOLD, JANUARY, payout, _start(), TERM
        );

        assertEq(vault.totalReserved(), payout, "high-probability cover under-reserved");

        vm.warp(block.timestamp + vault.profitUnlockPeriod() + 1);
        _readyToWithdraw(lp);
        uint256 redeemable = vault.maxRedeem(lp);
        vm.prank(lp);
        vault.redeem(redeemable, lp, lp);

        uint256 expiry = policyMarket.getPolicy(id).expiry;
        vm.warp(expiry + 1);
        _fillCoverage(id, SEOUL, 10e6);
        weather.setReading(SEOUL, block.timestamp, int256(10e6) / int256(SAMPLES));

        uint256 before = token.balanceOf(farmer);
        policyMarket.settlePolicy(id);
        assertEq(token.balanceOf(farmer) - before, payout, "buyer did not receive real cover");
    }

    // -----------------------------------------------------------------
    // Unsettleable policies must not trap LP capital
    // -----------------------------------------------------------------

    function test_policy_with_no_oracle_reading_can_be_voided_after_grace() public {
        uint256 id = _buy(10_000e18);
        assertEq(vault.totalReserved(), 10_000e18);

        uint256 expiry = policyMarket.getPolicy(id).expiry;
        vm.warp(expiry + policyMarket.SETTLEMENT_GRACE() + 1);

        uint256 before = token.balanceOf(farmer);
        policyMarket.voidUnsettleablePolicy(id);

        assertEq(vault.totalReserved(), 0, "capital stayed locked forever");
        assertGt(token.balanceOf(farmer), before, "premium not refunded");
    }

    function test_cannot_void_before_the_grace_period() public {
        uint256 id = _buy(10_000e18);
        uint256 expiry = policyMarket.getPolicy(id).expiry;
        vm.warp(expiry + 1);

        vm.expectRevert(WeatherPolicyMarket.PolicyNotExpired.selector);
        policyMarket.voidUnsettleablePolicy(id);
    }

    /// @dev "Can be settled" now means the covered PERIOD is on record, not that some
    /// reading exists. A single fresh reading is no longer enough, which is why this
    /// test fills the grid — and the two guards have to agree on the question, or a
    /// policy could be neither settleable nor voidable and its reservation would be
    /// locked forever.
    function test_cannot_void_a_policy_that_can_be_settled_properly() public {
        uint256 id = _buy(10_000e18);
        uint256 expiry = policyMarket.getPolicy(id).expiry;
        vm.warp(expiry + policyMarket.SETTLEMENT_GRACE() + 1);
        _fillCoverage(id, TOKYO, 10e6);
        _setReading(TOKYO, int256(10e6) / int256(SAMPLES));
        assertTrue(policyMarket.hasSettleableIndex(id), "grid was not filled - test is vacuous");

        vm.expectRevert(WeatherPolicyMarket.PolicyStillSettleable.selector);
        policyMarket.voidUnsettleablePolicy(id);
    }

    function test_cannot_void_an_already_settled_policy() public {
        uint256 id = _buy(10_000e18);
        _expireWith(id, 10e6);
        policyMarket.settlePolicy(id);

        vm.warp(block.timestamp + policyMarket.SETTLEMENT_GRACE() + 1);
        vm.expectRevert(WeatherPolicyMarket.PolicyAlreadySettled.selector);
        policyMarket.voidUnsettleablePolicy(id);
    }

    function test_drought_pays_the_farmer_in_full() public {
        uint256 payout = 10_000e18;
        uint256 id = _buy(payout);
        uint256 before = token.balanceOf(farmer);

        _expireWith(id, 25e6);
        uint256 paid = policyMarket.settlePolicy(id);

        assertEq(paid, payout);
        assertEq(token.balanceOf(farmer) - before, payout);
    }

    function test_no_drought_pays_nothing() public {
        uint256 id = _buy(10_000e18);
        _expireWith(id, 85e6);
        assertEq(policyMarket.settlePolicy(id), 0);
    }

    function test_settlement_releases_reservation_and_peril_exposure() public {
        uint256 id = _buy(10_000e18);
        bytes32 peril = policyMarket.perilKey(TOKYO, AUGUST);
        assertEq(policyMarket.perilExposure(peril), 10_000e18);

        _expireWith(id, 85e6);
        policyMarket.settlePolicy(id);

        assertEq(vault.totalReserved(), 0);
        assertEq(policyMarket.totalOutstandingPayout(), 0);
        assertEq(policyMarket.perilExposure(peril), 0);
    }

    function test_payout_reduces_lp_share_value() public {
        uint256 shares = vault.balanceOf(lp);
        uint256 before = vault.convertToAssets(shares);

        uint256 id = _buy(50_000e18);
        _expireWith(id, 10e6);
        policyMarket.settlePolicy(id);

        assertLt(vault.convertToAssets(shares), before);
    }

    // =================================================================
    // Premium free-riding — the exploit this design has to prevent
    // =================================================================

    /// An LP who arrives just before a sale and leaves just after must not
    /// capture premium they carried no risk for.
    function test_lp_cannot_deposit_and_exit_around_a_sale_to_capture_premium() public {
        vm.prank(lp2);
        uint256 shares = vault.deposit(100_000e18, lp2);

        _buy(50_000e18); // large premium arrives

        // Resolve the redeemable amount before pranking: vm.prank applies to the
        // next call only, and a view call would consume it.
        _readyToWithdraw(lp2);
        uint256 redeemable = vault.maxRedeem(lp2);

        vm.prank(lp2);
        uint256 out = vault.redeem(redeemable, lp2, lp2);

        assertLe(out, 100_000e18, "captured premium without carrying risk");
        assertGt(shares, 0);
    }

    /// Premium is held as an unearned reserve by the policy market, not paid to
    /// the vault, until the covered risk actually resolves.
    function test_premium_is_held_unearned_until_the_risk_resolves() public {
        uint256 payout = 50_000e18;
        uint256 premium = policyMarket.quote(TOKYO, RAINFALL, true, THRESHOLD, AUGUST, payout);

        uint256 id = _buy(payout);

        assertEq(policyMarket.unearnedPremium(), premium, "premium not held unearned");
        assertEq(
            token.balanceOf(address(policyMarket)), premium, "premium not retained by the market"
        );

        _expireWith(id, 85e6); // no claim
        policyMarket.settlePolicy(id);

        assertEq(policyMarket.unearnedPremium(), 0, "premium never earned");
        assertEq(token.balanceOf(address(policyMarket)), 0, "premium not remitted");
    }

    /// The point of holding it: an LP cannot be paid for a risk period that has
    /// not started, let alone one that has not finished.
    function test_lp_share_value_does_not_move_when_a_policy_is_sold() public {
        uint256 shares = vault.balanceOf(lp);
        uint256 before = vault.convertToAssets(shares);

        _buy(50_000e18);

        assertApproxEqAbs(
            vault.convertToAssets(shares), before, 1, "LP was paid before underwriting anything"
        );
    }

    function test_premium_reaches_lps_only_after_settlement_and_vesting() public {
        uint256 shares = vault.balanceOf(lp);
        uint256 before = vault.convertToAssets(shares);

        uint256 id = _buy(50_000e18);
        _expireWith(id, 85e6);

        // Still nothing before settlement, even though the risk period is over.
        assertApproxEqAbs(vault.convertToAssets(shares), before, 1, "premium leaked pre-settlement");

        policyMarket.settlePolicy(id);
        vm.warp(block.timestamp + vault.profitUnlockPeriod() + 1);

        assertGt(vault.convertToAssets(shares), before, "premium never reached LPs");
    }

    function test_claim_is_paid_without_ever_crediting_the_premium_to_lps() public {
        uint256 shares = vault.balanceOf(lp);
        uint256 before = vault.convertToAssets(shares);

        uint256 id = _buy(50_000e18);
        _expireWith(id, 10e6); // drought — claim triggers
        policyMarket.settlePolicy(id);
        vm.warp(block.timestamp + vault.profitUnlockPeriod() + 1);

        // Premium is earned on settlement, but the payout is larger, so LPs are
        // net down. They are paid for the risk and they carry it.
        assertLt(vault.convertToAssets(shares), before, "LPs did not bear the claim");
        assertEq(policyMarket.unearnedPremium(), 0);
    }

    function test_voiding_refunds_premium_without_touching_lp_capital() public {
        uint256 payout = 10_000e18;
        uint256 premium = policyMarket.quote(TOKYO, RAINFALL, true, THRESHOLD, AUGUST, payout);
        uint256 shares = vault.balanceOf(lp);
        uint256 lpBefore = vault.convertToAssets(shares);

        uint256 id = _buy(payout);
        uint256 expiry = policyMarket.getPolicy(id).expiry;
        vm.warp(expiry + policyMarket.SETTLEMENT_GRACE() + 1);

        uint256 farmerBefore = token.balanceOf(farmer);
        policyMarket.voidUnsettleablePolicy(id);

        assertEq(token.balanceOf(farmer) - farmerBefore, premium, "premium not fully refunded");
        assertApproxEqAbs(
            vault.convertToAssets(shares), lpBefore, 1, "refund came out of LP capital"
        );
        assertEq(policyMarket.unearnedPremium(), 0);
    }

    function test_unlock_period_is_bounded() public {
        vm.expectRevert(BreezeLiquidityVault.InvalidUnlockPeriod.selector);
        vault.setProfitUnlockPeriod(0);

        uint256 tooLong = vault.MAX_PROFIT_UNLOCK_PERIOD() + 1;
        vm.expectRevert(BreezeLiquidityVault.InvalidUnlockPeriod.selector);
        vault.setProfitUnlockPeriod(tooLong);
    }

    function test_changing_unlock_period_does_not_revest_inflight_premium() public {
        _buy(50_000e18);
        vm.warp(block.timestamp + 6 days); // nearly fully recognised
        uint256 remaining = vault.lockedProfitRemaining();

        vault.setProfitUnlockPeriod(90 days);

        assertApproxEqAbs(vault.lockedProfitRemaining(), remaining, 1, "in-flight premium re-vested");
    }

    function test_non_admin_cannot_change_unlock_period() public {
        vm.prank(attacker);
        vm.expectRevert(BreezeLiquidityVault.UnauthorizedCaller.selector);
        vault.setProfitUnlockPeriod(30 days);
    }

    // =================================================================
    // Sale window — adverse selection
    // =================================================================

    function test_cover_starting_inside_the_forecast_window_is_refused() public {
        vm.prank(farmer);
        vm.expectRevert();
        policyMarket.buyPolicy(
            TOKYO, RAINFALL, true, THRESHOLD, AUGUST, 10_000e18, block.timestamp + 1 days, TERM
        );
    }

    /// @dev The start is deliberately kept ALIGNED here, one whole interval inside the
    /// window rather than one second. A bare `vm.expectRevert()` against an unaligned
    /// timestamp would pass on `UnalignedCoverageStart` and prove nothing about the
    /// forecast window at all.
    function test_cover_starting_just_inside_the_window_is_refused() public {
        vm.warp(INTERVAL);
        uint256 tooSoon = block.timestamp + policyMarket.minLeadTime() - INTERVAL;
        assertEq(tooSoon % INTERVAL, 0, "start is unaligned - would revert for the wrong reason");

        vm.prank(farmer);
        vm.expectRevert(
            abi.encodeWithSelector(
                WeatherPolicyMarket.InsideForecastWindow.selector,
                tooSoon,
                block.timestamp + policyMarket.minLeadTime()
            )
        );
        policyMarket.buyPolicy(TOKYO, RAINFALL, true, THRESHOLD, AUGUST, 10_000e18, tooSoon, TERM);
    }

    /// @dev Two constraints now interact: the earliest permitted start is the lead time,
    /// AND the start must sit on the oracle's publication grid. Warping to an interval
    /// boundary is what makes "exactly at the lead time" also a legal grid point.
    function test_cover_at_exactly_the_lead_time_is_allowed() public {
        vm.warp(INTERVAL);
        uint256 ok = block.timestamp + policyMarket.minLeadTime();
        assertEq(ok % INTERVAL, 0, "lead-time boundary is off the sampling grid");

        vm.prank(farmer);
        policyMarket.buyPolicy(TOKYO, RAINFALL, true, THRESHOLD, AUGUST, 10_000e18, ok, TERM);
        assertEq(policyMarket.totalOutstandingPayout(), 10_000e18);
    }

    function test_lead_time_cannot_be_set_below_the_forecast_horizon() public {
        uint256 floor_ = policyMarket.MIN_LEAD_TIME_FLOOR();
        vm.expectRevert(WeatherPolicyMarket.InvalidParameter.selector);
        policyMarket.setMinLeadTime(floor_ - 1);
    }

    function test_admin_can_lengthen_lead_time() public {
        policyMarket.setMinLeadTime(90 days);
        assertEq(policyMarket.minLeadTime(), 90 days);
    }

    function test_non_admin_cannot_change_lead_time() public {
        vm.prank(attacker);
        vm.expectRevert(WeatherPolicyMarket.UnauthorizedCaller.selector);
        policyMarket.setMinLeadTime(90 days);
    }

    // =================================================================
    // Correlated exposure
    // =================================================================

    function test_peril_exposure_accumulates_within_a_region_month() public {
        _buy(30_000e18);
        vm.prank(farmer2);
        policyMarket.buyPolicy(TOKYO, RAINFALL, true, THRESHOLD, AUGUST, 20_000e18, _start(), TERM);

        assertEq(policyMarket.perilExposure(policyMarket.perilKey(TOKYO, AUGUST)), 50_000e18);
    }

    function test_peril_cap_blocks_over_concentration() public {
        // Vault ~500k, cap 20% => ~100k for Tokyo/August.
        _buy(90_000e18);

        vm.prank(farmer2);
        vm.expectRevert();
        policyMarket.buyPolicy(TOKYO, RAINFALL, true, THRESHOLD, AUGUST, 30_000e18, _start(), TERM);
    }

    function test_different_months_are_separate_perils() public {
        _buy(90_000e18);

        // January is a different bucket, so it is unaffected by August's fill.
        vm.prank(farmer2);
        policyMarket.buyPolicy(TOKYO, RAINFALL, true, THRESHOLD, JANUARY, 50_000e18, _start(), TERM);

        assertEq(policyMarket.perilExposure(policyMarket.perilKey(TOKYO, JANUARY)), 50_000e18);
    }

    function test_different_regions_are_separate_perils() public {
        _buy(90_000e18);

        vm.prank(farmer2);
        policyMarket.buyPolicy(SEOUL, RAINFALL, true, THRESHOLD, AUGUST, 50_000e18, _start(), TERM);

        assertEq(policyMarket.perilExposure(policyMarket.perilKey(SEOUL, AUGUST)), 50_000e18);
    }

    function test_peril_cap_is_bounded_by_ceiling() public {
        uint256 ceiling = policyMarket.MAX_PERIL_EXPOSURE_CEILING_BPS();
        vm.expectRevert(WeatherPolicyMarket.InvalidParameter.selector);
        policyMarket.setMaxPerilExposureBps(ceiling + 1);
    }

    function test_peril_cap_cannot_be_zero() public {
        vm.expectRevert(WeatherPolicyMarket.InvalidParameter.selector);
        policyMarket.setMaxPerilExposureBps(0);
    }

    // =================================================================
    // Solvency floor and dynamic pricing
    // =================================================================

    function test_utilization_starts_at_zero() public view {
        assertEq(policyMarket.currentUtilizationBps(), 0);
    }

    function test_utilization_rises_as_cover_is_written() public {
        _buy(90_000e18);
        assertGt(policyMarket.currentUtilizationBps(), 0);
    }

    function test_effective_load_rises_with_utilization() public {
        uint256 loadBefore = policyMarket.effectiveRiskLoadBps();
        _buy(90_000e18);
        assertGt(policyMarket.effectiveRiskLoadBps(), loadBefore, "load did not respond to utilisation");
    }

    function test_cover_costs_more_when_the_pool_is_fuller() public {
        uint256 quoteBefore = policyMarket.quote(TOKYO, RAINFALL, true, THRESHOLD, AUGUST, 10_000e18);
        _buy(90_000e18);
        uint256 quoteAfter = policyMarket.quote(TOKYO, RAINFALL, true, THRESHOLD, AUGUST, 10_000e18);

        assertGt(quoteAfter, quoteBefore, "price ignored scarcity of capital");
    }

    function test_underwriting_halts_above_the_solvency_floor() public {
        policyMarket.setMaxUnderwritingUtilizationBps(500); // 5%
        _buy(90_000e18); // pushes utilisation past the floor

        vm.prank(farmer2);
        vm.expectRevert();
        policyMarket.buyPolicy(SEOUL, RAINFALL, true, THRESHOLD, AUGUST, 10_000e18, _start(), TERM);
    }

    function test_solvency_floor_is_bounded() public {
        vm.expectRevert(WeatherPolicyMarket.InvalidParameter.selector);
        policyMarket.setMaxUnderwritingUtilizationBps(0);

        vm.expectRevert(WeatherPolicyMarket.InvalidParameter.selector);
        policyMarket.setMaxUnderwritingUtilizationBps(10001);
    }

    // =================================================================
    // LP protection
    // =================================================================

    function test_risk_load_cannot_be_set_to_zero() public {
        vm.expectRevert(WeatherPolicyMarket.RiskLoadTooLow.selector);
        policyMarket.setRiskLoadBps(0);
    }

    function test_risk_load_cannot_be_set_below_the_floor() public {
        uint256 floor_ = policyMarket.MIN_RISK_LOAD_BPS();
        vm.expectRevert(WeatherPolicyMarket.RiskLoadTooLow.selector);
        policyMarket.setRiskLoadBps(floor_ - 1);
    }

    function test_risk_load_cannot_exceed_oracle_ceiling() public {
        uint256 tooHigh = pricing.MAX_RISK_LOAD_BPS() + 1;
        vm.expectRevert(WeatherPolicyMarket.RiskLoadTooHigh.selector);
        policyMarket.setRiskLoadBps(tooHigh);
    }

    function test_admin_can_set_risk_load_within_bounds() public {
        policyMarket.setRiskLoadBps(1500);
        assertEq(policyMarket.riskLoadBps(), 1500);
    }

    function test_non_admin_cannot_change_risk_load() public {
        vm.prank(attacker);
        vm.expectRevert(WeatherPolicyMarket.UnauthorizedCaller.selector);
        policyMarket.setRiskLoadBps(1000);
    }

    function test_lps_profit_over_a_full_no_claim_cycle() public {
        uint256 shares = vault.balanceOf(lp);
        uint256 before = vault.convertToAssets(shares);

        uint256 id = _buy(50_000e18);
        _expireWith(id, 85e6); // no drought
        policyMarket.settlePolicy(id);
        vm.warp(block.timestamp + vault.profitUnlockPeriod() + 1);

        assertGt(vault.convertToAssets(shares), before, "LPs did not earn the premium");
    }

    // =================================================================
    // Guards
    // =================================================================

    function test_cannot_settle_before_expiry() public {
        uint256 id = _buy(10_000e18);
        _setReading(TOKYO, 10e6);
        vm.expectRevert(WeatherPolicyMarket.PolicyNotExpired.selector);
        policyMarket.settlePolicy(id);
    }

    function test_cannot_settle_during_the_coverage_period() public {
        uint256 id = _buy(10_000e18);
        vm.warp(block.timestamp + LEAD + 1 days); // inside cover, before expiry
        _setReading(TOKYO, 10e6);
        vm.expectRevert(WeatherPolicyMarket.PolicyNotExpired.selector);
        policyMarket.settlePolicy(id);
    }

    function test_cannot_settle_twice() public {
        uint256 id = _buy(10_000e18);
        _expireWith(id, 10e6);
        policyMarket.settlePolicy(id);

        vm.expectRevert(WeatherPolicyMarket.PolicyAlreadySettled.selector);
        policyMarket.settlePolicy(id);
    }

    function test_stale_oracle_blocks_settlement() public {
        uint256 id = _buy(10_000e18);
        uint256 expiry = policyMarket.getPolicy(id).expiry;
        vm.warp(expiry + 1);
        _setReading(TOKYO, 10e6);
        vm.warp(block.timestamp + 30 days); // reading goes stale

        vm.expectRevert(WeatherPolicyMarket.OracleUnusable.selector);
        policyMarket.settlePolicy(id);
    }

    function test_unpriced_strike_cannot_be_bought() public {
        vm.prank(farmer);
        vm.expectRevert();
        policyMarket.buyPolicy(TOKYO, RAINFALL, true, 999e6, AUGUST, 10_000e18, _start(), TERM);
    }

    function test_term_is_bounded() public {
        vm.prank(farmer);
        vm.expectRevert(WeatherPolicyMarket.InvalidTerm.selector);
        policyMarket.buyPolicy(
            TOKYO, RAINFALL, true, THRESHOLD, AUGUST, 10_000e18, _start(), 400 days
        );
    }

    function test_zero_term_is_rejected() public {
        vm.prank(farmer);
        vm.expectRevert(WeatherPolicyMarket.InvalidTerm.selector);
        policyMarket.buyPolicy(TOKYO, RAINFALL, true, THRESHOLD, AUGUST, 10_000e18, _start(), 0);
    }

    function test_zero_payout_is_rejected() public {
        vm.prank(farmer);
        vm.expectRevert(WeatherPolicyMarket.InvalidPayout.selector);
        policyMarket.buyPolicy(TOKYO, RAINFALL, true, THRESHOLD, AUGUST, 0, _start(), TERM);
    }

    function test_cannot_buy_beyond_vault_capacity() public {
        vm.prank(farmer);
        vm.expectRevert();
        policyMarket.buyPolicy(
            TOKYO, RAINFALL, true, THRESHOLD, AUGUST, 5_000_000e18, _start(), TERM
        );
    }

    function test_unauthorized_caller_cannot_drain_vault() public {
        vm.prank(attacker);
        vm.expectRevert(BreezeLiquidityVault.UnauthorizedCaller.selector);
        vault.coverLoss(100_000e18);
    }

    // =================================================================
    // Pause discipline
    // =================================================================

    function test_pause_blocks_buying() public {
        vm.prank(pauser);
        policyMarket.pauseBuying();

        vm.prank(farmer);
        vm.expectRevert();
        policyMarket.buyPolicy(TOKYO, RAINFALL, true, THRESHOLD, AUGUST, 10_000e18, _start(), TERM);
    }

    function test_pause_never_blocks_settlement() public {
        uint256 payout = 10_000e18;
        uint256 id = _buy(payout);

        vm.prank(pauser);
        policyMarket.pauseBuying();

        _expireWith(id, 10e6);
        uint256 before = token.balanceOf(farmer);
        policyMarket.settlePolicy(id);

        assertEq(token.balanceOf(farmer) - before, payout, "pause withheld a valid claim");
    }

    function test_unpause_restores_buying() public {
        vm.prank(pauser);
        policyMarket.pauseBuying();
        vm.prank(pauser);
        policyMarket.unpauseBuying();

        _buy(10_000e18);
        assertEq(policyMarket.totalOutstandingPayout(), 10_000e18);
    }

    function test_non_pauser_cannot_pause() public {
        vm.prank(attacker);
        vm.expectRevert(WeatherPolicyMarket.UnauthorizedCaller.selector);
        policyMarket.pauseBuying();
    }

    // =================================================================
    // Fuzz
    // =================================================================

    function testFuzz_premium_is_always_below_payout(uint256 payout) public {
        payout = bound(payout, 1e18, 80_000e18);
        uint256 premium = policyMarket.quote(TOKYO, RAINFALL, true, THRESHOLD, AUGUST, payout);
        assertLt(premium, payout);
    }

    function testFuzz_reservation_always_covers_the_whole_payout(uint256 payout) public {
        payout = bound(payout, 1e18, 80_000e18);
        _buy(payout);

        // The full promise is locked, independent of how much premium was paid.
        assertEq(vault.totalReserved(), payout);
    }

    function testFuzz_settlement_always_clears_exposure(uint256 payout, bool drought) public {
        payout = bound(payout, 1e18, 80_000e18);
        uint256 id = _buy(payout);

        _expireWith(id, drought ? int256(10e6) : int256(90e6));
        policyMarket.settlePolicy(id);

        assertEq(policyMarket.totalOutstandingPayout(), 0);
        assertEq(policyMarket.perilExposure(policyMarket.perilKey(TOKYO, AUGUST)), 0);
        assertEq(vault.totalReserved(), 0);
    }
}
