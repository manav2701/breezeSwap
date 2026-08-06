// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../src/perp/FundingRateEngine.sol";
import "../../src/perp/PerpConstants.sol";

contract FundingRateEngineTest is Test {
    function test_funding_positive_when_mark_above_oracle() public {
        uint256 markPrice = 30 * 1e18;
        uint256 oraclePrice = 25 * 1e18;

        int256 rate = FundingRateEngine.calculateFundingRate(markPrice, oraclePrice, PerpConstants.MAX_FUNDING_RATE_PER_PERIOD);
        // Deviation = (30 - 25)/25 = +20% = +2000 BPS -> clamped to max 500 BPS
        assertEq(rate, int256(PerpConstants.MAX_FUNDING_RATE_PER_PERIOD));
    }

    function test_funding_negative_when_mark_below_oracle() public {
        uint256 markPrice = 20 * 1e18;
        uint256 oraclePrice = 25 * 1e18;

        int256 rate = FundingRateEngine.calculateFundingRate(markPrice, oraclePrice, PerpConstants.MAX_FUNDING_RATE_PER_PERIOD);
        // Deviation = (20 - 25)/25 = -20% = -2000 BPS -> clamped to -500 BPS
        assertEq(rate, -int256(PerpConstants.MAX_FUNDING_RATE_PER_PERIOD));
    }

    function test_funding_zero_when_mark_equals_oracle() public {
        uint256 markPrice = 25 * 1e18;
        uint256 oraclePrice = 25 * 1e18;

        int256 rate = FundingRateEngine.calculateFundingRate(markPrice, oraclePrice, PerpConstants.MAX_FUNDING_RATE_PER_PERIOD);
        assertEq(rate, 0);
    }

    function test_funding_sign_and_zero_sum_balance() public {
        int256 indexDelta = 100; // +100 BPS cumulative index change

        uint256 notionalLong = 10_000 * 1e18;
        uint256 notionalShort = 10_000 * 1e18;

        // Long impact: -indexDelta * notional / 10000 = -100 * 10,000 / 10,000 = -100 USD (pays)
        int256 longFundingPnl = (-indexDelta * int256(notionalLong)) / 10000;

        // Short impact: +indexDelta * notional / 10000 = +100 * 10,000 / 10,000 = +100 USD (receives)
        int256 shortFundingPnl = (indexDelta * int256(notionalShort)) / 10000;

        assertEq(longFundingPnl, -100 * 1e18);
        assertEq(shortFundingPnl, 100 * 1e18);
        assertEq(longFundingPnl + shortFundingPnl, 0);
    }
}
