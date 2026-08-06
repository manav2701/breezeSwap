// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../src/access/BreezeAccessControl.sol";
import "../../src/oracle/StrikeProbabilityOracle.sol";

contract StrikeProbabilityOracleTest is Test {
    BreezeAccessControl accessControl;
    StrikeProbabilityOracle pricing;

    address admin = address(this);
    address updater = address(0x0DDE7);
    address attacker = address(0xBAD);

    bytes32 constant TOKYO = keccak256("TOKYO_RAINFALL");
    uint8 constant RAINFALL = 0;
    uint8 constant AUGUST = 8;

    function setUp() public {
        accessControl = new BreezeAccessControl(admin);
        pricing = new StrikeProbabilityOracle(address(accessControl));
        accessControl.grantRole(accessControl.ORACLE_UPDATER_ROLE(), updater);
    }

    function _setProb(uint32 bps, uint16 years_) internal returns (bytes32 key) {
        vm.prank(updater);
        pricing.setStrikeProbability(TOKYO, RAINFALL, true, 40e6, AUGUST, bps, years_);
        return pricing.strikeKey(TOKYO, RAINFALL, true, 40e6, AUGUST);
    }

    // ---------------------------------------------------------------
    // Pricing correctness
    // ---------------------------------------------------------------

    function test_premium_equals_fair_value_plus_risk_load() public {
        bytes32 key = _setProb(2000, 30); // 20% historical frequency

        // Fair value on 1,000 payout is 200; a 30% load takes it to 260.
        assertEq(pricing.quotePremium(key, 1_000e18, 3000), 260e18);
    }

    function test_zero_risk_load_prices_at_fair_value() public {
        bytes32 key = _setProb(2500, 30);
        assertEq(pricing.quotePremium(key, 1_000e18, 0), 250e18);
    }

    /// The whole point of the contract: a likely event costs more than an
    /// unlikely one, instead of both costing the same.
    function test_likelier_strikes_cost_more() public {
        vm.startPrank(updater);
        pricing.setStrikeProbability(TOKYO, RAINFALL, true, 10e6, AUGUST, 500, 30); // rare
        pricing.setStrikeProbability(TOKYO, RAINFALL, true, 90e6, AUGUST, 9000, 30); // common
        vm.stopPrank();

        uint256 rare = pricing.quotePremium(
            pricing.strikeKey(TOKYO, RAINFALL, true, 10e6, AUGUST), 1_000e18, 0
        );
        uint256 common = pricing.quotePremium(
            pricing.strikeKey(TOKYO, RAINFALL, true, 90e6, AUGUST), 1_000e18, 0
        );

        assertLt(rare, common, "rare strike not cheaper than common one");
        assertEq(rare, 50e18);
        assertEq(common, 900e18);
    }

    /// A premium at or above the payout is a fee for nothing.
    function test_premium_never_reaches_the_payout() public {
        bytes32 key = _setProb(10000, 30); // certain event
        uint256 premium = pricing.quotePremium(key, 1_000e18, 5000);
        assertLt(premium, 1_000e18, "premium met or exceeded payout");
    }

    function test_seasonality_is_priced_separately() public {
        vm.startPrank(updater);
        pricing.setStrikeProbability(TOKYO, RAINFALL, true, 40e6, 8, 2000, 30); // August
        pricing.setStrikeProbability(TOKYO, RAINFALL, true, 40e6, 1, 8000, 30); // January
        vm.stopPrank();

        uint256 aug = pricing.quotePremium(pricing.strikeKey(TOKYO, RAINFALL, true, 40e6, 8), 1_000e18, 0);
        uint256 jan = pricing.quotePremium(pricing.strikeKey(TOKYO, RAINFALL, true, 40e6, 1), 1_000e18, 0);

        assertTrue(aug != jan, "months collapsed into one figure");
    }

    function test_direction_is_part_of_the_key() public {
        vm.prank(updater);
        pricing.setStrikeProbability(TOKYO, RAINFALL, true, 40e6, AUGUST, 2000, 30);

        // The "above" strike at the same threshold is a different contract and
        // must not inherit the "below" price.
        assertFalse(pricing.isPriced(pricing.strikeKey(TOKYO, RAINFALL, false, 40e6, AUGUST)));
    }

    // ---------------------------------------------------------------
    // Guards
    // ---------------------------------------------------------------

    function test_unpriced_strike_cannot_be_quoted() public {
        bytes32 key = pricing.strikeKey(TOKYO, RAINFALL, true, 40e6, AUGUST);
        vm.expectRevert(abi.encodeWithSelector(StrikeProbabilityOracle.StrikeNotPriced.selector, key));
        pricing.quotePremium(key, 1_000e18, 0);
    }

    function test_thin_sample_is_rejected() public {
        vm.prank(updater);
        vm.expectRevert(
            abi.encodeWithSelector(StrikeProbabilityOracle.InsufficientSample.selector, 5, 10)
        );
        pricing.setStrikeProbability(TOKYO, RAINFALL, true, 40e6, AUGUST, 2000, 5);
    }

    function test_probability_above_100_percent_is_rejected() public {
        vm.prank(updater);
        vm.expectRevert(StrikeProbabilityOracle.InvalidProbability.selector);
        pricing.setStrikeProbability(TOKYO, RAINFALL, true, 40e6, AUGUST, 10001, 30);
    }

    function test_risk_load_is_capped() public {
        bytes32 key = _setProb(2000, 30);
        uint256 max = pricing.MAX_RISK_LOAD_BPS();

        vm.expectRevert(
            abi.encodeWithSelector(StrikeProbabilityOracle.RiskLoadTooHigh.selector, max + 1, max)
        );
        pricing.quotePremium(key, 1_000e18, max + 1);
    }

    function test_non_updater_cannot_post_probabilities() public {
        vm.prank(attacker);
        vm.expectRevert(StrikeProbabilityOracle.UnauthorizedCaller.selector);
        pricing.setStrikeProbability(TOKYO, RAINFALL, true, 40e6, AUGUST, 2000, 30);
    }

    function test_sample_size_is_retained_for_consumers() public {
        bytes32 key = _setProb(2000, 42);
        StrikeProbabilityOracle.StrikeStats memory s = pricing.getStrike(key);
        assertEq(s.sampleYears, 42);
        assertEq(s.probabilityBps, 2000);
        assertTrue(s.isSet);
    }

    // ---------------------------------------------------------------
    // Fuzz
    // ---------------------------------------------------------------

    function testFuzz_premium_is_bounded_by_payout(uint32 probBps, uint256 payout, uint256 loadBps)
        public
    {
        probBps = uint32(bound(probBps, 0, 10000));
        payout = bound(payout, 1e6, 1_000_000e18);
        loadBps = bound(loadBps, 0, pricing.MAX_RISK_LOAD_BPS());

        bytes32 key = _setProb(probBps, 30);
        uint256 premium = pricing.quotePremium(key, payout, loadBps);

        assertLt(premium, payout, "premium met or exceeded payout");
    }

    function testFuzz_premium_is_monotonic_in_probability(uint32 lowBps, uint32 highBps) public {
        lowBps = uint32(bound(lowBps, 0, 9999));
        highBps = uint32(bound(highBps, uint256(lowBps) + 1, 10000));

        vm.startPrank(updater);
        pricing.setStrikeProbability(TOKYO, RAINFALL, true, 10e6, AUGUST, lowBps, 30);
        pricing.setStrikeProbability(TOKYO, RAINFALL, true, 20e6, AUGUST, highBps, 30);
        vm.stopPrank();

        uint256 lowPremium =
            pricing.quotePremium(pricing.strikeKey(TOKYO, RAINFALL, true, 10e6, AUGUST), 100_000e18, 0);
        uint256 highPremium =
            pricing.quotePremium(pricing.strikeKey(TOKYO, RAINFALL, true, 20e6, AUGUST), 100_000e18, 0);

        assertLe(lowPremium, highPremium, "higher probability priced cheaper");
    }
}
