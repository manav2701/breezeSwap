// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../src/access/BreezeAccessControl.sol";
import "../../src/oracle/CivilDate.sol";
import "../../src/oracle/MockWeatherOracle.sol";
import "../../src/oracle/StrikeProbabilityOracle.sol";
import "../../src/core/BreezeMarket.sol";
import "../../src/core/BreezeMarketFactory.sol";
import "../../src/core/PositionToken.sol";
import "../../src/fees/FeeConfig.sol";
import "../../src/fees/ProtocolTreasury.sol";
import "../../src/perp/BreezePerpFactory.sol";
import "../../src/perp/InsuranceFund.sol";
import "../../src/settlement/PayoffCalculator.sol";

contract CpToken2 is ERC20 {
    constructor() ERC20("Mock USDT", "mUSDT") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Markets could be created at odds unrelated to their own climatology.
///
/// Two separate defects with the same shape. A Classic BINARY market's odds are whatever
/// the supply split happens to be, so a long facing a strike breached in 27 of the last 30
/// years received the same even-money claim as one facing a coin flip. And a perp market's
/// initial reserves fix its opening mark price, which nothing compared against the climate
/// it tracks — a rainfall market could open at a mark implying 400mm where the average is
/// 40mm, and every trade after that would be priced off a number unrelated to the weather.
contract ClimatologyPricingTest is Test {
    BreezeAccessControl accessControl;
    MockWeatherOracle weather;
    StrikeProbabilityOracle pricing;
    PositionToken positionToken;
    BreezeMarketFactory classicFactory;
    BreezePerpFactory perpFactory;
    FeeConfig feeConfig;
    ProtocolTreasury treasury;
    InsuranceFund insuranceFund;
    CpToken2 token;

    address admin = address(this);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    bytes32 constant TOKYO = keccak256("TOKYO_RAINFALL");
    uint8 constant RAINFALL = 0;

    /// 40mm strike. The long is paid at or above it.
    int256 constant STRIKE = 40e6;

    /// A deliberately lopsided strike: breached 9 years in 10.
    uint32 constant LONG_WINS_BPS = 9000;

    function setUp() public {
        // 2023-11-14T22:13:20Z — a real timestamp with an unambiguous month.
        vm.warp(1_700_000_000);

        accessControl = new BreezeAccessControl(admin);
        accessControl.grantRole(accessControl.ORACLE_UPDATER_ROLE(), admin);

        token = new CpToken2();
        weather = new MockWeatherOracle(address(accessControl));
        pricing = new StrikeProbabilityOracle(address(accessControl));
        positionToken = new PositionToken("https://breezeswap.io/api/");

        classicFactory = new BreezeMarketFactory(address(positionToken), address(accessControl));
        // The factory sets minter status on each market it deploys, so it must own the
        // shared token.
        positionToken.transferOwnership(address(classicFactory));
        classicFactory.setPricingOracle(address(pricing));

        feeConfig = new FeeConfig(address(accessControl));
        treasury = new ProtocolTreasury(address(token), address(accessControl));
        insuranceFund = new InsuranceFund(address(token), address(accessControl));
        perpFactory = new BreezePerpFactory(
            address(accessControl),
            address(insuranceFund),
            address(feeConfig),
            address(treasury)
        );
        accessControl.grantRole(accessControl.MARKET_CREATOR_ROLE(), admin);
        perpFactory.setPricingOracle(address(pricing));

        token.mint(alice, 1_000_000e18);
        token.mint(bob, 1_000_000e18);
    }

    // =================================================================
    // CivilDate — the month every priced strike is keyed by
    // =================================================================

    /// The month is derived, not declared. Passing it in would make the pricing depend on
    /// the creator naming the season honestly, and a wrong declaration would price a market
    /// against the wrong climatology while looking fully priced.
    function test_month_of_year_matches_known_dates() public pure {
        assertEq(CivilDate.monthOfYear(0), 1, "1970-01-01");
        assertEq(CivilDate.monthOfYear(1_700_000_000), 11, "2023-11-14");
        assertEq(CivilDate.monthOfYear(1_704_067_200), 1, "2024-01-01T00:00:00Z");
        assertEq(CivilDate.monthOfYear(1_709_164_800), 2, "2024-02-29 - leap day");
        assertEq(CivilDate.monthOfYear(1_709_251_200), 3, "2024-03-01 - day after leap day");
        assertEq(CivilDate.monthOfYear(951_782_400), 2, "2000-02-29 - leap year by the 400 rule");
        assertEq(CivilDate.monthOfYear(1_735_689_600), 1, "2025-01-01");
        assertEq(CivilDate.monthOfYear(1_767_139_200), 12, "2025-12-30");
    }

    /// Every second of a day maps to the same month, and month boundaries are exact.
    function test_month_is_stable_within_a_day_and_flips_at_the_boundary() public pure {
        uint256 lastSecondOfJan = 1_706_745_599; // 2024-01-31T23:59:59Z
        assertEq(CivilDate.monthOfYear(lastSecondOfJan), 1);
        assertEq(CivilDate.monthOfYear(lastSecondOfJan + 1), 2);
    }

    function testFuzz_month_is_always_in_range(uint32 timestamp) public pure {
        uint8 m = CivilDate.monthOfYear(uint256(timestamp));
        assertGe(m, 1);
        assertLe(m, 12);
    }

    // =================================================================
    // Classic markets — fair odds
    // =================================================================

    function _priceStrike(uint256 expiry, uint32 probabilityBps) internal {
        pricing.setStrikeProbability(
            TOKYO, RAINFALL, false, uint256(STRIKE), CivilDate.monthOfYear(expiry), probabilityBps, 30
        );
    }

    function _classic(uint256 expiry) internal returns (BreezeMarket) {
        return BreezeMarket(
            classicFactory.createMarket(
                TOKYO,
                BreezeMarket.WeatherVariable.RAINFALL,
                STRIKE,
                STRIKE + 10e6,
                expiry,
                address(weather),
                address(token),
                PayoffCalculator.PayoffType.BINARY
            )
        );
    }

    function _mint(BreezeMarket m, address who, PositionToken.Side side, uint256 amount) internal {
        vm.startPrank(who);
        token.approve(address(m.vault()), type(uint256).max);
        m.mintPosition(side, amount);
        vm.stopPrank();
    }

    function test_a_priced_market_publishes_its_fair_odds() public {
        uint256 expiry = block.timestamp + 30 days;
        _priceStrike(expiry, LONG_WINS_BPS);

        BreezeMarket m = _classic(expiry);
        assertTrue(m.isPriced(), "market did not pick up its climatology");
        assertEq(m.fairLongShareBps(), LONG_WINS_BPS);
    }

    /// An unpriced strike still deploys — refusing would make listing a new region
    /// impossible until the seeder had run — but it is flagged rather than
    /// indistinguishable from a priced market.
    function test_an_unpriced_market_is_flagged_not_refused() public {
        BreezeMarket m = _classic(block.timestamp + 30 days);
        assertFalse(m.isPriced());
        assertEq(m.fairLongShareBps(), 0);
    }

    /// A breach probability prices a binary claim exactly. It does not price a LINEAR or
    /// CAPPED payoff, which depends on where inside the range the reading lands — that
    /// needs the distribution, not one quantile of it.
    function test_non_binary_payoffs_are_left_unpriced() public {
        uint256 expiry = block.timestamp + 30 days;
        _priceStrike(expiry, LONG_WINS_BPS);

        BreezeMarket m = BreezeMarket(
            classicFactory.createMarket(
                TOKYO,
                BreezeMarket.WeatherVariable.RAINFALL,
                STRIKE,
                STRIKE + 10e6,
                expiry,
                address(weather),
                address(token),
                PayoffCalculator.PayoffType.LINEAR
            )
        );
        assertFalse(m.isPriced(), "a continuous payoff was priced off a breach probability");
    }

    /// The defect, as arithmetic. At a 90% strike, an evenly split pool pays the long even
    /// money on a near-certainty and the short 1:1 on a 10% event.
    function test_an_even_split_is_refused_at_a_lopsided_strike() public {
        uint256 expiry = block.timestamp + 30 days;
        _priceStrike(expiry, LONG_WINS_BPS);
        BreezeMarket m = _classic(expiry);

        // First mint is always allowed: one deposit is 100% of one side by construction.
        _mint(m, alice, PositionToken.Side.LONG, 50_000e18);
        assertEq(m.impliedLongShareBps(), 10000);

        // Fair is 90% long. A matching short takes the pool to 50/50, which is 40pp away
        // from fair — outside the 30pp band, and further from fair than 100/0 was.
        assertEq(m.oddsGapBps(), 1000);

        vm.startPrank(bob);
        token.approve(address(m.vault()), type(uint256).max);
        vm.expectRevert(
            abi.encodeWithSelector(BreezeMarket.MintWorsensOdds.selector, 5000, LONG_WINS_BPS)
        );
        m.mintPosition(PositionToken.Side.SHORT, 50_000e18);
        vm.stopPrank();
    }

    /// And a short sized to the fair odds is accepted, so the band rations rather than
    /// forbids.
    function test_a_short_sized_to_fair_odds_is_accepted() public {
        uint256 expiry = block.timestamp + 30 days;
        _priceStrike(expiry, LONG_WINS_BPS);
        BreezeMarket m = _classic(expiry);

        _mint(m, alice, PositionToken.Side.LONG, 90_000e18);
        // 10k short against 90k long is exactly the 90/10 split the climatology implies.
        _mint(m, bob, PositionToken.Side.SHORT, 10_000e18);

        assertEq(m.impliedLongShareBps(), LONG_WINS_BPS);
        assertEq(m.oddsGapBps(), 0);
    }

    /// A mint that moves the pool TOWARD fair must always be allowed, even from far
    /// outside the band. A rule keyed on the resulting state alone would reject exactly
    /// the deposits able to repair an imbalance and freeze the market one-way.
    function test_a_mint_toward_fair_odds_is_always_allowed() public {
        uint256 expiry = block.timestamp + 30 days;
        _priceStrike(expiry, LONG_WINS_BPS);
        BreezeMarket m = _classic(expiry);

        // Start badly wrong: all short, against a strike the long wins 90% of the time.
        _mint(m, bob, PositionToken.Side.SHORT, 50_000e18);
        assertEq(m.impliedLongShareBps(), 0);
        uint256 gapBefore = m.oddsGapBps();
        assertGt(gapBefore, m.fairOddsToleranceBps(), "not outside the band - test is vacuous");

        // Still outside the band afterwards, but closer — so permitted.
        _mint(m, alice, PositionToken.Side.LONG, 20_000e18);
        assertLt(m.oddsGapBps(), gapBefore, "the repairing mint did not reduce the gap");
        assertGt(m.oddsGapBps(), m.fairOddsToleranceBps(), "landed inside the band - weaker claim");
    }

    /// A mint that makes an already-bad split worse is refused.
    function test_a_mint_away_from_fair_odds_is_refused() public {
        uint256 expiry = block.timestamp + 30 days;
        _priceStrike(expiry, LONG_WINS_BPS);
        BreezeMarket m = _classic(expiry);

        _mint(m, bob, PositionToken.Side.SHORT, 50_000e18);

        vm.startPrank(bob);
        token.approve(address(m.vault()), type(uint256).max);
        vm.expectRevert();
        m.mintPosition(PositionToken.Side.SHORT, 10_000e18);
        vm.stopPrank();
    }

    /// An unpriced market keeps its original behaviour exactly — any split, no checks.
    function test_an_unpriced_market_accepts_any_split() public {
        BreezeMarket m = _classic(block.timestamp + 30 days);
        _mint(m, alice, PositionToken.Side.LONG, 50_000e18);
        _mint(m, bob, PositionToken.Side.SHORT, 50_000e18);
        assertEq(m.impliedLongShareBps(), 5000);
    }

    /// A balanced strike is where the pre-existing behaviour was already fair, so the band
    /// must not have made it stricter.
    function test_a_fifty_fifty_strike_permits_an_even_split() public {
        uint256 expiry = block.timestamp + 30 days;
        _priceStrike(expiry, 5000);
        BreezeMarket m = _classic(expiry);

        _mint(m, alice, PositionToken.Side.LONG, 50_000e18);
        _mint(m, bob, PositionToken.Side.SHORT, 50_000e18);
        assertEq(m.oddsGapBps(), 0);
    }

    /// Odds are resolved once, at construction. A later climatology update must not move
    /// the terms under positions already minted.
    function test_fair_odds_are_fixed_at_construction() public {
        uint256 expiry = block.timestamp + 30 days;
        _priceStrike(expiry, LONG_WINS_BPS);
        BreezeMarket m = _classic(expiry);

        _priceStrike(expiry, 1000); // climatology revised hard the other way
        assertEq(m.fairLongShareBps(), LONG_WINS_BPS, "live market had its odds rewritten");
    }

    function test_fair_odds_tolerance_is_bounded() public {
        uint256 expiry = block.timestamp + 30 days;
        _priceStrike(expiry, LONG_WINS_BPS);
        BreezeMarket m = _classic(expiry);

        uint256 floorBps = m.MIN_FAIR_ODDS_TOLERANCE_BPS();
        vm.expectRevert(BreezeMarket.InvalidParameters.selector);
        m.setFairOddsToleranceBps(floorBps - 1);

        m.setFairOddsToleranceBps(floorBps);
        assertEq(m.fairOddsToleranceBps(), floorBps);
    }

    // =================================================================
    // Perp markets — opening mark against climatology
    // =================================================================

    /// Reserves of (collateral, weather) imply a mark of `collateral * 1e18 / weather`.
    /// 2,000,000 / 80,000 = 25, i.e. a 25mm index at 6dp.
    function _perp(uint256 collateralReserve, uint256 weatherReserve) internal returns (address) {
        return perpFactory.createPerpMarket(
            TOKYO, collateralReserve, weatherReserve, address(weather), address(token)
        );
    }

    function test_a_market_opening_near_climatology_is_accepted() public {
        pricing.setClimatologyLevel(TOKYO, CivilDate.monthOfYear(block.timestamp), 25e6, 30);

        address m = _perp(2_000_000e18, 80_000e18); // mark 25e18, climatology 25e18
        assertEq(BreezePerpMarket(m).getMarkPrice(), 25e18);
    }

    /// The error that actually happens: a mark wrong by an order of magnitude, from a
    /// mis-scaled reserve ratio or a figure copied from another region.
    function test_a_market_opening_far_from_climatology_is_refused() public {
        pricing.setClimatologyLevel(TOKYO, CivilDate.monthOfYear(block.timestamp), 25e6, 30);

        vm.expectRevert(
            abi.encodeWithSelector(
                BreezePerpFactory.InitialMarkOffClimatology.selector,
                400e18,
                25e18,
                perpFactory.maxInitialMarkDeviationBps()
            )
        );
        _perp(32_000_000e18, 80_000e18); // mark 400e18 against a 25mm climate
    }

    /// Inside the band, both directions.
    function test_the_band_is_symmetric() public {
        pricing.setClimatologyLevel(TOKYO, CivilDate.monthOfYear(block.timestamp), 25e6, 30);
        perpFactory.setMaxInitialMarkDeviationBps(2000); // ±20%

        _perp(2_400_000e18, 80_000e18); // mark 30e18 = +20%, exactly at the edge
        _perp(1_600_000e18, 80_000e18); // mark 20e18 = -20%

        vm.expectRevert();
        _perp(2_480_000e18, 80_000e18); // mark 31e18 = +24%
    }

    /// An unpriced region deploys freely. Gating on climatology that has not been posted
    /// yet would be an operational deadlock, not a safety property.
    function test_an_unpriced_region_is_not_refused() public {
        address m = _perp(32_000_000e18, 80_000e18);
        assertEq(BreezePerpMarket(m).getMarkPrice(), 400e18);
    }

    /// With no oracle wired the factory behaves exactly as it did before.
    function test_no_pricing_oracle_means_no_check() public {
        pricing.setClimatologyLevel(TOKYO, CivilDate.monthOfYear(block.timestamp), 25e6, 30);
        perpFactory.setPricingOracle(address(0));
        _perp(32_000_000e18, 80_000e18);
        assertEq(perpFactory.getMarketCount(), 1);
    }

    /// The comparison must go through the market's own `indexPrice`, so a market on a
    /// differently-scaled adapter is measured on its own terms. Doing the conversion in the
    /// factory with an assumed 1e6 would reintroduce the scale mismatch that pinned the
    /// funding rate at its cap.
    function test_the_check_uses_the_markets_own_oracle_scale() public {
        pricing.setClimatologyLevel(TOKYO, CivilDate.monthOfYear(block.timestamp), 25e6, 30);
        address m = _perp(2_000_000e18, 80_000e18);
        assertEq(BreezePerpMarket(m).indexPrice(25e6), 25e18, "index conversion is not 1e6-based");
        assertEq(BreezePerpMarket(m).oracleValueScale(), 1e6);
    }

    function test_climatology_level_requires_a_real_sample() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                StrikeProbabilityOracle.InsufficientSample.selector, uint16(5), uint16(10)
            )
        );
        pricing.setClimatologyLevel(TOKYO, 8, 25e6, 5);

        vm.expectRevert(StrikeProbabilityOracle.InvalidLevel.selector);
        pricing.setClimatologyLevel(TOKYO, 8, 0, 30);
    }

    /// A missing level reverts rather than reading as zero. Zero would make every possible
    /// mark price look either infinitely wrong or trivially acceptable, depending on which
    /// way the comparison ran.
    function test_an_unset_level_reverts_rather_than_reading_as_zero() public {
        bytes32 key = pricing.levelKey(TOKYO, 8);
        assertFalse(pricing.isLevelSet(key));

        vm.expectRevert(abi.encodeWithSelector(StrikeProbabilityOracle.LevelNotPriced.selector, key));
        pricing.expectedLevel(TOKYO, 8);
    }

    function test_only_oracle_updater_can_post_levels() public {
        vm.prank(alice);
        vm.expectRevert(StrikeProbabilityOracle.UnauthorizedCaller.selector);
        pricing.setClimatologyLevel(TOKYO, 8, 25e6, 30);
    }

    function test_initial_mark_deviation_is_bounded() public {
        uint256 lo = perpFactory.MIN_INITIAL_MARK_DEVIATION_BPS();
        uint256 hi = perpFactory.MAX_INITIAL_MARK_DEVIATION_BPS();

        vm.expectRevert(BreezePerpFactory.InvalidParameter.selector);
        perpFactory.setMaxInitialMarkDeviationBps(lo - 1);

        vm.expectRevert(BreezePerpFactory.InvalidParameter.selector);
        perpFactory.setMaxInitialMarkDeviationBps(hi + 1);

        perpFactory.setMaxInitialMarkDeviationBps(hi);
        assertEq(perpFactory.maxInitialMarkDeviationBps(), hi);
    }

    function test_only_admin_can_configure_the_factories() public {
        vm.startPrank(alice);
        vm.expectRevert(BreezePerpFactory.UnauthorizedCaller.selector);
        perpFactory.setPricingOracle(address(pricing));
        vm.expectRevert(BreezePerpFactory.UnauthorizedCaller.selector);
        perpFactory.setMaxInitialMarkDeviationBps(3000);
        vm.expectRevert("BreezeSwap: unauthorized");
        classicFactory.setPricingOracle(address(pricing));
        vm.stopPrank();
    }
}
