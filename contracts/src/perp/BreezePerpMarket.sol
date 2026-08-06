// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./VirtualAMM.sol";
import "./FundingRateEngine.sol";
import "./PerpConstants.sol";
import "./InsuranceFund.sol";
import "./IPerilExposureRegistry.sol";
import "../fees/FeeConfig.sol";
import "../fees/ProtocolTreasury.sol";
import "../vault/BreezeLiquidityVault.sol";
import "../vault/FirstLossReserve.sol";
import "../oracle/IWeatherOracle.sol";
import "../access/BreezeAccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/// @title BreezePerpMarket
/// @notice Perpetual vAMM weather market contract managing positions, leverage, funding rates, liquidations, and fees.
contract BreezePerpMarket is Pausable, ReentrancyGuard {
    using VirtualAMM for VirtualAMM.Reserves;
    /// @dev Every collateral movement goes through SafeERC20. Raw `transfer` here
    /// ignored the return value, so a token that signals failure by returning
    /// false rather than reverting would have let a payout silently not happen
    /// while the position was already marked closed. Raw `approve` is likewise
    /// replaced by `forceApprove`, which tolerates tokens that reject a non-zero
    /// to non-zero allowance change.
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;

    struct Position {
        address trader;
        bool isLong;
        uint256 collateral;        // Net collateral posted after fee deduction
        uint256 leverage;
        uint256 virtualSize;       // Weather exposure units from vAMM
        uint256 entryMarkPrice;
        int256 entryFundingIndex;   // effectiveFundingIndex() at open
        bool isOpen;
    }

    VirtualAMM.Reserves public reserves;
    IWeatherOracle public immutable oracle;
    InsuranceFund public immutable insuranceFund;
    FeeConfig public immutable feeConfig;
    ProtocolTreasury public immutable treasury;
    BreezeAccessControl public immutable accessControl;
    IERC20 public immutable collateralToken;
    bytes32 public immutable regionId;

    uint256 public constant MAX_ORACLE_AGE = 86400; // 24 hours

    /// @notice Fixed-point divisor of this market's oracle readings.
    ///
    /// @dev Mark price is 1e18-scaled; `IWeatherOracle.Reading.value` is a fixed
    /// point number in the oracle's own units ("mm of rain * 100"). Nothing
    /// reconciled the two, and the consequence was not a small pricing error but
    /// the complete loss of the funding mechanism: comparing a 1e18 mark against a
    /// 1e2 reading produces a deviation of order 1e16 bps on every single call, so
    /// the rate was clamped to `MAX_FUNDING_RATE_PER_PERIOD` in the same direction
    /// forever. Funding was not pulling mark toward index — it was a fixed maximum
    /// levy on longs that no market condition could change.
    ///
    /// The default matches the convention the rest of the stack actually uses —
    /// `ORACLE_DECIMALS = 6` in the SDK, which the indexer and the climatology
    /// seeder both follow. The `IWeatherOracle` NatSpec claiming "* 100" is stale
    /// and has been corrected; taking it at face value here would have replaced a
    /// pinned funding rate with a differently pinned one.
    ///
    /// Admin-settable rather than a constant because adapters legitimately differ
    /// in precision, and settable rather than immutable so an already-deployed
    /// market can be corrected when it is repointed at a new adapter. Bounded to
    /// 1e18 so it can never be set such that a reading is scaled up beyond its
    /// true magnitude.
    uint256 public oracleValueScale = 1e6;
    uint256 public constant MAX_ORACLE_VALUE_SCALE = 1e18;

    mapping(uint256 => Position) public positions;
    uint256 public nextPositionId;
    uint256 public totalLongOpenInterest;   // Total net collateral backing Longs
    uint256 public totalShortOpenInterest;  // Total net collateral backing Shorts

    /// @notice IDs of positions that are currently open.
    ///
    /// @dev `openPositionObligations()` used to loop over `nextPositionId` — every
    /// position the market had EVER created — and run a vAMM quote on each. That
    /// loop only ever grew, so `sweepSurplus()` was guaranteed to exceed the block
    /// gas limit eventually and stay there, permanently stranding realised trader
    /// losses that belong to LPs. A liveness failure on a timer, and one no test
    /// would catch because no test opens thousands of positions.
    ///
    /// Iterating open positions instead makes the cost proportional to live
    /// exposure rather than to history, and it shrinks again as positions close.
    ///
    /// An exact O(1) obligation figure is not available, and it is worth recording
    /// why rather than leaving it looking like an oversight. Obligations are
    /// `Σ max(0, collateral + pnl)`. The `max(0, ·)` is per position and cannot be
    /// aggregated — an underwater position is owed nothing and its deficit must not
    /// offset a winner's claim. Constant-product PnL *is* path-independent in
    /// aggregate, so `Σ pnl` is computable in one curve evaluation, but that is a
    /// LOWER bound on obligations, and under-stating obligations over-sweeps into
    /// money open positions have a claim on. Erring the other way with a crude
    /// upper bound would stop `sweepSurplus` ever firing. So the loop stays, and is
    /// bounded instead.
    EnumerableSet.UintSet private _openPositions;

    /// @notice Hard ceiling on concurrently open positions.
    ///
    /// @dev This is what turns "bounded in practice" into a guarantee. It can
    /// refuse an open, which is consistent with the capacity cap already doing so;
    /// it can never refuse a close or a liquidation, which is the property that
    /// actually matters.
    uint256 public constant MAX_OPEN_POSITIONS = 1000;

    /// @notice Smallest position the market will accept.
    ///
    /// @dev Two independent reasons, either sufficient on its own. Dust positions
    /// are unliquidatable in practice — a 2% liquidation reward on a trivial
    /// position does not cover the gas to claim it — so they would accumulate as
    /// permanently open junk. And without a floor, `MAX_OPEN_POSITIONS` could be
    /// filled for almost nothing, turning a gas bound into a cheap denial of
    /// service. A floor makes holding a slot cost real capital.
    uint256 public minCollateral = 1e18;

    /// @dev Ceiling on the dust filter, so it cannot become an access control.
    uint256 public constant MAX_MIN_COLLATERAL = 10_000e18;

    /// @notice Open interest measured in NOTIONAL, i.e. collateral × leverage.
    ///
    /// @dev Collateral is not a measure of risk. A 3x long and a 1x short of
    /// equal collateral net to zero collateral-skew while carrying a large
    /// directional position, so any reserve sized off collateral is wrong by a
    /// factor of leverage. Exposure is what moves with price, and exposure is
    /// notional.
    uint256 public totalLongNotional;
    uint256 public totalShortNotional;

    /// @notice Funding index committed as of `lastFundingSettledAt`.
    /// @dev Read `effectiveFundingIndex()`, not this, for the index in force now.
    int256 public cumulativeFundingIndex;
    uint256 public lastFundingSettledAt;

    /// @notice Funding rate per interval currently accruing, in bps.
    ///
    /// @dev Funding accrues CONTINUOUSLY between settlements, and this is the rate
    /// it accrues at. That property is the whole point, and it took two attempts to
    /// get right.
    ///
    /// The original design keyed funding off the cumulative index at open, so a
    /// position collected the entire next settlement no matter how briefly it had
    /// existed. Open the largest permitted position on the favoured side one block
    /// before settlement, collect ~5% of notional, close. Twenty rounds of that
    /// extracted 43.6% of the pool in simulation.
    ///
    /// The first fix was epoch-based: skip the interval a position was only partly
    /// present for. It closed the exploit but replaced it with a consistent bias
    /// against traders — a position present for 99% of an interval was paid for
    /// none of it.
    ///
    /// Continuous accrual removes both. A position accrues funding for exactly the
    /// time it was open. Note that simply scaling the index AT SETTLEMENT does not
    /// achieve this: the index would still only move in discrete jumps, so a
    /// position opened mid-interval would capture the whole preceding window. The
    /// index has to be a function of time when it is READ, which is what
    /// `effectiveFundingIndex()` provides.
    int256 public currentFundingRate;

    /// @notice How long a funding interval lasts for this market.
    uint256 public fundingInterval = PerpConstants.PRODUCTION_FUNDING_INTERVAL;

    /// @notice Maximum absolute funding rate per interval, in bps.
    /// @dev Defaults to the production value. The demo preset must be applied
    /// deliberately via `setFundingParams`, so it cannot ship by accident.
    uint256 public maxFundingRateBps = PerpConstants.PRODUCTION_MAX_FUNDING_RATE_BPS;

    /// @notice Pooled LP capital backing trader profit this market cannot fund
    /// from posted collateral. Optional: when unset the market can only pay out
    /// what traders have posted, so a winning trader may be paid less than they
    /// are owed. See SECURITY.md.
    BreezeLiquidityVault public liquidityVault;

    /// @notice Destination for the first-loss leg of this market's fees.
    ///
    /// @dev The market funds waterfall tier 1 but never draws on it — drawing is
    /// the vault's job. That asymmetry is the point of the reserve existing at all:
    /// `insuranceFund` is drawn HERE, for liquidation bad debt, and the two must
    /// not share a balance. Optional; when unset the first-loss leg joins the
    /// liquidation backstop, which is exactly the pre-existing behaviour.
    FirstLossReserve public firstLossReserve;

    /// @notice Aggregate exposure caps shared with markets on a correlated peril.
    ///
    /// @dev `maxNotionalCapacity()` bounds this market against the shared pool but says
    /// nothing about its correlated peers, so two rainfall markets on regions that see
    /// the same storm could each fill their own capacity while the pool faces one event.
    /// Optional; unset means this market is bounded only by its own capacity, which is
    /// the behaviour it had before.
    IPerilExposureRegistry public perilRegistry;

    /// @notice Adverse price move, in bps, that this market's backing covers.
    ///
    /// Applied to `worstCaseNotionalExposure()`. At 10000 the market is fully
    /// collateralised against a total loss on its directional book — the
    /// catastrophe-bond posture. Below that the protocol is knowingly levered
    /// and the uncovered tail is a disclosed choice rather than an oversight.
    ///
    /// Deliberately NOT derived from weather volatility. Mark price here moves
    /// on order flow, not on weather, so weather vol measures the wrong
    /// variable; and a volatility-scaled requirement would shrink during calm
    /// periods, which is exactly when tail exposure accumulates. Insurance
    /// capital is sized on the tail, not the mean.
    /// Default set from simulation, not intuition, and RE-derived after the funding
    /// mechanism was corrected. Sweeping {30%, 50%, 75%, 100%} across 3 seeds x 900
    /// actions under the most aggressive funding parameters the protocol permits:
    ///
    ///   30%  — 28 short-paid closes, one by 100%, one seed drained. Rejection 9.9%.
    ///   50%  — zero shortfalls, rejection 8.6%   <-- frontier
    ///   75%  — zero shortfalls, rejection 14.2%
    ///   100% — zero shortfalls, rejection 21.0%
    ///
    /// Under-reserving remains strictly worse on BOTH axes: 30% both fails to pay
    /// traders AND rejects more trades than 50%, because a drained pool refuses
    /// everything. But 50% now dominates 75%, where the earlier calibration put the
    /// frontier at 75%. The frontier moved because the funding fixes (oracle scale,
    /// then continuous time-weighted accrual) removed a systematic mispricing that
    /// had been driving far larger PnL swings than real exposure justified.
    ///
    /// Calibrated against the AGGRESSIVE funding preset deliberately. Under
    /// production funding parameters every ratio including 30% survives, so that
    /// regime cannot discriminate — it shows the protocol is comfortable, not that
    /// 30% is safe. Insurance capital is sized on the tail.
    ///
    /// Known limits of this figure: 40% is untested, so the failure boundary is only
    /// located between 30% and 50%. The loss waterfall now sits beneath this as a
    /// second line of defence, which it did not during the first calibration.
    uint256 public skewReserveBps = 5000; // cover a 50% adverse move

    uint256 public constant MAX_SKEW_RESERVE_BPS = 10000; // full collateralisation

    /// @notice Surcharge on opens at full capacity utilisation, in bps of collateral.
    ///
    /// @dev The capacity cap is a cliff. Below it every trade costs the same; at it,
    /// nothing gets through. That is the wrong shape for a scarce resource: it neither
    /// discourages the marginal trade that fills the last of the book, nor pays LPs
    /// more for the tail exposure they take as the book fills. `WeatherPolicyMarket`
    /// already prices its capacity this way through `utilizationLoadBps`; perps
    /// rationed instead.
    ///
    /// Scaled linearly with `capacityUtilizationBps`, so it is zero on an empty book
    /// and `utilizationFeeBps` on a full one. Charged ONLY on flow that raises
    /// worst-case exposure — a trade growing the smaller side consumes no scarce
    /// capacity and pays nothing extra, which is the same treatment the skew and
    /// capacity checks already give balancing flow.
    ///
    /// The proceeds are RETAINED rather than routed. Surcharge tokens simply stay in
    /// the market, which puts the balance above `openPositionObligations()`, so the
    /// existing `sweepSurplus()` remits them to LPs as profit. That is deliberate: an
    /// explicit transfer would add an external call, and a failure mode, to the open
    /// path for no gain.
    ///
    /// This does NOT replace the cap. The cap is a solvency bound derived from backing
    /// that actually exists; the surcharge only makes the approach to it expensive so
    /// the cliff binds less often. Removing the cap and relying on price would mean
    /// accepting exposure the capital cannot support at any fee.
    uint256 public utilizationFeeBps = 40; // up to +0.40% of collateral at full capacity

    /// @dev Ceiling. At 200 a trade into a completely full book pays 2% of collateral
    /// on top of the ordinary fee, which is already punitive; beyond that the
    /// surcharge stops being a price and becomes a second, softer refusal.
    uint256 public constant MAX_UTILIZATION_FEE_BPS = 200;

    /// @notice Ceiling on |longOI - shortOI|. Set to 0 to disable the cap.
    /// @dev Seeded from the initial virtual reserve at construction so a market
    /// is skew-bounded from its first trade, and adjustable afterwards as the
    /// backing pool grows.
    uint256 public maxSkew;

    event PositionOpened(
        uint256 indexed positionId,
        address indexed trader,
        bool isLong,
        uint256 collateral,
        uint256 leverage,
        uint256 virtualSize,
        uint256 markPrice
    );
    event PositionClosed(
        uint256 indexed positionId,
        address indexed trader,
        int256 pnl,
        uint256 payout
    );
    event PositionLiquidated(
        uint256 indexed positionId,
        address indexed liquidator,
        uint256 reward,
        uint256 badDebt,
        uint256 coveredDebt
    );
    event FundingSettled(int256 fundingRate, int256 newCumulativeIndex, uint256 timestamp);
    event LiquidityVaultUpdated(address indexed oldVault, address indexed newVault);
    event VaultShortfallCovered(uint256 requested, uint256 covered);
    event SurplusSwept(uint256 amount);
    event PayoutShortfall(uint256 indexed positionId, uint256 owed, uint256 paid);
    event MaxSkewUpdated(uint256 oldMaxSkew, uint256 newMaxSkew);
    event VaultReserveSynced(uint256 target, uint256 actual);
    event SkewReserveBpsUpdated(uint256 oldBps, uint256 newBps);
    event OracleValueScaleUpdated(uint256 oldScale, uint256 newScale);
    event MinCollateralUpdated(uint256 oldMin, uint256 newMin);
    event FundingParamsUpdated(uint256 interval, uint256 maxRateBps);
    event FirstLossReserveUpdated(address indexed oldReserve, address indexed newReserve);
    event PerilRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event UtilizationFeeUpdated(uint256 oldBps, uint256 newBps);
    /// @dev Retained in the market, not transferred, so there is no destination
    /// address to report — `sweepSurplus` remits it to LPs later.
    event CapacitySurchargeCollected(
        uint256 indexed positionId,
        address indexed trader,
        uint256 amount,
        uint256 utilizationBps
    );
    /// @dev `firstLossShare` was added when tier 1 gained its own funded reserve.
    /// Consumers decoding this event must be updated together with the contract —
    /// the indexer ABI and the `fee_events` table both carry the extra leg.
    event FeeCollected(
        address indexed market,
        address indexed trader,
        uint256 feeAmount,
        uint256 insuranceShare,
        uint256 firstLossShare,
        uint256 treasuryShare
    );

    error UnauthorizedCaller();
    error InvalidLeverage();
    error PositionNotOpen();
    error PositionNotLiquidatable();
    error ZeroAddress();
    error SkewCapExceeded(uint256 resultingSkew, uint256 cap);
    error InsufficientVaultBacking(uint256 shortfall);
    error InvalidParameter();
    error NonPositiveIndexPrice(int256 reading);
    error ExceedsNotionalCapacity(uint256 resultingNotional, uint256 capacity);
    error BelowMinCollateral(uint256 provided, uint256 required);
    error TooManyOpenPositions(uint256 cap);

    modifier onlyPauser() {
        if (!accessControl.hasRole(accessControl.PAUSER_ROLE(), msg.sender)) {
            revert UnauthorizedCaller();
        }
        _;
    }

    constructor(
        VirtualAMM.Reserves memory initialReserves,
        address _oracle,
        address _insuranceFund,
        address _feeConfig,
        address _treasury,
        address _accessControl,
        address _collateralToken,
        bytes32 _regionId
    ) {
        if (
            _oracle == address(0) ||
            _insuranceFund == address(0) ||
            _feeConfig == address(0) ||
            _treasury == address(0) ||
            _accessControl == address(0) ||
            _collateralToken == address(0)
        ) revert ZeroAddress();

        reserves = initialReserves;
        maxSkew =
            (initialReserves.collateralReserve * PerpConstants.DEFAULT_MAX_SKEW_BPS_OF_RESERVE) / 10000;
        oracle = IWeatherOracle(_oracle);
        insuranceFund = InsuranceFund(_insuranceFund);
        feeConfig = FeeConfig(_feeConfig);
        treasury = ProtocolTreasury(_treasury);
        accessControl = BreezeAccessControl(_accessControl);
        collateralToken = IERC20(_collateralToken);
        regionId = _regionId;
        lastFundingSettledAt = block.timestamp;
    }

    function getMarkPrice() external view returns (uint256) {
        return reserves.markPrice();
    }

    /// @notice Unmatched open interest — the portion with no trader counterparty.
    function currentSkew() public view returns (uint256) {
        return
            totalLongOpenInterest > totalShortOpenInterest
                ? totalLongOpenInterest - totalShortOpenInterest
                : totalShortOpenInterest - totalLongOpenInterest;
    }

    /// @notice Open interest that is genuinely matched long-against-short.
    /// Funding is only zero-sum across this portion.
    function matchedOpenInterest() public view returns (uint256) {
        return
            totalLongOpenInterest < totalShortOpenInterest
                ? totalLongOpenInterest
                : totalShortOpenInterest;
    }

    /// @dev Rejects a trade only if it leaves the book over the cap AND made the
    /// imbalance worse.
    ///
    /// Testing the resulting skew alone is not enough. Closes carry no skew
    /// check, so ordinary user activity can leave the book above the cap; from
    /// there a pure "resulting skew > cap" rule rejects the very trades that
    /// would repair it, freezing the market one-way until the crowded side
    /// happens to unwind. An admin lowering `maxSkew` produces the same deadlock.
    /// @notice Directional notional the protocol is exposed to right now.
    function notionalSkew() public view returns (uint256) {
        return
            totalLongNotional > totalShortNotional
                ? totalLongNotional - totalShortNotional
                : totalShortNotional - totalLongNotional;
    }

    /// @notice Worst-case directional notional this market could carry.
    ///
    /// @dev Deliberately `max`, not `|difference|`. Sizing on current skew is
    /// reactive: a balanced 100k/100k book has zero skew and reserves nothing,
    /// but the moment one side closes the imbalance is 100k — and by then the
    /// LPs whose capital would have backed it have already been free to leave.
    /// Taking the larger side prices the exposure the book can reach without a
    /// single new position being opened, so the capital is present before it is
    /// needed rather than after.
    function worstCaseNotionalExposure() public view returns (uint256) {
        return totalLongNotional > totalShortNotional ? totalLongNotional : totalShortNotional;
    }

    /// @notice Largest worst-case notional this market's backing can support.
    ///
    /// @dev This is the preventive form of the reserve model, and it inverts the
    /// question the market asks. The reactive form accepted a trade, then tried to
    /// reserve capital for it, and dealt with the shortfall afterwards — which
    /// means the market could reach a state its capital did not cover and only
    /// find out on the way out. Deriving a capacity from the backing that already
    /// exists, and refusing anything beyond it, makes under-reserving
    /// unrepresentable rather than merely detected.
    ///
    /// Unbounded when there is no vault, or when the coverage ratio is zero: in
    /// both cases the market has explicitly opted out of backing, and a capacity
    /// of zero would freeze it entirely rather than expressing that choice.
    function maxNotionalCapacity() public view returns (uint256) {
        if (address(liquidityVault) == address(0) || skewReserveBps == 0) {
            return type(uint256).max;
        }
        uint256 backing = liquidityVault.marketReserved(address(this))
            + liquidityVault.reservableByMarket(address(this));
        return (backing * 10000) / skewReserveBps;
    }

    /// @notice How full the book is against its capacity, in bps.
    /// @dev Zero when capacity is unbounded — a market that has opted out of backing
    /// has no scarcity to price, and treating "no vault" as "completely full" would
    /// levy the maximum surcharge on the market with the least justification for one.
    function capacityUtilizationBps() public view returns (uint256) {
        uint256 cap = maxNotionalCapacity();
        if (cap == type(uint256).max || cap == 0) return 0;

        uint256 exposure = worstCaseNotionalExposure();
        return exposure >= cap ? 10000 : (exposure * 10000) / cap;
    }

    /// @notice Surcharge currently applied to exposure-increasing opens, in bps.
    function utilizationSurchargeBps() public view returns (uint256) {
        return (utilizationFeeBps * capacityUtilizationBps()) / 10000;
    }

    /// @notice Total fee an exposure-increasing open pays right now, in bps.
    /// @dev Published so a caller can quote the real cost rather than discovering it
    /// from the difference between what they posted and what got recorded.
    function effectiveOpenFeeBps() external view returns (uint256) {
        return feeConfig.tradingFeeBps() + utilizationSurchargeBps();
    }

    /// @dev The scarcity surcharge for a prospective open, or zero if the trade does
    /// not raise worst-case exposure.
    ///
    /// `addedNotional` is measured before the surcharge is deducted, which is mildly
    /// circular — the surcharge shrinks net collateral, which shrinks notional, which
    /// could in principle flip the "does this raise exposure" test. The error is a
    /// fraction of a basis point and it errs toward CHARGING, so it favours LPs rather
    /// than the trader. Resolving it exactly would need a fixed-point iteration to
    /// price a rounding difference.
    ///
    /// A trade that crosses from the smaller side to the larger pays the surcharge on
    /// its whole collateral rather than on the portion that actually adds exposure.
    /// Blunt, and knowingly so: pro-rating it would make the fee a function of where
    /// the book happened to sit at that instant, which is harder to quote than it is
    /// worth.
    function _utilizationSurcharge(bool isLong, uint256 addedNotional, uint256 collateral)
        internal
        view
        returns (uint256)
    {
        uint256 rate = utilizationSurchargeBps();
        if (rate == 0) return 0;

        uint256 side = isLong ? totalLongNotional : totalShortNotional;
        uint256 other = isLong ? totalShortNotional : totalLongNotional;

        // Worst case is `max(side, other)`, so it rises exactly when the side being
        // opened ends up above the other one.
        if (side + addedNotional <= other) return 0;

        return (collateral * rate) / 10000;
    }

    /// @notice Largest worst-case notional this market's PERIL GROUP leaves it.
    ///
    /// @dev Unbounded when no registry is set, or when the coverage ratio is zero — in
    /// the second case the market has opted out of backing entirely, so there is no
    /// capital commitment to aggregate and a group cap would be measuring nothing.
    ///
    /// Tolerant of a registry that reverts, for the same reason every other external
    /// call on this contract is: a misconfigured registry must not be able to stop
    /// trading in an otherwise healthy market. That makes the cap a control on declared
    /// correlation, not a proof of total correlation.
    function maxPerilNotionalCapacity() public view returns (uint256) {
        if (address(perilRegistry) == address(0) || skewReserveBps == 0) {
            return type(uint256).max;
        }
        // Not redundant with `try`. A call to an address with no code SUCCEEDS with empty
        // return data, and `catch` does not cover failures decoding a successful call's
        // return value — so a registry address pointing at nothing would revert every
        // open in this market rather than degrading to an uncapped one.
        if (address(perilRegistry).code.length == 0) return type(uint256).max;

        try perilRegistry.availableGroupReserve(address(this)) returns (uint256 room) {
            return (room * 10000) / skewReserveBps;
        } catch {
            return type(uint256).max;
        }
    }

    /// @notice The binding notional ceiling: this market's own capacity, and its peril
    /// group's.
    function effectiveNotionalCapacity() public view returns (uint256) {
        uint256 own = maxNotionalCapacity();
        uint256 peril = maxPerilNotionalCapacity();
        return own < peril ? own : peril;
    }

    /// @notice Additional notional this market will accept on `isLong`.
    /// @dev Published so a caller can size a trade that will actually be accepted
    /// instead of discovering the limit by reverting. Growing the SMALLER side is
    /// available up to parity regardless of the cap, because it does not raise
    /// worst-case exposure.
    ///
    /// Reports against `effectiveNotionalCapacity`, so a market constrained by its peril
    /// group publishes the limit that will actually bind rather than one it cannot honour.
    function availableNotional(bool isLong) public view returns (uint256) {
        uint256 cap = effectiveNotionalCapacity();
        if (cap == type(uint256).max) return type(uint256).max;

        uint256 side = isLong ? totalLongNotional : totalShortNotional;
        uint256 other = isLong ? totalShortNotional : totalLongNotional;

        uint256 toCap = cap > side ? cap - side : 0;
        uint256 toParity = other > side ? other - side : 0;
        return toParity > toCap ? toParity : toCap;
    }

    /// @dev Rejects a trade whose resulting exposure the backing cannot support.
    ///
    /// Only when the trade actually RAISES worst-case exposure. Exposure can sit
    /// above capacity without any trade having done anything wrong — LPs
    /// withdrawing, or an admin raising the coverage ratio, both shrink capacity
    /// under a book that was compliant when it was built. A bare
    /// "prospective > cap" rule would then reject the balancing trades that are
    /// the only thing able to bring the book back inside its limit, freezing the
    /// market one-way until the crowded side happened to unwind on its own.
    /// Checked against the binding limit of BOTH this market's own capacity and its peril
    /// group's, so a market cannot fill its own allowance while its correlated peers have
    /// already committed the pool's capital against the same weather event.
    function _checkNotionalCapacity(bool isLong, uint256 addedNotional) internal view {
        uint256 cap = effectiveNotionalCapacity();
        if (cap == type(uint256).max) return;

        // Add the notional to the side actually being opened, and only that side.
        uint256 newLong = isLong ? totalLongNotional + addedNotional : totalLongNotional;
        uint256 newShort = isLong ? totalShortNotional : totalShortNotional + addedNotional;
        uint256 prospective = newLong > newShort ? newLong : newShort;

        if (prospective <= cap) return;
        if (prospective <= worstCaseNotionalExposure()) return; // no new exposure
        revert ExceedsNotionalCapacity(prospective, cap);
    }

    /// @notice Split a collected fee across the liquidation backstop, waterfall
    /// tier 1, and the treasury, and send each leg on.
    ///
    /// @dev Shares are re-derived from `FeeConfig` here rather than passed in, so
    /// there is exactly one place that knows how a fee divides. The close path has
    /// to clamp the fee to the balance actually held, and when it recomputed the
    /// shares itself it did so against a hardcoded constant — which is precisely
    /// how a split silently stops matching its own configuration.
    ///
    /// With no reserve configured the first-loss leg joins the liquidation
    /// backstop rather than being stranded in this contract. That reproduces the
    /// original 80/20 behaviour for a market that has not been wired to a reserve,
    /// so the tier is opt-in rather than a migration requirement.
    function _routeFee(uint256 feeAmount, address who) internal {
        if (feeAmount == 0) return;

        uint256 insuranceShare = (feeAmount * feeConfig.insuranceShareBps()) / 10000;
        uint256 firstLossShare = (feeAmount * feeConfig.firstLossShareBps()) / 10000;
        uint256 treasuryShare = feeAmount - insuranceShare - firstLossShare;

        if (address(firstLossReserve) == address(0)) {
            insuranceShare += firstLossShare;
            firstLossShare = 0;
        }

        if (insuranceShare > 0) {
            collateralToken.forceApprove(address(insuranceFund), insuranceShare);
            insuranceFund.deposit(insuranceShare);
        }
        if (firstLossShare > 0) {
            collateralToken.forceApprove(address(firstLossReserve), firstLossShare);
            firstLossReserve.deposit(firstLossShare);
        }
        if (treasuryShare > 0) {
            collateralToken.safeTransfer(address(treasury), treasuryShare);
            treasury.receiveFee(treasuryShare);
        }

        emit FeeCollected(address(this), who, feeAmount, insuranceShare, firstLossShare, treasuryShare);
    }

    /// @dev Prospective collateral-denominated skew, for the pre-trade skew check.
    function _prospectiveSkew(bool isLong, uint256 netCollateral) internal view returns (uint256) {
        uint256 lng = isLong ? totalLongOpenInterest + netCollateral : totalLongOpenInterest;
        uint256 shrt = isLong ? totalShortOpenInterest : totalShortOpenInterest + netCollateral;
        return lng > shrt ? lng - shrt : shrt - lng;
    }

    /// @notice Capital this market should have locked in the vault right now.
    /// @dev `coverageRatioBps` is the adverse price move the protocol commits to
    /// covering on that exposure. Full collateralisation (10000) is the cat-bond
    /// posture; below that the protocol is deliberately levered and the residual
    /// is disclosed rather than hidden.
    function requiredVaultReserve() public view returns (uint256) {
        return (worstCaseNotionalExposure() * skewReserveBps) / 10000;
    }

    /// @notice Align the vault reservation with current unmatched exposure.
    ///
    /// @dev Without this the market backs open positions with capital LPs can
    /// withdraw at will — including funds this market swept to them. Called on
    /// every path that changes open interest.
    ///
    /// A shortfall is only fatal when the trade made things worse: if the vault
    /// cannot cover the increase, opening more one-sided risk must fail, but
    /// closing or rebalancing must never be blocked by it.
    /// @return shortfall Amount that could not be reserved.
    function _syncVaultReserve() internal returns (uint256 shortfall) {
        if (address(liquidityVault) == address(0)) return 0;

        uint256 target = requiredVaultReserve();
        uint256 current = liquidityVault.marketReserved(address(this));

        // Every vault call here is tolerant of failure. This runs on the close and
        // liquidation paths, and those must never be blocked by the state of the
        // backing pool — revoking this market's vault authorisation, for example,
        // would otherwise freeze every trader's collateral and disable
        // liquidations entirely. Backing is best-effort; exiting is not.
        if (target > current) {
            uint256 delta = target - current;
            // Binding limit is the tighter of the pool-wide cap and this
            // market's own concentration limit.
            uint256 capacity = liquidityVault.reservableByMarket(address(this));
            uint256 take = delta > capacity ? capacity : delta;
            if (take > 0) {
                try liquidityVault.reserve(take) {} catch {
                    take = 0;
                }
            }
            shortfall = delta - take;
        } else if (current > target) {
            try liquidityVault.release(current - target) {} catch {}
        }

        emit VaultReserveSynced(target, liquidityVault.marketReserved(address(this)));
    }

    function _enforceSkewCapAgainst(uint256 skewAfter, uint256 skewBefore) internal view {
        if (maxSkew == 0) return; // cap disabled
        if (skewAfter <= maxSkew) return;
        if (skewAfter < skewBefore) return; // moves toward balance — always allowed
        revert SkewCapExceeded(skewAfter, maxSkew);
    }

    function _enforceSkewCap(uint256 skewBefore) internal view {
        _enforceSkewCapAgainst(currentSkew(), skewBefore);
    }

    function openPosition(bool isLong, uint256 collateral, uint256 leverage)
        external
        whenNotPaused
        nonReentrant
        returns (uint256 positionId)
    {
        if (leverage == 0 || leverage > PerpConstants.MAX_LEVERAGE) revert InvalidLeverage();
        if (collateral < minCollateral) revert BelowMinCollateral(collateral, minCollateral);
        if (_openPositions.length() >= MAX_OPEN_POSITIONS) {
            revert TooManyOpenPositions(MAX_OPEN_POSITIONS);
        }

        // Deduct trading fee from posted margin collateral
        (uint256 feeAmount, , , ) = feeConfig.calculateFeeSplit(collateral);

        // Admissibility is decided BEFORE any token moves. The checks used to run
        // after the collateral transfer and the fee legs, against already-mutated
        // open-interest totals — correct in outcome, since the whole call reverts,
        // but it meant the contract briefly held a state it was about to reject,
        // and the limits could only be discovered by attempting the trade. Deciding
        // up front is what makes the cap a stated capacity rather than a
        // post-hoc repair.
        // Scarcity is priced before capacity is checked, so the surcharge applies on
        // the way up to the cap rather than only at it.
        uint256 surcharge =
            _utilizationSurcharge(isLong, (collateral - feeAmount) * leverage, collateral);

        uint256 netCollateral = collateral - feeAmount - surcharge;
        uint256 notional = netCollateral * leverage;

        _checkNotionalCapacity(isLong, notional);
        _enforceSkewCapAgainst(_prospectiveSkew(isLong, netCollateral), currentSkew());

        collateralToken.safeTransferFrom(msg.sender, address(this), collateral);

        _routeFee(feeAmount, msg.sender);

        uint256 exposureOut;
        VirtualAMM.Reserves memory newReserves;

        uint256 skewBefore = currentSkew();

        if (isLong) {
            (exposureOut, newReserves) = reserves.quoteOpenLong(notional);
            totalLongOpenInterest += netCollateral;
            totalLongNotional += notional;
        } else {
            (exposureOut, newReserves) = reserves.quoteOpenShort(notional);
            totalShortOpenInterest += netCollateral;
            totalShortNotional += notional;
        }

        // Reject trades that push the market further past its skew ceiling.
        // Trades that reduce the imbalance stay available even when the book is
        // already over the cap, so the market can always be repaired.
        _enforceSkewCap(skewBefore);

        // Lock LP capital against the unmatched exposure this trade creates.
        // A trade that worsens the imbalance may not proceed unless the vault
        // can actually back it; one that improves it is never blocked.
        uint256 shortfall = _syncVaultReserve();
        if (shortfall > 0 && currentSkew() > skewBefore) {
            revert InsufficientVaultBacking(shortfall);
        }

        reserves = newReserves;
        positionId = nextPositionId++;
        _openPositions.add(positionId);

        positions[positionId] = Position({
            trader: msg.sender,
            isLong: isLong,
            collateral: netCollateral,
            leverage: leverage,
            virtualSize: exposureOut,
            entryMarkPrice: reserves.markPrice(),
            entryFundingIndex: effectiveFundingIndex(),
            isOpen: true
        });

        // A separate event rather than a field on `PositionOpened`, so adding capacity
        // pricing does not change an event signature consumers already decode.
        if (surcharge > 0) {
            emit CapacitySurchargeCollected(
                positionId, msg.sender, surcharge, capacityUtilizationBps()
            );
        }

        emit PositionOpened(
            positionId,
            msg.sender,
            isLong,
            netCollateral,
            leverage,
            exposureOut,
            reserves.markPrice()
        );
    }

    function closePosition(uint256 positionId) external nonReentrant returns (int256 pnl) {
        Position storage pos = positions[positionId];
        if (!pos.isOpen) revert PositionNotOpen();
        require(pos.trader == msg.sender, "not position owner");

        pnl = _executeClose(positionId, pos, msg.sender);
    }

    function liquidate(uint256 positionId) external nonReentrant returns (uint256 reward) {
        Position storage pos = positions[positionId];
        if (!pos.isOpen) revert PositionNotOpen();
        if (!_isLiquidatable(positionId)) revert PositionNotLiquidatable();

        return _executeLiquidation(positionId, pos, msg.sender);
    }

    function settleFunding() external {
        require(
            block.timestamp >= lastFundingSettledAt + fundingInterval,
            "funding interval not reached"
        );

        IWeatherOracle.Reading memory reading = oracle.getReading(regionId, block.timestamp);
        require(reading.isValid, "oracle reading invalid");
        require(!oracle.isStale(regionId, MAX_ORACLE_AGE), "oracle reading stale");

        // A non-positive reading is rejected rather than cast. `uint256(int256)`
        // on a negative value wraps to near-2^256, which reads as an
        // astronomically high index price and pins funding at the cap in the
        // opposite direction — the same class of silent failure as the scale
        // mismatch, and just as invisible. Markets on a variable that can go
        // negative (temperature in °C) must therefore use an offset encoding,
        // e.g. kelvin or °C+100, so the reading stays positive across its range.
        if (reading.value <= 0) revert NonPositiveIndexPrice(reading.value);

        int256 rate = FundingRateEngine.calculateFundingRate(
            reserves.markPrice(),
            indexPrice(uint256(reading.value)),
            maxFundingRateBps
        );

        // Commit what the OLD rate accrued up to now BEFORE adopting the new one.
        // Taking the new rate first would retroactively reprice the whole elapsed
        // window at a rate that was not in force during it.
        cumulativeFundingIndex = effectiveFundingIndex();
        currentFundingRate = rate;
        lastFundingSettledAt = block.timestamp;

        emit FundingSettled(rate, cumulativeFundingIndex, block.timestamp);
    }

    /// @notice A raw oracle reading lifted onto the mark price's 1e18 scale.
    /// @dev Exposed so the mark/index gap that drives funding is externally
    /// checkable. A funding mechanism nobody can verify is one nobody notices has
    /// broken.
    function indexPrice(uint256 rawReading) public view returns (uint256) {
        return (rawReading * 1e18) / oracleValueScale;
    }

    /// @notice Current index price from the oracle, on the mark price's scale.
    function currentIndexPrice() external view returns (uint256) {
        IWeatherOracle.Reading memory reading = oracle.getReading(regionId, block.timestamp);
        if (!reading.isValid || reading.value <= 0) return 0;
        return indexPrice(uint256(reading.value));
    }

    /// @notice Set this market's funding interval and rate ceiling.
    ///
    /// @dev Set atomically, because the two are only meaningful together — a rate
    /// is "per interval", so changing one without the other silently rescales the
    /// effective cost of funding.
    ///
    /// Commits the accrual under the outgoing parameters first. Without that, a
    /// change to `fundingInterval` would retroactively reprice the elapsed window:
    /// `effectiveFundingIndex()` divides by the interval, so shortening it would
    /// inflate funding already earned under the longer one.
    function setFundingParams(uint256 newInterval, uint256 newMaxRateBps) external {
        if (!accessControl.hasRole(accessControl.ADMIN_ROLE(), msg.sender)) revert UnauthorizedCaller();
        if (
            newInterval < PerpConstants.MIN_FUNDING_INTERVAL ||
            newInterval > PerpConstants.MAX_FUNDING_INTERVAL ||
            newMaxRateBps == 0 ||
            newMaxRateBps > PerpConstants.MAX_FUNDING_RATE_CEILING_BPS
        ) revert InvalidParameter();

        cumulativeFundingIndex = effectiveFundingIndex();
        lastFundingSettledAt = block.timestamp;

        fundingInterval = newInterval;
        maxFundingRateBps = newMaxRateBps;

        // An existing rate was expressed per the OLD interval and must not carry
        // over unscaled. Clamping it to the new ceiling is the conservative choice;
        // the next settlement recomputes it from the live mark/index gap anyway.
        if (currentFundingRate > int256(newMaxRateBps)) currentFundingRate = int256(newMaxRateBps);
        if (currentFundingRate < -int256(newMaxRateBps)) currentFundingRate = -int256(newMaxRateBps);

        emit FundingParamsUpdated(newInterval, newMaxRateBps);
    }

    /// @notice Adjust the minimum position size.
    /// @dev Bounded so admin cannot price ordinary users out of the market
    /// entirely under the guise of a dust filter.
    function setMinCollateral(uint256 newMin) external {
        if (!accessControl.hasRole(accessControl.ADMIN_ROLE(), msg.sender)) revert UnauthorizedCaller();
        if (newMin == 0 || newMin > MAX_MIN_COLLATERAL) revert InvalidParameter();
        uint256 old = minCollateral;
        minCollateral = newMin;
        emit MinCollateralUpdated(old, newMin);
    }

    function setOracleValueScale(uint256 newScale) external {
        if (!accessControl.hasRole(accessControl.ADMIN_ROLE(), msg.sender)) revert UnauthorizedCaller();
        if (newScale == 0 || newScale > MAX_ORACLE_VALUE_SCALE) revert InvalidParameter();
        uint256 old = oracleValueScale;
        oracleValueScale = newScale;
        emit OracleValueScaleUpdated(old, newScale);
    }

    /// @notice Adjust the capacity surcharge. Zero disables it, restoring pure
    /// rationing.
    function setUtilizationFeeBps(uint256 newBps) external {
        if (!accessControl.hasRole(accessControl.ADMIN_ROLE(), msg.sender)) revert UnauthorizedCaller();
        if (newBps > MAX_UTILIZATION_FEE_BPS) revert InvalidParameter();
        uint256 old = utilizationFeeBps;
        utilizationFeeBps = newBps;
        emit UtilizationFeeUpdated(old, newBps);
    }

    function setSkewReserveBps(uint256 newBps) external {
        if (!accessControl.hasRole(accessControl.ADMIN_ROLE(), msg.sender)) revert UnauthorizedCaller();
        if (newBps > MAX_SKEW_RESERVE_BPS) revert InvalidParameter();
        uint256 old = skewReserveBps;
        skewReserveBps = newBps;
        emit SkewReserveBpsUpdated(old, newBps);
    }

    /// @notice Re-align the vault reservation. Permissionless — anyone may
    /// correct a stale reservation, and it can only move it toward the true
    /// exposure.
    function syncVaultReserve() external nonReentrant returns (uint256 shortfall) {
        return _syncVaultReserve();
    }

    /// @notice Adjust the open-interest skew ceiling. Set to 0 to disable.
    function setMaxSkew(uint256 newMaxSkew) external {
        if (!accessControl.hasRole(accessControl.ADMIN_ROLE(), msg.sender)) revert UnauthorizedCaller();
        uint256 old = maxSkew;
        maxSkew = newMaxSkew;
        emit MaxSkewUpdated(old, newMaxSkew);
    }

    /// @notice Point this market at pooled LP capital.
    /// @dev Settable rather than immutable so an already-deployed market can be
    /// backed. Setting to address(0) removes the backstop.
    function setLiquidityVault(address vault) external {
        if (!accessControl.hasRole(accessControl.ADMIN_ROLE(), msg.sender)) revert UnauthorizedCaller();
        address old = address(liquidityVault);

        // Release from the outgoing vault first. Repointing without doing so
        // strands the reservation there forever: nothing else ever calls
        // `release` for this market, so that capital would back nothing while
        // remaining permanently unwithdrawable by LPs.
        if (old != address(0)) {
            uint256 held = liquidityVault.marketReserved(address(this));
            if (held > 0) {
                try liquidityVault.release(held) {} catch {}
            }
        }

        liquidityVault = BreezeLiquidityVault(vault);
        emit LiquidityVaultUpdated(old, vault);

        if (vault != address(0)) _syncVaultReserve();
    }

    /// @notice Point this market at a shared peril-exposure registry, or clear it.
    /// @dev Setting it can immediately tighten capacity if correlated peers have already
    /// committed capital — which is the correct direction, and the same behaviour
    /// clearing the junior tranche has on the vault side.
    function setPerilRegistry(address registry) external {
        if (!accessControl.hasRole(accessControl.ADMIN_ROLE(), msg.sender)) revert UnauthorizedCaller();
        address old = address(perilRegistry);
        perilRegistry = IPerilExposureRegistry(registry);
        emit PerilRegistryUpdated(old, registry);
    }

    /// @notice Point this market's first-loss fee leg at a reserve.
    /// @dev The market only ever pays IN. Nothing here grants it the ability to
    /// draw, and it must not be added as a drawer on the reserve — a market drawing
    /// tier 1 directly would rebuild the shared-pot contention the reserve exists
    /// to remove.
    function setFirstLossReserve(address reserve) external {
        if (!accessControl.hasRole(accessControl.ADMIN_ROLE(), msg.sender)) revert UnauthorizedCaller();
        address old = address(firstLossReserve);
        firstLossReserve = FirstLossReserve(reserve);
        emit FirstLossReserveUpdated(old, reserve);
    }

    /// @notice What the market currently owes every open position if all closed now.
    ///
    /// @dev Posted collateral alone understates this. A position sitting on
    /// unrealised profit is owed collateral PLUS that profit, and the losing
    /// side's collateral is what funds it — so treating posted collateral as the
    /// whole obligation classifies a live winner's gains as free surplus and
    /// lets them be swept away. Funding makes this concrete: it moves value
    /// between sides without touching the curve, so it does not net out.
    ///
    /// Equity is floored at zero per position: an underwater position is owed
    /// nothing, and its deficit must not offset another position's claim.
    function openPositionObligations() public view returns (uint256 obligations) {
        uint256 count = _openPositions.length();
        for (uint256 i = 0; i < count; i++) {
            uint256 id = _openPositions.at(i);
            Position storage pos = positions[id];
            int256 equity = int256(pos.collateral) + calculateUnrealizedPnl(id);
            if (equity > 0) obligations += uint256(equity);
        }
    }

    /// @notice How many positions are currently open.
    function openPositionCount() external view returns (uint256) {
        return _openPositions.length();
    }

    /// @notice Remaining open-position slots before the market refuses new opens.
    function openPositionSlotsRemaining() external view returns (uint256) {
        uint256 used = _openPositions.length();
        return used >= MAX_OPEN_POSITIONS ? 0 : MAX_OPEN_POSITIONS - used;
    }

    /// @notice ID of the open position at `index`.
    function openPositionAt(uint256 index) external view returns (uint256) {
        return _openPositions.at(index);
    }

    /// @notice Remit collateral held beyond the market's obligations to LPs.
    /// @dev Obligations are the net collateral backing every open position. Any
    /// balance above that is realised trader loss, which belongs to the LPs who
    /// stood as counterparty. Permissionless — it can only move funds that no
    /// open position has a claim on.
    function sweepSurplus() external nonReentrant returns (uint256 surplus) {
        if (address(liquidityVault) == address(0)) return 0;

        uint256 obligations = openPositionObligations();
        uint256 bal = collateralToken.balanceOf(address(this));
        if (bal <= obligations) return 0;

        surplus = bal - obligations;
        collateralToken.forceApprove(address(liquidityVault), surplus);
        liquidityVault.absorbProfit(surplus);
        emit SurplusSwept(surplus);
    }

    function pauseOpens() external onlyPauser {
        _pause();
    }

    function unpauseOpens() external onlyPauser {
        _unpause();
    }

    /// @notice PnL for a position given the collateral its virtual size unwinds to.
    /// @dev `collateralOut` must be quoted against reserves that STILL CONTAIN this
    /// position. Quoting against reserves the position has already been removed from
    /// applies its own price impact a second time.
    /// @notice The funding index in force right now, accrued continuously.
    ///
    /// @dev `cumulativeFundingIndex` only advances when `settleFunding` is called.
    /// This adds the portion of the current rate earned since that call, so the
    /// index is a function of time rather than a step function. A position holding
    /// for one second therefore accrues one second of funding, which is what makes
    /// the settlement sandwich unprofitable by construction.
    ///
    /// Accrual is capped at one interval. Without the cap a rate left unsettled for
    /// a week would keep accruing against a stale mark/index gap that may no longer
    /// exist — funding would be charged on a price relationship nobody had
    /// confirmed. Capping it means an unsettled market simply stops accruing, which
    /// is the safe direction: `settleFunding` is permissionless, so anyone harmed by
    /// the pause can end it.
    function effectiveFundingIndex() public view returns (int256) {
        if (currentFundingRate == 0) return cumulativeFundingIndex;

        uint256 elapsed = block.timestamp - lastFundingSettledAt;
        uint256 interval = fundingInterval;
        if (elapsed > interval) elapsed = interval;

        return cumulativeFundingIndex + (currentFundingRate * int256(elapsed)) / int256(interval);
    }

    /// @notice Funding index movement a position is entitled to.
    /// @dev Exactly the movement since it opened — no skipped interval, no partial
    /// interval granted for free.
    function _fundingIndexDelta(Position storage pos) internal view returns (int256) {
        return effectiveFundingIndex() - pos.entryFundingIndex;
    }

    /// @notice Funding index movement position `positionId` has accrued.
    /// @dev Published so the funding a position is actually earning is checkable
    /// without re-deriving the epoch arithmetic off-chain.
    function accruedFundingIndex(uint256 positionId) external view returns (int256) {
        Position storage pos = positions[positionId];
        if (!pos.isOpen) return 0;
        return _fundingIndexDelta(pos);
    }

    function _pnlFrom(Position storage pos, uint256 collateralOut)
        internal
        view
        returns (int256 totalPnl)
    {
        uint256 notional = pos.collateral * pos.leverage;
        int256 pricePnl = int256(collateralOut) - int256(notional);

        int256 fundingIndexDelta = _fundingIndexDelta(pos);
        int256 fundingBpsImpact = pos.isLong ? -fundingIndexDelta : fundingIndexDelta;
        int256 fundingPnl = (int256(notional) * fundingBpsImpact) / 10000;

        totalPnl = pricePnl + fundingPnl;
    }

    function calculateUnrealizedPnl(uint256 positionId) public view returns (int256 totalPnl) {
        Position storage pos = positions[positionId];
        if (!pos.isOpen) return 0;

        uint256 collateralOut;
        if (pos.isLong) {
            (collateralOut, ) = reserves.quoteCloseLong(pos.virtualSize);
        } else {
            (collateralOut, ) = reserves.quoteCloseShort(pos.virtualSize);
        }

        totalPnl = _pnlFrom(pos, collateralOut);
    }

    function isLiquidatable(uint256 positionId) external view returns (bool) {
        return _isLiquidatable(positionId);
    }

    function _isLiquidatable(uint256 positionId) internal view returns (bool) {
        Position storage pos = positions[positionId];
        if (!pos.isOpen) return false;

        int256 pnl = calculateUnrealizedPnl(positionId);
        int256 equity = int256(pos.collateral) + pnl;

        uint256 notional = pos.collateral * pos.leverage;
        uint256 maintenanceRequired = (notional * PerpConstants.MAINTENANCE_MARGIN_BPS) / 10000;

        return equity < int256(maintenanceRequired);
    }

    function _executeClose(uint256 positionId, Position storage pos, address recipient)
        internal
        returns (int256 totalPnl)
    {
        VirtualAMM.Reserves memory newReserves;
        uint256 collateralOut;

        if (pos.isLong) {
            (collateralOut, newReserves) = reserves.quoteCloseLong(pos.virtualSize);
            totalLongOpenInterest -= pos.collateral;
            totalLongNotional -= pos.collateral * pos.leverage;
        } else {
            (collateralOut, newReserves) = reserves.quoteCloseShort(pos.virtualSize);
            totalShortOpenInterest -= pos.collateral;
            totalShortNotional -= pos.collateral * pos.leverage;
        }

        // Settle against the quote taken while the position was still on the
        // curve, then remove it. Reversing this order double-charges slippage.
        totalPnl = _pnlFrom(pos, collateralOut);
        reserves = newReserves;
        pos.isOpen = false;
        _openPositions.remove(positionId);

        int256 equity = int256(pos.collateral) + totalPnl;
        uint256 rawPayout = equity > 0 ? uint256(equity) : 0;

        // Top up BEFORE paying anything out. The fee legs transfer real tokens,
        // and this market is designed to run a balance below its obligations —
        // that is what the vault backstop is for. Taking fees first meant an
        // ordinary close could revert on the fee transfer while the vault sat on
        // ample capital, leaving a position that could not be closed at all.
        if (rawPayout > 0 && address(liquidityVault) != address(0)) {
            uint256 have = collateralToken.balanceOf(address(this));
            if (rawPayout > have) {
                uint256 need = rawPayout - have;
                // Tolerant: a vault that refuses (e.g. this market has been
                // deauthorised) must degrade the payout, never block the exit.
                try liquidityVault.coverLoss(need) returns (uint256 drawn) {
                    emit VaultShortfallCovered(need, drawn);
                } catch {}
            }
        }

        uint256 netPayout = rawPayout;
        if (rawPayout > 0) {
            (uint256 feeAmount, , , ) = feeConfig.calculateFeeSplit(rawPayout);

            // Never let fee collection exceed what is actually held. Revenue is
            // subordinate to being able to close a position at all.
            //
            // The clamp used to re-derive the destination shares here with a
            // hardcoded 8000, which silently diverged from `FeeConfig` the moment
            // the split became three-way. Clamping the total and letting
            // `_routeFee` do the division from the live configuration keeps one
            // source of truth for where fees go.
            uint256 forFees = collateralToken.balanceOf(address(this));
            if (feeAmount > forFees) feeAmount = forFees;

            _routeFee(feeAmount, recipient);
            netPayout = rawPayout - feeAmount;
        }

        // Trader profit is synthetic: the vAMM can owe more than the collateral
        // posted in this market. Draw the difference from pooled LP capital
        // rather than silently paying the trader less than they are owed.
        uint256 bal = collateralToken.balanceOf(address(this));
        if (netPayout > bal && address(liquidityVault) != address(0)) {
            uint256 shortfall = netPayout - bal;
            try liquidityVault.coverLoss(shortfall) returns (uint256 covered) {
                emit VaultShortfallCovered(shortfall, covered);
            } catch {}
            bal = collateralToken.balanceOf(address(this));
        }

        // The vault is finite, so a residual clamp remains the last line of
        // defence. It is surfaced as an event rather than passing silently.
        if (netPayout > bal) {
            emit PayoutShortfall(positionId, netPayout, bal);
            netPayout = bal;
        }

        if (netPayout > 0) {
            collateralToken.safeTransfer(recipient, netPayout);
        }

        // Open interest shrank, so some of the locked backing is free again.
        _syncVaultReserve();

        emit PositionClosed(positionId, recipient, totalPnl, netPayout);
    }

    function _executeLiquidation(uint256 positionId, Position storage pos, address liquidator)
        internal
        returns (uint256 reward)
    {
        VirtualAMM.Reserves memory newReserves;
        uint256 collateralOut;
        if (pos.isLong) {
            (collateralOut, newReserves) = reserves.quoteCloseLong(pos.virtualSize);
            totalLongOpenInterest -= pos.collateral;
            totalLongNotional -= pos.collateral * pos.leverage;
        } else {
            (collateralOut, newReserves) = reserves.quoteCloseShort(pos.virtualSize);
            totalShortOpenInterest -= pos.collateral;
            totalShortNotional -= pos.collateral * pos.leverage;
        }

        // Same ordering requirement as _executeClose: quote first, then remove.
        int256 totalPnl = _pnlFrom(pos, collateralOut);
        reserves = newReserves;
        pos.isOpen = false;
        _openPositions.remove(positionId);

        reward = (pos.collateral * PerpConstants.LIQUIDATION_REWARD_BPS) / 10000;
        int256 equity = int256(pos.collateral) + totalPnl;

        uint256 badDebt = 0;
        uint256 coveredDebt = 0;

        if (equity <= 0) {
            badDebt = uint256(-equity);
            uint256 shortfallToCover = badDebt + reward;
            coveredDebt = insuranceFund.coverShortfall(shortfallToCover);

            uint256 availableBal = collateralToken.balanceOf(address(this));
            uint256 liquidatorPayout = reward > availableBal ? availableBal : reward;
            if (liquidatorPayout > 0) {
                collateralToken.safeTransfer(liquidator, liquidatorPayout);
            }
        } else {
            uint256 remainingEquity = uint256(equity);

            // Top up from the vault if the market cannot fund the payout itself.
            // Unlike the bad-debt branch this was previously unclamped, so a thin
            // balance made a liquidatable position impossible to liquidate — the
            // one thing that must never be blockable, since it is what keeps the
            // market solvent.
            uint256 avail = collateralToken.balanceOf(address(this));
            if (remainingEquity > avail && address(liquidityVault) != address(0)) {
                uint256 need = remainingEquity - avail;
                try liquidityVault.coverLoss(need) returns (uint256 drawn) {
                    emit VaultShortfallCovered(need, drawn);
                } catch {}
                avail = collateralToken.balanceOf(address(this));
            }
            if (remainingEquity > avail) remainingEquity = avail;

            uint256 liquidatorPayout = reward > remainingEquity ? remainingEquity : reward;
            uint256 traderPayout = remainingEquity - liquidatorPayout;

            if (liquidatorPayout > 0) {
                collateralToken.safeTransfer(liquidator, liquidatorPayout);
            }
            if (traderPayout > 0) {
                collateralToken.safeTransfer(pos.trader, traderPayout);
            }
        }

        _syncVaultReserve();

        emit PositionLiquidated(positionId, liquidator, reward, badDebt, coveredDebt);
    }
}
