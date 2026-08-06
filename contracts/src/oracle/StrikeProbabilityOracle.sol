// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../access/BreezeAccessControl.sol";

/// @title StrikeProbabilityOracle
/// @notice Historical probability that a weather strike is breached, and the
/// premium that follows from it.
///
/// Without this, a weather contract has no price: both sides post equal
/// collateral, which silently asserts every outcome is a coin flip. If a
/// threshold has been crossed in 27 of the last 30 years, the side betting
/// "yes" is being asked to pay even money on a 90% event — a guaranteed loss
/// for whoever does not know the climatology. That is a trap, not a market.
///
/// Probabilities are computed off-chain from multi-decade Open-Meteo history
/// (see `weather-seed/`) and posted here by `ORACLE_UPDATER_ROLE`. Each entry
/// carries the sample size it was derived from so consumers can refuse to price
/// against a thin record.
contract StrikeProbabilityOracle {
    BreezeAccessControl public immutable accessControl;

    struct StrikeStats {
        uint32 probabilityBps; // historical frequency of breach, in basis points
        uint16 sampleYears; // years of history behind the figure
        uint64 updatedAt;
        bool isSet;
    }

    /// @notice Climatological expected LEVEL of a variable, as opposed to the probability
    /// of a strike being breached.
    ///
    /// @dev A breach probability prices a binary claim. It says nothing about where a
    /// continuous series is expected to sit, and a perpetual market needs exactly that:
    /// its initial reserves fix a starting mark price, and nothing checked that price
    /// against the climate it is supposed to track. Every trade after that would be
    /// priced off a number unrelated to the weather.
    ///
    /// **The unit is the expected value of a SINGLE ORACLE READING** — whatever
    /// `IWeatherOracle.getReading` returns for this region, on its own fixed-point scale.
    /// For a daily rainfall feed that is mean DAILY millimetres, not the monthly total the
    /// strike probabilities are derived from. The distinction is not pedantry: a perp's
    /// index price is one reading, so posting a monthly total here would compare a
    /// daily-scale mark against a monthly-scale level and be wrong by roughly thirty
    /// times. That is the same class of error as the mark/index scale mismatch that pinned
    /// the funding rate at its cap, and as the policy settlement that compared one day's
    /// rainfall against a monthly threshold.
    ///
    /// Keyed by (region, month) rather than including a variable, because the perp market
    /// identifies its series by `regionId` alone — the convention across this codebase is
    /// that the region encodes the variable (`keccak256("TOKYO_RAINFALL")`).
    struct ClimatologyLevel {
        uint256 expectedLevel; // in the oracle's fixed-point units
        uint16 sampleYears;
        uint64 updatedAt;
        bool isSet;
    }

    /// @dev key => stats. See `strikeKey` for the key derivation.
    mapping(bytes32 => StrikeStats) private _strikes;

    /// @dev key => level. See `levelKey`.
    mapping(bytes32 => ClimatologyLevel) private _levels;

    /// @notice Smallest history a quote may be based on. Below this the sample
    /// is too thin for the frequency to mean anything.
    uint16 public constant MIN_SAMPLE_YEARS = 10;

    /// @notice Ceiling on the risk load a caller may request, so a market cannot
    /// be constructed that charges an arbitrary multiple of fair value.
    uint256 public constant MAX_RISK_LOAD_BPS = 5000; // +50%

    event StrikeProbabilityUpdated(
        bytes32 indexed key,
        bytes32 indexed regionId,
        uint32 probabilityBps,
        uint16 sampleYears
    );

    event ClimatologyLevelUpdated(
        bytes32 indexed key,
        bytes32 indexed regionId,
        uint8 monthOfYear,
        uint256 expectedLevel,
        uint16 sampleYears
    );

    error UnauthorizedCaller();
    error InvalidProbability();
    error InsufficientSample(uint16 sampleYears, uint16 required);
    error StrikeNotPriced(bytes32 key);
    error LevelNotPriced(bytes32 key);
    error InvalidLevel();
    error RiskLoadTooHigh(uint256 requested, uint256 max);

    modifier onlyOracleUpdater() {
        if (!accessControl.hasRole(accessControl.ORACLE_UPDATER_ROLE(), msg.sender)) {
            revert UnauthorizedCaller();
        }
        _;
    }

    constructor(address _accessControl) {
        require(_accessControl != address(0), "zero address");
        accessControl = BreezeAccessControl(_accessControl);
    }

    /// @notice Identifies one priced strike.
    /// @param regionId Region the reading is taken from.
    /// @param variable Weather variable (0 = rainfall, 1 = temperature).
    /// @param triggerBelow True if the strike pays when the reading falls BELOW
    /// `threshold` (drought cover), false if it pays ABOVE (flood cover).
    /// @param threshold Strike level, in the oracle's fixed-point units.
    /// @param monthOfYear 1-12. Weather is strongly seasonal, so a single
    /// annual figure would misprice every individual month.
    function strikeKey(
        bytes32 regionId,
        uint8 variable,
        bool triggerBelow,
        uint256 threshold,
        uint8 monthOfYear
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(regionId, variable, triggerBelow, threshold, monthOfYear));
    }

    function setStrikeProbability(
        bytes32 regionId,
        uint8 variable,
        bool triggerBelow,
        uint256 threshold,
        uint8 monthOfYear,
        uint32 probabilityBps,
        uint16 sampleYears
    ) external onlyOracleUpdater {
        if (probabilityBps > 10000) revert InvalidProbability();
        if (sampleYears < MIN_SAMPLE_YEARS) {
            revert InsufficientSample(sampleYears, MIN_SAMPLE_YEARS);
        }

        bytes32 key = strikeKey(regionId, variable, triggerBelow, threshold, monthOfYear);
        _strikes[key] = StrikeStats({
            probabilityBps: probabilityBps,
            sampleYears: sampleYears,
            updatedAt: uint64(block.timestamp),
            isSet: true
        });

        emit StrikeProbabilityUpdated(key, regionId, probabilityBps, sampleYears);
    }

    function getStrike(bytes32 key) external view returns (StrikeStats memory) {
        return _strikes[key];
    }

    function isPriced(bytes32 key) public view returns (bool) {
        return _strikes[key].isSet;
    }

    // ---------------------------------------------------------------------
    // Expected levels — what a continuous series is climatologically worth
    // ---------------------------------------------------------------------

    /// @notice Identifies one priced level.
    /// @dev No `variable` component: the region identifier already encodes it by
    /// convention, and the perpetual markets that consume this hold only a `regionId`.
    function levelKey(bytes32 regionId, uint8 monthOfYear) public pure returns (bytes32) {
        return keccak256(abi.encode("LEVEL", regionId, monthOfYear));
    }

    function setClimatologyLevel(
        bytes32 regionId,
        uint8 monthOfYear,
        uint256 level,
        uint16 sampleYears
    ) external onlyOracleUpdater {
        if (level == 0) revert InvalidLevel();
        if (sampleYears < MIN_SAMPLE_YEARS) {
            revert InsufficientSample(sampleYears, MIN_SAMPLE_YEARS);
        }

        bytes32 key = levelKey(regionId, monthOfYear);
        _levels[key] = ClimatologyLevel({
            expectedLevel: level,
            sampleYears: sampleYears,
            updatedAt: uint64(block.timestamp),
            isSet: true
        });

        emit ClimatologyLevelUpdated(key, regionId, monthOfYear, level, sampleYears);
    }

    function getLevel(bytes32 key) external view returns (ClimatologyLevel memory) {
        return _levels[key];
    }

    function isLevelSet(bytes32 key) public view returns (bool) {
        return _levels[key].isSet;
    }

    /// @notice Expected level for a region-month, reverting if it was never posted.
    /// @dev Reverts rather than returning zero, so a consumer cannot silently treat "no
    /// climatology" as "expected zero" — which for a rainfall market would make every
    /// possible mark price look infinitely wrong, and for a comparison against zero would
    /// make every mark look acceptable depending on the direction of the test.
    function expectedLevel(bytes32 regionId, uint8 monthOfYear) external view returns (uint256) {
        bytes32 key = levelKey(regionId, monthOfYear);
        ClimatologyLevel memory l = _levels[key];
        if (!l.isSet) revert LevelNotPriced(key);
        return l.expectedLevel;
    }

    /// @notice Premium for `payout` of cover on a priced strike.
    ///
    /// Fair value is `payout * probability` — the long-run expected cost of the
    /// promise. The risk load on top is what compensates the capital standing
    /// behind it for variance and for being locked up; without it, underwriters
    /// break even at best and have no reason to show up.
    ///
    /// @param riskLoadBps Markup over fair value, in basis points.
    function quotePremium(bytes32 key, uint256 payout, uint256 riskLoadBps)
        external
        view
        returns (uint256 premium)
    {
        if (riskLoadBps > MAX_RISK_LOAD_BPS) revert RiskLoadTooHigh(riskLoadBps, MAX_RISK_LOAD_BPS);

        StrikeStats memory s = _strikes[key];
        if (!s.isSet) revert StrikeNotPriced(key);

        uint256 fairValue = (payout * s.probabilityBps) / 10000;
        premium = fairValue + (fairValue * riskLoadBps) / 10000;

        // A premium at or above the payout is not cover, it is a fee for
        // nothing. Cap strictly below so the buyer always has something to win.
        if (premium >= payout) {
            premium = payout - 1;
        }
    }
}
