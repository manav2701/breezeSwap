// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../access/BreezeAccessControl.sol";
import "../oracle/IWeatherOracle.sol";
import "../oracle/StrikeProbabilityOracle.sol";
import "../vault/BreezeLiquidityVault.sol";

/// @title WeatherPolicyMarket
/// @notice One-sided weather cover sold directly from pooled LP capital.
///
/// Classic Markets need an exact counterparty to appear before anyone can hedge,
/// and Perp Markets need two-sided flow to stay balanced. Neither works at small
/// scale — the first hedger to arrive simply waits.
///
/// Here a buyer pays a premium priced off multi-decade history and the LP vault
/// underwrites the payout. It clears with a single buyer and a single LP, which
/// is what makes it viable before there is a market. The vault earns the premium
/// when the strike is not breached; that return is uncorrelated with crypto,
/// which is the reason capital shows up at all.
///
/// Pause discipline matches the rest of the protocol: buying can be paused,
/// settlement and claiming never can.
contract WeatherPolicyMarket is Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice How a period of readings collapses into the one number the strike is
    /// tested against.
    ///
    /// @dev This has to match how the PREMIUM was derived or the contract is
    /// mispriced, and the mismatch is not subtle. `weather-seed/src/climatology.ts`
    /// sums daily precipitation into a MONTHLY TOTAL and counts how often that total
    /// breached the strike — so a 40mm threshold means "40mm across the month".
    /// Settlement used to compare a SINGLE reading at expiry against that threshold.
    /// One day's rainfall is almost always below a monthly total, so drought cover
    /// triggered on nearly every policy while being charged the monthly-total
    /// probability. The pricing was right and the settlement was measuring a
    /// different quantity.
    enum Aggregation {
        SUM,    // rainfall totals — what the climatology script computes
        AVERAGE // temperature means
    }

    struct Policy {
        address holder;
        bytes32 regionId;
        uint256 threshold;
        bool triggerBelow;
        uint256 payout;
        uint256 premium;
        uint256 coverageStart;
        uint256 expiry;
        uint8 variable;
        uint8 monthOfYear;
        bool settled;
        bool triggered;
        /// Snapshotted at purchase. A later change to the variable's configured
        /// aggregation must not reinterpret cover that has already been sold.
        Aggregation aggregation;
    }

    BreezeAccessControl public immutable accessControl;
    IWeatherOracle public immutable weatherOracle;
    StrikeProbabilityOracle public immutable pricingOracle;
    BreezeLiquidityVault public immutable liquidityVault;
    IERC20 public immutable collateralToken;

    uint256 public constant MAX_ORACLE_AGE = 86400; // 24 hours

    /// @notice Base markup over fair value charged to buyers, paid to LPs.
    /// @dev Floored, not free: underwriting at fair value is a losing business
    /// after variance, so LPs must always be paid something for bearing it.
    uint256 public riskLoadBps = 3000; // +30%

    /// @notice Smallest permitted base risk load. Protects LPs from an admin
    /// pricing their risk away to nothing.
    uint256 public constant MIN_RISK_LOAD_BPS = 500; // +5%

    /// @notice Extra load applied in proportion to how full the vault is.
    ///
    /// Capital is scarcest exactly when the pool is most committed, so cover
    /// should cost more then. This is the same pressure valve GMX applies to
    /// skewed open interest, and it makes the book self-balancing instead of
    /// relying on an admin to notice.
    uint256 public utilizationLoadBps = 2000; // up to +20% at full utilisation

    /// @notice Longest cover term. Bounds how long LP capital can be locked by
    /// a single policy.
    uint256 public constant MAX_TERM = 365 days;

    /// @notice Minimum gap between buying cover and the risk period starting.
    ///
    /// Historical frequency is an *unconditional* probability. A buyer who can
    /// see a forecast for the period being covered knows the conditional
    /// probability instead, and will only buy when it exceeds the price — which
    /// bleeds the pool through pure selection rather than bad luck. Numerical
    /// weather prediction carries real skill to roughly two weeks and marginal
    /// skill to six, so cover is sold outside that horizon. This is why crop
    /// insurance has a sales closing date months before planting.
    uint256 public minLeadTime = 45 days;

    uint256 public constant MIN_LEAD_TIME_FLOOR = 21 days;

    /// @notice Cap on outstanding payout for any one region-month, as a share of
    /// vault assets.
    ///
    /// Weather risk is severely correlated inside a region and season: a single
    /// dry August triggers every August drought policy at once. Without a
    /// per-peril cap the pool looks diversified while holding one enormous bet.
    uint256 public maxPerilExposureBps = 2000; // 20% of vault assets

    uint256 public constant MAX_PERIL_EXPOSURE_CEILING_BPS = 4000;

    /// @notice Utilisation above which no new cover may be written.
    ///
    /// Deliberately below the vault's own reservation ceiling so the pool keeps
    /// a solvency buffer rather than underwriting until it is exactly full —
    /// the role Nexus Mutual's minimum capital requirement plays.
    uint256 public maxUnderwritingUtilizationBps = 7000; // 70%

    /// @notice Outstanding payout per (regionId, monthOfYear) bucket.
    mapping(bytes32 => uint256) public perilExposure;

    // -----------------------------------------------------------------
    // Period settlement
    // -----------------------------------------------------------------

    /// @notice Interval at which the oracle publishes readings for this region.
    ///
    /// @dev This is a statement about the DATA SOURCE, not a gas knob, and getting it
    /// wrong silently corrupts every `SUM` settlement: sampling a daily feed weekly
    /// would under-count a monthly total sevenfold. The protocol cannot verify an
    /// oracle's cadence, so this is trusted configuration — recorded as a disclosed
    /// limitation rather than pretended away.
    uint256 public samplingInterval = 1 days;

    /// @notice Most samples one settlement will read.
    ///
    /// @dev Settlement cost scales with the covered period, which makes an unbounded
    /// term the same liveness trap `openPositionObligations` was: a policy that cannot
    /// be settled cannot release its vault reservation. Bounding the sample count
    /// bounds settlement gas, and therefore bounds the term — at daily sampling this
    /// is the binding limit on cover length, well inside `MAX_TERM`.
    uint256 public constant MAX_SAMPLES = 62;

    /// @notice Fraction of expected samples that must be present to settle.
    ///
    /// @dev Mirrors the climatology script, which drops any month missing more than 2
    /// of its days rather than under-counting it. At a 30-sample term 9300 bps permits
    /// exactly 2 missing readings, so the settlement tolerance and the pricing
    /// tolerance are the same rule.
    ///
    /// The tolerance has to be tight in this direction specifically: a missing sample
    /// under-counts a `SUM`, which biases `triggerBelow` cover toward paying out. The
    /// error favours the buyer, so it is the LPs who need the bound.
    uint256 public minSampleCoverageBps = 9300;

    uint256 public constant MIN_SAMPLE_COVERAGE_FLOOR_BPS = 7500;

    /// @notice Aggregation configured for each weather variable.
    /// @dev Deliberately NOT a buyer input. Letting a buyer choose the statistic would
    /// decouple settlement from the probability the premium was computed from, which is
    /// the defect this whole mechanism exists to fix.
    mapping(uint8 => Aggregation) public variableAggregation;
    mapping(uint8 => bool) public variableConfigured;

    /// @dev Internal, with an explicit struct-returning accessor below rather than the
    /// auto-generated flat getter. Thirteen return values exceeded the EVM's stack
    /// depth during ABI encoding — and `(,,,,,,, uint256 expiry,,,,,)` was never
    /// readable anyway.
    mapping(uint256 => Policy) internal _policies;

    uint256 public nextPolicyId;

    /// @notice Payout obligations on policies that have not yet settled.
    uint256 public totalOutstandingPayout;

    /// @notice Premium collected on policies that have not yet resolved.
    /// Held by this contract, not the vault, and not yet LP value.
    uint256 public unearnedPremium;

    /// @notice Cap on aggregate outstanding payout, as a share of vault assets.
    ///
    /// The per-peril cap alone bounds each region-month bucket but not their sum,
    /// so enough distinct buckets still add up to an unbounded book. This is the
    /// ceiling on total promises made across every peril at once.
    uint256 public maxAggregateExposureBps = 6000; // 60% of vault assets

    uint256 public constant MAX_AGGREGATE_EXPOSURE_CEILING_BPS = 8000;

    event PolicyBought(
        uint256 indexed policyId,
        address indexed holder,
        bytes32 indexed regionId,
        uint256 payout,
        uint256 premium,
        uint256 expiry
    );
    event PolicySettled(uint256 indexed policyId, bool triggered, int256 reading, uint256 paid);
    event RiskLoadUpdated(uint256 oldBps, uint256 newBps);
    /// @dev The evidence behind a settlement. Without the sample counts, "the index
    /// came in at 31mm" is unauditable — it could be a full month or four days of it.
    event PolicyAggregated(
        uint256 indexed policyId,
        int256 aggregate,
        uint256 samplesPresent,
        uint256 samplesExpected
    );
    event VariableAggregationSet(uint8 variable, Aggregation aggregation);
    event SamplingIntervalUpdated(uint256 oldInterval, uint256 newInterval);

    error UnauthorizedCaller();
    error ZeroAddress();
    error InvalidTerm();
    error InvalidPayout();
    error PolicyAlreadySettled();
    error PolicyNotExpired();
    error OracleUnusable();
    error InsufficientVaultCapacity(uint256 required, uint256 available);
    error RiskLoadTooHigh();
    error RiskLoadTooLow();
    error InsideForecastWindow(uint256 coverageStart, uint256 earliestAllowed);
    error PerilExposureCapExceeded(uint256 resulting, uint256 cap);
    error AggregateExposureCapExceeded(uint256 resulting, uint256 cap);
    error UnderwritingHalted(uint256 utilizationBps, uint256 maxBps);
    error InvalidParameter();
    error TooManySamples(uint256 required, uint256 max);
    error UnalignedCoverageStart(uint256 coverageStart, uint256 interval);
    error VariableNotConfigured(uint8 variable);
    error InsufficientSampleCoverage(uint256 present, uint256 expected);

    modifier onlyAdmin() {
        if (!accessControl.hasRole(accessControl.ADMIN_ROLE(), msg.sender)) revert UnauthorizedCaller();
        _;
    }

    modifier onlyPauser() {
        if (!accessControl.hasRole(accessControl.PAUSER_ROLE(), msg.sender)) revert UnauthorizedCaller();
        _;
    }

    constructor(
        address _accessControl,
        address _weatherOracle,
        address _pricingOracle,
        address _liquidityVault,
        address _collateralToken
    ) {
        if (
            _accessControl == address(0) ||
            _weatherOracle == address(0) ||
            _pricingOracle == address(0) ||
            _liquidityVault == address(0) ||
            _collateralToken == address(0)
        ) revert ZeroAddress();

        accessControl = BreezeAccessControl(_accessControl);
        weatherOracle = IWeatherOracle(_weatherOracle);
        pricingOracle = StrikeProbabilityOracle(_pricingOracle);
        liquidityVault = BreezeLiquidityVault(_liquidityVault);
        collateralToken = IERC20(_collateralToken);

        // Rainfall (variable 0) is the only variable the climatology script prices, and
        // it prices monthly TOTALS. Anything else must be configured deliberately —
        // temperature priced on monthly means would settle wrongly under SUM, and an
        // enum defaulting to zero would have made that the silent behaviour.
        variableAggregation[0] = Aggregation.SUM;
        variableConfigured[0] = true;
        emit VariableAggregationSet(0, Aggregation.SUM);
    }

    /// @notice Bucket key for correlated-exposure accounting.
    function perilKey(bytes32 regionId, uint8 monthOfYear) public pure returns (bytes32) {
        return keccak256(abi.encode(regionId, monthOfYear));
    }

    /// @notice Full record of one policy.
    function getPolicy(uint256 policyId) external view returns (Policy memory) {
        return _policies[policyId];
    }

    /// @notice How many readings a term of `term` seconds is settled from.
    function sampleCount(uint256 term) public view returns (uint256) {
        return term / samplingInterval;
    }

    /// @notice Collapse the readings across `[from, from + count*interval)` into the
    /// single number the strike is tested against.
    ///
    /// @dev Samples on an exact grid and requires an EXACT timestamp match. The
    /// oracle's `getReading` falls back to the latest reading when the requested
    /// timestamp is absent, which is right for a point query and catastrophic for a
    /// sum — one missing day would silently contribute the previous day's value again.
    /// `Reading.timestamp` reports where the value actually came from, so a fallback is
    /// detectable without changing the oracle interface.
    ///
    /// Missing samples are skipped rather than interpolated. `SUM` therefore
    /// under-counts when readings are absent, which is exactly why
    /// `minSampleCoverageBps` is tight; `AVERAGE` divides by what was present and is
    /// unbiased.
    ///
    /// @return aggregate the settlement index
    /// @return present how many readings were found
    /// @return expected how many were sought
    function aggregateIndex(
        bytes32 regionId,
        uint256 from,
        uint256 count,
        Aggregation aggregation
    ) public view returns (int256 aggregate, uint256 present, uint256 expected) {
        expected = count;

        int256 total;
        for (uint256 i = 0; i < count; i++) {
            uint256 at = from + i * samplingInterval;
            IWeatherOracle.Reading memory r = weatherOracle.getReading(regionId, at);
            if (!r.isValid || r.timestamp != at) continue;
            total += r.value;
            present += 1;
        }

        if (present == 0) return (0, 0, expected);
        aggregate = aggregation == Aggregation.AVERAGE ? total / int256(present) : total;
    }

    /// @notice The settlement index for a policy, and the evidence behind it.
    function policyIndex(uint256 policyId)
        public
        view
        returns (int256 aggregate, uint256 present, uint256 expected)
    {
        Policy storage p = _policies[policyId];
        return aggregateIndex(
            p.regionId,
            p.coverageStart,
            sampleCount(p.expiry - p.coverageStart),
            p.aggregation
        );
    }

    /// @notice Whether a policy has enough of its covered period on record to settle.
    function hasSettleableIndex(uint256 policyId) public view returns (bool) {
        (, uint256 present, uint256 expected) = policyIndex(policyId);
        return expected > 0 && present * 10000 >= expected * minSampleCoverageBps;
    }

    /// @notice Vault utilisation in basis points.
    function currentUtilizationBps() public view returns (uint256) {
        uint256 assets = liquidityVault.totalAssets();
        if (assets == 0) return 10000;
        uint256 reserved = liquidityVault.totalReserved();
        return reserved >= assets ? 10000 : (reserved * 10000) / assets;
    }

    /// @notice Total load applied to fair value: base plus a utilisation surcharge.
    function effectiveRiskLoadBps() public view returns (uint256) {
        uint256 load = riskLoadBps + (utilizationLoadBps * currentUtilizationBps()) / 10000;
        uint256 max = pricingOracle.MAX_RISK_LOAD_BPS();
        return load > max ? max : load;
    }

    /// @notice Premium for a proposed policy, before buying it.
    function quote(
        bytes32 regionId,
        uint8 variable,
        bool triggerBelow,
        uint256 threshold,
        uint8 monthOfYear,
        uint256 payout
    ) public view returns (uint256 premium) {
        bytes32 key = pricingOracle.strikeKey(regionId, variable, triggerBelow, threshold, monthOfYear);
        return pricingOracle.quotePremium(key, payout, effectiveRiskLoadBps());
    }

    /// @notice Buy weather cover underwritten by the LP vault.
    ///
    /// The buyer pays `premium` up front, which goes to the vault immediately.
    /// The vault then reserves the remaining `payout - premium` so LPs cannot
    /// withdraw the capital standing behind this promise.
    function buyPolicy(
        bytes32 regionId,
        uint8 variable,
        bool triggerBelow,
        uint256 threshold,
        uint8 monthOfYear,
        uint256 payout,
        uint256 coverageStart,
        uint256 term
    ) external whenNotPaused nonReentrant returns (uint256 policyId) {
        if (payout == 0) revert InvalidPayout();
        _validateCoveragePeriod(variable, coverageStart, term);
        _checkSolvencyFloor();
        _checkPerilCap(regionId, monthOfYear, payout);
        _checkAggregateCap(payout);

        uint256 premium = quote(regionId, variable, triggerBelow, threshold, monthOfYear, payout);
        _collectAndReserve(premium, payout);

        uint256 expiry = coverageStart + term;
        policyId = nextPolicyId++;
        _policies[policyId] = Policy({
            holder: msg.sender,
            regionId: regionId,
            threshold: threshold,
            triggerBelow: triggerBelow,
            payout: payout,
            premium: premium,
            coverageStart: coverageStart,
            expiry: expiry,
            variable: variable,
            monthOfYear: monthOfYear,
            settled: false,
            triggered: false,
            aggregation: variableAggregation[variable]
        });

        totalOutstandingPayout += payout;
        perilExposure[perilKey(regionId, monthOfYear)] += payout;

        emit PolicyBought(policyId, msg.sender, regionId, payout, premium, expiry);
    }

    /// @dev Everything that makes a covered period settleable, in one place.
    ///
    /// Extracted from `buyPolicy` because it no longer fitted — eight parameters plus
    /// the sample arithmetic put the frame past the EVM's stack depth. Keeping it
    /// separate is better anyway: these are all statements about whether the period can
    /// ever be resolved, and a policy sold with an unsettleable period would hold its
    /// vault reservation forever.
    function _validateCoveragePeriod(uint8 variable, uint256 coverageStart, uint256 term)
        internal
        view
    {
        if (term == 0 || term > MAX_TERM) revert InvalidTerm();
        if (!variableConfigured[variable]) revert VariableNotConfigured(variable);

        // Settlement reads one sample per publication interval across the covered
        // period, so the term is bounded by what a single settlement can afford to read.
        uint256 samples = sampleCount(term);
        if (samples == 0) revert InvalidTerm();
        if (samples > MAX_SAMPLES) revert TooManySamples(samples, MAX_SAMPLES);

        // The sampling grid starts at `coverageStart`, so an unaligned start would ask
        // the oracle for readings at times a daily feed never publishes, and every
        // sample would come back missing.
        if (coverageStart % samplingInterval != 0) {
            revert UnalignedCoverageStart(coverageStart, samplingInterval);
        }

        // Sale window: the covered period must begin far enough out that no useful
        // forecast of it exists yet.
        if (coverageStart < block.timestamp + minLeadTime) {
            revert InsideForecastWindow(coverageStart, block.timestamp + minLeadTime);
        }
    }

    /// @dev Stop underwriting before the pool is exactly full, keeping a
    /// solvency buffer rather than writing cover down to the last unit.
    function _checkSolvencyFloor() internal view {
        uint256 utilization = currentUtilizationBps();
        if (utilization > maxUnderwritingUtilizationBps) {
            revert UnderwritingHalted(utilization, maxUnderwritingUtilizationBps);
        }
    }

    /// @dev Everything in one region-month triggers together, so it is capped
    /// as a single correlated exposure rather than counted as diversified.
    function _checkPerilCap(bytes32 regionId, uint8 monthOfYear, uint256 payout) internal view {
        bytes32 peril = perilKey(regionId, monthOfYear);
        uint256 resulting = perilExposure[peril] + payout;
        uint256 cap = (liquidityVault.totalAssets() * maxPerilExposureBps) / 10000;
        if (resulting > cap) revert PerilExposureCapExceeded(resulting, cap);
    }

    /// @dev Bounds the whole book. Per-peril caps limit each bucket but say
    /// nothing about their sum, so enough distinct region-months still add up to
    /// an unbounded set of promises.
    function _checkAggregateCap(uint256 payout) internal view {
        uint256 resulting = totalOutstandingPayout + payout;
        uint256 cap = (liquidityVault.totalAssets() * maxAggregateExposureBps) / 10000;
        if (resulting > cap) revert AggregateExposureCapExceeded(resulting, cap);
    }

    /// @dev Locks the GROSS payout, not the payout net of premium.
    ///
    /// Reserving only `payout - premium` looks right — the premium is paid into
    /// the vault, so on paper the two together cover the promise. They do not.
    /// Premium enters as vault profit and becomes withdrawable LP value once it
    /// vests, on a schedule with no relation to the policy's term, while the
    /// obligation runs to expiry. A buyer's claim then comes up short by exactly
    /// the premium they paid, and the effect grows with the strike probability:
    /// on a 70% strike the premium is most of the payout, so almost nothing is
    /// reserved and the cover is largely illusory.
    ///
    /// Cover is therefore collateralised to its full limit, the way a
    /// catastrophe bond is.
    ///
    /// The premium is NOT paid to the vault here. It is held as an unearned
    /// premium reserve until the policy resolves. Premium is compensation for
    /// carrying a risk to its end; releasing it to LPs on the day of sale means
    /// it is fully recognised before the covered period has even begun, so an
    /// LP can collect it having underwritten nothing. Holding it until
    /// settlement ties the reward to the risk it was charged for, and makes a
    /// refund on an unresolvable policy a simple transfer rather than a claim
    /// against pooled capital.
    function _collectAndReserve(uint256 premium, uint256 payout) internal {
        uint256 capacity = liquidityVault.reservableLiquidity();
        if (payout > capacity) revert InsufficientVaultCapacity(payout, capacity);

        collateralToken.safeTransferFrom(msg.sender, address(this), premium);
        unearnedPremium += premium;

        liquidityVault.reserve(payout);
    }

    /// @notice Settle an expired policy against the weather oracle.
    /// @dev Permissionless and never pausable — a buyer must always be able to
    /// collect on cover they already paid for.
    function settlePolicy(uint256 policyId) external nonReentrant returns (uint256 paid) {
        Policy storage p = _policies[policyId];
        if (p.settled) revert PolicyAlreadySettled();
        if (block.timestamp < p.expiry) revert PolicyNotExpired();

        if (weatherOracle.isStale(p.regionId, MAX_ORACLE_AGE)) revert OracleUnusable();

        // The index is the whole covered period collapsed by the aggregation the
        // premium was priced under — not the single reading at expiry, which measured a
        // different quantity from the one the buyer was charged for.
        (int256 aggregate, uint256 present, uint256 expected) = policyIndex(policyId);
        if (expected == 0 || present * 10000 < expected * minSampleCoverageBps) {
            revert InsufficientSampleCoverage(present, expected);
        }

        // A negative index cannot be compared against an unsigned threshold without
        // wrapping. Rainfall totals are non-negative by construction; a variable that
        // can go negative (temperature in Celsius) needs an offset encoding, the same
        // requirement `BreezePerpMarket` documents for its index price.
        bool triggered = aggregate < 0
            ? p.triggerBelow
            : (
                p.triggerBelow
                    ? uint256(aggregate) < p.threshold
                    : uint256(aggregate) > p.threshold
            );

        emit PolicyAggregated(policyId, aggregate, present, expected);

        p.settled = true;
        p.triggered = triggered;
        totalOutstandingPayout -= p.payout;
        perilExposure[perilKey(p.regionId, p.monthOfYear)] -= p.payout;

        // The risk is over, so the premium is now earned and becomes LP revenue.
        unearnedPremium -= p.premium;
        collateralToken.forceApprove(address(liquidityVault), p.premium);
        liquidityVault.absorbProfit(p.premium);

        // Release the reservation either way — this policy no longer has a claim
        // on LP capital once it has been resolved. Mirrors the gross amount
        // locked in `_collectAndReserve`.
        liquidityVault.release(p.payout);

        if (triggered) {
            // The vault may be unable to cover in full if it has been drawn down
            // by other losses; pay what is available rather than reverting and
            // leaving the buyer with nothing.
            paid = liquidityVault.coverLoss(p.payout);
            if (paid > 0) {
                collateralToken.safeTransfer(p.holder, paid);
            }
        }

        emit PolicySettled(policyId, triggered, aggregate, paid);
    }

    /// @notice How long after expiry a policy may wait for a usable oracle
    /// reading before it can be voided.
    uint256 public constant SETTLEMENT_GRACE = 30 days;

    event PolicyVoided(uint256 indexed policyId, uint256 premiumRefunded);

    error PolicyStillSettleable();

    /// @notice Void a policy that can no longer be settled, refunding the premium.
    ///
    /// `settlePolicy` is the only path that releases the vault reservation, and
    /// it reverts while the oracle is unusable. Without an escape, one silent
    /// region locks the capital backing that policy permanently — trapping LP
    /// funds just as surely as a bad pause would, only by a different route.
    ///
    /// Permissionless and only callable once the grace period has elapsed with
    /// no usable reading. The buyer is made whole on premium because they did
    /// not receive the cover they paid for; they are not paid the payout,
    /// because nobody can show the strike was breached.
    function voidUnsettleablePolicy(uint256 policyId) external nonReentrant {
        Policy storage p = _policies[policyId];
        if (p.settled) revert PolicyAlreadySettled();
        if (block.timestamp < p.expiry + SETTLEMENT_GRACE) revert PolicyNotExpired();

        // If it can be settled properly, it must be. This has to ask the SAME question
        // `settlePolicy` asks, or the two guards can both refuse: a policy with a
        // usable reading at expiry but too much of its covered period missing would be
        // neither settleable nor voidable, and its vault reservation would be locked
        // forever — which is precisely the trap this function exists to prevent.
        if (!weatherOracle.isStale(p.regionId, MAX_ORACLE_AGE) && hasSettleableIndex(policyId)) {
            revert PolicyStillSettleable();
        }

        p.settled = true;
        totalOutstandingPayout -= p.payout;
        perilExposure[perilKey(p.regionId, p.monthOfYear)] -= p.payout;
        liquidityVault.release(p.payout);

        // The premium was never handed to the vault, so refunding it is a plain
        // transfer of funds still held here — not a draw on LP capital for a
        // risk the LPs never got paid for.
        uint256 refund = p.premium;
        unearnedPremium -= refund;
        collateralToken.safeTransfer(p.holder, refund);

        emit PolicyVoided(policyId, refund);
    }

    function setRiskLoadBps(uint256 newBps) external onlyAdmin {
        if (newBps > pricingOracle.MAX_RISK_LOAD_BPS()) revert RiskLoadTooHigh();
        // Floored so LP compensation cannot be set to nothing.
        if (newBps < MIN_RISK_LOAD_BPS) revert RiskLoadTooLow();
        uint256 old = riskLoadBps;
        riskLoadBps = newBps;
        emit RiskLoadUpdated(old, newBps);
    }

    function setUtilizationLoadBps(uint256 newBps) external onlyAdmin {
        if (newBps > pricingOracle.MAX_RISK_LOAD_BPS()) revert RiskLoadTooHigh();
        utilizationLoadBps = newBps;
    }

    /// @dev Floored, not settable to zero — a shorter lead time than the forecast
    /// horizon reopens the selection hole the window exists to close.
    function setMinLeadTime(uint256 newLeadTime) external onlyAdmin {
        if (newLeadTime < MIN_LEAD_TIME_FLOOR) revert InvalidParameter();
        minLeadTime = newLeadTime;
    }

    function setMaxPerilExposureBps(uint256 newBps) external onlyAdmin {
        if (newBps == 0 || newBps > MAX_PERIL_EXPOSURE_CEILING_BPS) revert InvalidParameter();
        maxPerilExposureBps = newBps;
    }

    function setMaxAggregateExposureBps(uint256 newBps) external onlyAdmin {
        if (newBps == 0 || newBps > MAX_AGGREGATE_EXPOSURE_CEILING_BPS) revert InvalidParameter();
        maxAggregateExposureBps = newBps;
    }

    /// @notice Declare how a weather variable's readings collapse into a settlement
    /// index.
    /// @dev Affects only policies sold afterwards — each policy snapshots its own
    /// aggregation, so this cannot reinterpret cover already in force.
    function setVariableAggregation(uint8 variable, Aggregation aggregation) external onlyAdmin {
        variableAggregation[variable] = aggregation;
        variableConfigured[variable] = true;
        emit VariableAggregationSet(variable, aggregation);
    }

    /// @notice Declare the oracle's publication cadence for this market.
    ///
    /// @dev Existing policies keep their grid implicitly — they store `coverageStart`
    /// and derive samples from the live interval, so changing this DOES change how an
    /// in-force policy settles. That is unavoidable without storing the interval per
    /// policy, and it is the reason this is admin-only and bounded: it is a correction
    /// for a data source that changed cadence, not a routine knob.
    function setSamplingInterval(uint256 newInterval) external onlyAdmin {
        if (newInterval < 1 hours || newInterval > 7 days) revert InvalidParameter();
        uint256 old = samplingInterval;
        samplingInterval = newInterval;
        emit SamplingIntervalUpdated(old, newInterval);
    }

    /// @dev Floored so the tolerance cannot be widened until an under-counted `SUM`
    /// becomes an easy way to trigger drought cover.
    function setMinSampleCoverageBps(uint256 newBps) external onlyAdmin {
        if (newBps < MIN_SAMPLE_COVERAGE_FLOOR_BPS || newBps > 10000) revert InvalidParameter();
        minSampleCoverageBps = newBps;
    }

    function setMaxUnderwritingUtilizationBps(uint256 newBps) external onlyAdmin {
        if (newBps == 0 || newBps > 10000) revert InvalidParameter();
        maxUnderwritingUtilizationBps = newBps;
    }

    function pauseBuying() external onlyPauser {
        _pause();
    }

    function unpauseBuying() external onlyPauser {
        _unpause();
    }
}
