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

contract ScaleToken is ERC20 {
    constructor() ERC20("Mock USDT", "mUSDT") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Regression coverage for the funding-rate scale defect.
///
/// `settleFunding` compared a 1e18-scaled mark price directly against a raw
/// oracle reading, which the SDK publishes with 6 decimals. The deviation was
/// therefore of order 1e12 basis points on every single call, and the rate was
/// clamped to `MAX_FUNDING_RATE_PER_PERIOD` in the same direction forever.
///
/// The failure was invisible from the outside: funding still accrued, positions
/// still paid, nothing reverted. What had stopped working was the mechanism's
/// entire purpose — it was no longer pulling mark toward index, it was a fixed
/// maximum levy on one side that no market condition could change. These tests
/// pin the behaviour that distinguishes the two.
contract PerpFundingScaleTest is Test {
    BreezeAccessControl accessControl;
    MockWeatherOracle oracle;
    FeeConfig feeConfig;
    ProtocolTreasury treasury;
    InsuranceFund insuranceFund;
    ScaleToken token;
    BreezePerpMarket market;

    address admin = address(this);
    address alice = address(0xA11CE);
    bytes32 constant REGION = keccak256("TOKYO_RAINFALL");

    /// 5m / 200k = mark price of 25.0, in 1e18 terms.
    uint256 constant COLLATERAL_RESERVE = 5_000_000e18;
    uint256 constant WEATHER_RESERVE = 200_000e18;

    function setUp() public {
        vm.warp(1_700_000_000);
        accessControl = new BreezeAccessControl(admin);
        accessControl.grantRole(accessControl.ORACLE_UPDATER_ROLE(), admin);
        oracle = new MockWeatherOracle(address(accessControl));
        token = new ScaleToken();

        feeConfig = new FeeConfig(address(accessControl));
        treasury = new ProtocolTreasury(address(token), address(accessControl));
        insuranceFund = new InsuranceFund(address(token), address(accessControl));

        market = new BreezePerpMarket(
            VirtualAMM.Reserves({
                collateralReserve: COLLATERAL_RESERVE,
                weatherReserve: WEATHER_RESERVE
            }),
            address(oracle),
            address(insuranceFund),
            address(feeConfig),
            address(treasury),
            address(accessControl),
            address(token),
            REGION
        );
        insuranceFund.setMarketAuthorization(address(market), true);

        token.mint(alice, 5_000_000e18);
        vm.prank(alice);
        token.approve(address(market), type(uint256).max);
    }

    function _settleWith(int256 reading) internal {
        vm.warp(block.timestamp + market.fundingInterval());
        oracle.setReading(REGION, block.timestamp, reading);
        market.settleFunding();
    }

    // -----------------------------------------------------------------
    // Scale reconciliation
    // -----------------------------------------------------------------

    /// The default must match `ORACLE_DECIMALS = 6` in the SDK, which the indexer
    /// and the climatology seeder also follow. A silent divergence here is exactly
    /// how the original defect arose.
    function test_default_scale_matches_the_sdk_oracle_decimals() public view {
        assertEq(market.oracleValueScale(), 1e6);
    }

    /// A reading of 25.0 must normalise to the same 1e18 magnitude as a mark price
    /// of 25.0.
    function test_reading_normalises_onto_the_mark_price_scale() public view {
        assertEq(market.indexPrice(25e6), 25e18);
        assertEq(market.getMarkPrice(), 25e18);
    }

    /// The defining property of a working funding rate: when mark equals index,
    /// funding is zero. Under the scale bug this was impossible — the rate was
    /// pinned at the cap even here.
    function test_funding_is_zero_when_mark_equals_index() public {
        _settleWith(25e6);
        assertEq(market.currentFundingRate(), 0, "funding non-zero at parity");
    }

    /// And it must respond proportionally to a real gap rather than saturating.
    /// A 4% deviation is inside the 5% cap, so an unsaturated rate proves the
    /// deviation is actually being measured.
    function test_funding_tracks_a_real_deviation_without_saturating() public {
        // Index 0.4% BELOW mark: mark > index, so longs pay and the rate is
        // positive. Kept inside the production 75 bps cap on purpose — an
        // unsaturated rate is the only thing that proves the deviation is actually
        // being measured rather than clamped.
        _settleWith(24.9e6);

        // The rate just computed lives in `currentFundingRate`; `cumulativeFundingIndex`
        // deliberately still holds the index committed for the window that just
        // ENDED, since the new rate applies going forward.
        int256 rate = market.currentFundingRate();
        assertGt(rate, 0, "wrong sign: mark above index should charge longs");
        assertLt(
            rate,
            int256(market.maxFundingRateBps()),
            "rate saturated on a deviation inside the cap"
        );
        assertApproxEqAbs(rate, 40, 2, "rate does not match the actual deviation");
    }

    /// Sign convention, both directions, at the same magnitude.
    function test_funding_sign_follows_the_mark_index_gap() public {
        _settleWith(24e6);
        int256 markAbove = market.currentFundingRate();

        _settleWith(26e6);
        int256 markBelow = market.currentFundingRate();

        assertGt(markAbove, 0, "mark above index must charge longs");
        assertLt(markBelow, 0, "mark below index must credit longs");
    }

    /// The cap still binds on a genuinely extreme gap — responsiveness must not
    /// have come at the cost of the bound.
    function test_cap_still_binds_on_an_extreme_gap() public {
        _settleWith(1);
        assertEq(
            market.currentFundingRate(),
            int256(market.maxFundingRateBps()),
            "extreme gap did not clamp to the cap"
        );
    }

    /// A misdeclared scale reintroduces the defect, so the test that matters is
    /// that a CORRECTLY declared scale removes it for any adapter precision.
    function test_a_differently_scaled_adapter_can_be_reconciled() public {
        market.setOracleValueScale(1e2); // an adapter publishing x100
        _settleWith(2500); // 25.00
        assertEq(market.currentFundingRate(), 0, "parity not reached after rescaling");
    }

    // -----------------------------------------------------------------
    // Negative readings
    // -----------------------------------------------------------------

    /// `uint256(int256)` on a negative value wraps to ~2^256, which reads as an
    /// astronomically high index and pins funding at the cap in the wrong
    /// direction. Refusing outright is the only safe behaviour.
    function test_negative_reading_reverts_rather_than_wrapping() public {
        vm.warp(block.timestamp + market.fundingInterval());
        oracle.setReading(REGION, block.timestamp, -1);

        vm.expectRevert(
            abi.encodeWithSelector(BreezePerpMarket.NonPositiveIndexPrice.selector, int256(-1))
        );
        market.settleFunding();
    }

    function test_zero_reading_reverts() public {
        vm.warp(block.timestamp + market.fundingInterval());
        oracle.setReading(REGION, block.timestamp, 0);

        vm.expectRevert(
            abi.encodeWithSelector(BreezePerpMarket.NonPositiveIndexPrice.selector, int256(0))
        );
        market.settleFunding();
    }

    /// A refused settlement must leave the funding index untouched, so a market
    /// on a silent or misbehaving feed does not drift.
    function test_refused_settlement_leaves_the_index_unchanged() public {
        _settleWith(24e6);
        int256 before = market.cumulativeFundingIndex();
        uint256 settledAt = market.lastFundingSettledAt();

        vm.warp(block.timestamp + market.fundingInterval());
        oracle.setReading(REGION, block.timestamp, -100);
        vm.expectRevert();
        market.settleFunding();

        assertEq(market.cumulativeFundingIndex(), before);
        assertEq(market.lastFundingSettledAt(), settledAt);
    }

    // -----------------------------------------------------------------
    // Economic consequence
    // -----------------------------------------------------------------

    /// Under the bug, a position held across a single interval at parity paid the
    /// maximum funding charge. It must now pay nothing.
    function test_position_at_parity_pays_no_funding_across_an_interval() public {
        oracle.setReading(REGION, block.timestamp, 25e6);
        vm.prank(alice);
        uint256 id = market.openPosition(true, 10_000e18, 1);

        _settleWith(25e6);

        // Only price impact remains, which for a round trip is a small negative.
        int256 pnl = market.calculateUnrealizedPnl(id);
        uint256 notional = 10_000e18 * 1;
        uint256 maxFundingCharge =
            (notional * uint256(int256(market.maxFundingRateBps()))) / 10000;

        assertLt(
            pnl < 0 ? uint256(-pnl) : 0,
            maxFundingCharge,
            "position charged as though funding were saturated"
        );
    }

    // -----------------------------------------------------------------
    // Continuous funding accrual
    // -----------------------------------------------------------------
    //
    // A position must accrue funding for exactly the time it was open. That single
    // property closes the settlement sandwich (a one-second position earns one
    // second of funding) and removes the bias the earlier epoch scheme introduced
    // (a position present for 99% of an interval was paid for none of it).
    //
    // Two of these tests exist as a pair and must be read together: one proves the
    // exploit is closed, the other proves funding still WORKS. Without the second,
    // disabling funding entirely would satisfy every other assertion in this file.

    /// The index must be a function of time, not a step function. If it only moved
    /// at settlement, a position opened mid-interval would capture the whole
    /// preceding window — which is exactly the bug.
    function test_index_accrues_linearly_between_settlements() public {
        _settleWith(20e6);

        int256 base = market.cumulativeFundingIndex();
        int256 rate = market.currentFundingRate();
        assertGt(rate, 0, "no rate in force - test is vacuous");

        assertEq(market.effectiveFundingIndex(), base, "accrued before any time passed");

        vm.warp(block.timestamp + market.fundingInterval() / 4);
        assertEq(market.effectiveFundingIndex(), base + rate / 4, "quarter interval mispriced");

        vm.warp(block.timestamp + market.fundingInterval() / 4);
        assertEq(market.effectiveFundingIndex(), base + rate / 2, "half interval mispriced");
    }

    /// Accrual stops after one interval. Otherwise an unsettled market would keep
    /// charging against a stale mark/index gap nobody has confirmed still exists.
    function test_accrual_is_capped_at_one_interval() public {
        _settleWith(20e6);
        int256 base = market.cumulativeFundingIndex();
        int256 rate = market.currentFundingRate();

        vm.warp(block.timestamp + market.fundingInterval() * 10);
        assertEq(market.effectiveFundingIndex(), base + rate, "unsettled market kept accruing");
    }

    /// The exploit, at position level: a briefly-held position earns next to
    /// nothing, however favourable the rate.
    function test_briefly_held_position_accrues_negligible_funding() public {
        _settleWith(20e6); // a rate is now in force

        vm.prank(alice);
        uint256 id = market.openPosition(true, 10_000e18, 1);

        vm.warp(block.timestamp + 1);

        // One second of a 900-second interval, so at most 1 bps of index movement.
        int256 accrued = market.accruedFundingIndex(id);
        assertLe(accrued, 1, "one second of holding accrued more than one second of funding");
        assertGe(accrued, -1, "one second of holding accrued more than one second of funding");
    }

    /// The other half of the pair: funding must still accrue in full for a position
    /// that genuinely holds through an interval.
    function test_position_held_a_full_interval_accrues_the_whole_rate() public {
        _settleWith(20e6);

        vm.prank(alice);
        uint256 id = market.openPosition(true, 10_000e18, 1);
        int256 rate = market.currentFundingRate();

        vm.warp(block.timestamp + market.fundingInterval());

        assertEq(
            market.accruedFundingIndex(id),
            rate,
            "funding never accrues at all - the mechanism is dead"
        );
    }

    /// Half the holding time must earn half the funding. This is the specific
    /// property the epoch scheme did not have, and the reason it was replaced.
    function test_half_the_holding_time_earns_half_the_funding() public {
        _settleWith(20e6);
        int256 rate = market.currentFundingRate();

        vm.prank(alice);
        uint256 halfHeld = market.openPosition(true, 10_000e18, 1);
        vm.warp(block.timestamp + market.fundingInterval() / 2);
        int256 half = market.accruedFundingIndex(halfHeld);

        assertApproxEqAbs(half * 2, rate, 2, "accrual is not proportional to time held");
    }

    /// Longs pay when mark is above index, and the sign survives the redesign.
    function test_funding_direction_is_preserved_across_settlements() public {
        oracle.setReading(REGION, block.timestamp, 25e6);
        vm.prank(alice);
        uint256 longId = market.openPosition(true, 10_000e18, 1);

        // Mark above index, held across a full interval so the accrual is complete.
        _settleWith(20e6);
        vm.warp(block.timestamp + market.fundingInterval());

        assertGt(market.accruedFundingIndex(longId), 0, "index should rise when mark exceeds index");

        // A positive index charges the long, so its PnL carries a funding debit.
        assertLt(
            market.calculateUnrealizedPnl(longId),
            0,
            "long paid nothing while funding index was positive"
        );
    }

    /// Settling must not retroactively reprice the elapsed window at the new rate.
    function test_settlement_commits_the_old_rate_not_the_new_one() public {
        _settleWith(20e6);
        int256 firstRate = market.currentFundingRate();

        // Next settlement sees mark BELOW index, so the new rate flips sign.
        _settleWith(400e6);

        // The committed index must reflect the first (positive) rate over the
        // elapsed interval, not the second (negative) one.
        assertEq(
            market.cumulativeFundingIndex(),
            firstRate,
            "elapsed window repriced at a rate that was not in force during it"
        );
        assertLt(market.currentFundingRate(), 0, "new rate did not take effect");
    }

    function test_accrued_funding_is_zero_for_a_closed_position() public {
        oracle.setReading(REGION, block.timestamp, 25e6);
        vm.prank(alice);
        uint256 id = market.openPosition(true, 10_000e18, 1);
        _settleWith(20e6);
        _settleWith(20e6);

        vm.prank(alice);
        market.closePosition(id);
        assertEq(market.accruedFundingIndex(id), 0);
    }

    // -----------------------------------------------------------------
    // Per-market funding configuration
    // -----------------------------------------------------------------

    /// The default must be the PRODUCTION preset. The demo values (5% per 15
    /// minutes, ~480% annualised) shipped as the default for the whole life of the
    /// project, and while the scale defect was live they were also the only rate any
    /// market ever charged — which is how an absurd figure went unremarked.
    function test_defaults_are_the_production_preset_not_the_demo_one() public view {
        assertEq(market.fundingInterval(), PerpConstants.PRODUCTION_FUNDING_INTERVAL);
        assertEq(market.maxFundingRateBps(), PerpConstants.PRODUCTION_MAX_FUNDING_RATE_BPS);

        // And the production preset must actually be less aggressive.
        assertGt(market.fundingInterval(), PerpConstants.FUNDING_INTERVAL);
        assertLt(market.maxFundingRateBps(), PerpConstants.MAX_FUNDING_RATE_PER_PERIOD);
    }

    function test_demo_preset_can_be_applied_explicitly() public {
        market.setFundingParams(
            PerpConstants.FUNDING_INTERVAL, PerpConstants.MAX_FUNDING_RATE_PER_PERIOD
        );
        assertEq(market.fundingInterval(), PerpConstants.FUNDING_INTERVAL);
        assertEq(market.maxFundingRateBps(), PerpConstants.MAX_FUNDING_RATE_PER_PERIOD);

        // Funding now settles on the short interval.
        vm.warp(block.timestamp + PerpConstants.FUNDING_INTERVAL);
        oracle.setReading(REGION, block.timestamp, 1);
        market.settleFunding();
        assertEq(market.currentFundingRate(), int256(PerpConstants.MAX_FUNDING_RATE_PER_PERIOD));
    }

    /// Each market clamps at its OWN ceiling, not a global one. Two markets on the
    /// same extreme gap must produce different rates.
    function test_each_market_clamps_at_its_own_ceiling() public {
        BreezePerpMarket demoMarket = new BreezePerpMarket(
            VirtualAMM.Reserves({
                collateralReserve: COLLATERAL_RESERVE,
                weatherReserve: WEATHER_RESERVE
            }),
            address(oracle),
            address(insuranceFund),
            address(feeConfig),
            address(treasury),
            address(accessControl),
            address(token),
            REGION
        );
        demoMarket.setFundingParams(
            PerpConstants.FUNDING_INTERVAL, PerpConstants.MAX_FUNDING_RATE_PER_PERIOD
        );

        // Same extreme gap, settled on each market's own schedule.
        vm.warp(block.timestamp + market.fundingInterval());
        oracle.setReading(REGION, block.timestamp, 1);
        market.settleFunding();
        demoMarket.settleFunding();

        assertEq(market.currentFundingRate(), int256(PerpConstants.PRODUCTION_MAX_FUNDING_RATE_BPS));
        assertEq(
            demoMarket.currentFundingRate(), int256(PerpConstants.MAX_FUNDING_RATE_PER_PERIOD)
        );
        assertLt(
            market.currentFundingRate(),
            demoMarket.currentFundingRate(),
            "production market charged as much as the demo market"
        );
    }

    /// Changing the interval must not retroactively reprice funding already earned.
    /// `effectiveFundingIndex()` divides by the interval, so shortening it without
    /// committing first would inflate accrual under the longer one.
    function test_changing_params_commits_accrual_under_the_old_interval() public {
        _settleWith(1); // rate at the production cap
        int256 rate = market.currentFundingRate();
        assertGt(rate, 0);

        // Half of an 8-hour interval elapses.
        vm.warp(block.timestamp + market.fundingInterval() / 2);
        int256 accruedBefore = market.effectiveFundingIndex();
        assertEq(accruedBefore, rate / 2, "half interval mispriced before the change");

        market.setFundingParams(PerpConstants.FUNDING_INTERVAL, 500);

        assertEq(
            market.cumulativeFundingIndex(),
            accruedBefore,
            "accrual under the old interval was not committed"
        );
        assertEq(
            market.effectiveFundingIndex(),
            accruedBefore,
            "index jumped on a parameter change"
        );
    }

    function test_only_admin_can_set_funding_params() public {
        vm.prank(alice);
        vm.expectRevert(BreezePerpMarket.UnauthorizedCaller.selector);
        market.setFundingParams(1 hours, 50);
    }

    function test_funding_params_are_bounded() public {
        vm.expectRevert(BreezePerpMarket.InvalidParameter.selector);
        market.setFundingParams(PerpConstants.MIN_FUNDING_INTERVAL - 1, 50);

        vm.expectRevert(BreezePerpMarket.InvalidParameter.selector);
        market.setFundingParams(PerpConstants.MAX_FUNDING_INTERVAL + 1, 50);

        vm.expectRevert(BreezePerpMarket.InvalidParameter.selector);
        market.setFundingParams(1 hours, 0);

        // Nothing more aggressive than the demo preset may ever be configured.
        vm.expectRevert(BreezePerpMarket.InvalidParameter.selector);
        market.setFundingParams(1 hours, PerpConstants.MAX_FUNDING_RATE_CEILING_BPS + 1);
    }

    // -----------------------------------------------------------------
    // Access control and bounds
    // -----------------------------------------------------------------

    function test_only_admin_can_set_the_scale() public {
        vm.prank(alice);
        vm.expectRevert(BreezePerpMarket.UnauthorizedCaller.selector);
        market.setOracleValueScale(1e2);
    }

    function test_scale_cannot_be_zero() public {
        vm.expectRevert(BreezePerpMarket.InvalidParameter.selector);
        market.setOracleValueScale(0);
    }

    function test_scale_cannot_exceed_ceiling() public {
        uint256 ceiling = market.MAX_ORACLE_VALUE_SCALE();
        vm.expectRevert(BreezePerpMarket.InvalidParameter.selector);
        market.setOracleValueScale(ceiling + 1);
    }

    function test_current_index_price_reports_zero_on_an_unusable_reading() public {
        vm.warp(block.timestamp + 1);
        oracle.setReading(REGION, block.timestamp, -5);
        assertEq(market.currentIndexPrice(), 0);
    }
}
