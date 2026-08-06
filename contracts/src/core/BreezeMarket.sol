// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import "../access/BreezeAccessControl.sol";
import "../oracle/IWeatherOracle.sol";
import "../oracle/StrikeProbabilityOracle.sol";
import "../oracle/CivilDate.sol";
import "../vault/CollateralVault.sol";
import "../settlement/PayoffCalculator.sol";
import "./PositionToken.sol";

/**
 * @title BreezeMarket
 * @notice Individual parametric weather derivative market instance.
 * Retrofitted in Phase 7 to include PAUSER_ROLE-gated emergency pause functionality.
 */
contract BreezeMarket is ReentrancyGuard, Pausable {
    enum WeatherVariable { RAINFALL, TEMPERATURE }
    enum Status { OPEN, SETTLED }

    BreezeAccessControl public immutable accessControl;
    bytes32 public immutable regionId;
    WeatherVariable public immutable weatherVariable;
    int256 public immutable thresholdLow;
    int256 public immutable thresholdHigh;
    uint256 public immutable expiryTimestamp;
    
    IWeatherOracle public immutable oracle;
    IERC20 public immutable collateralToken;
    PositionToken public immutable positionToken;
    CollateralVault public immutable vault;
    PayoffCalculator.PayoffType public immutable payoffType;

    Status public status;
    int256 public finalOracleValue;

    uint256 public totalLongSupply;
    uint256 public totalShortSupply;
    uint256 public totalCollateral;

    uint256 public longPayoutPerToken;
    uint256 public shortPayoutPerToken;

    // -----------------------------------------------------------------
    // Fair odds
    // -----------------------------------------------------------------

    /// @notice Climatology this market's odds are measured against. Optional.
    ///
    /// @dev The defect being addressed: a Classic market's odds are set by whoever happens
    /// to show up. A long's payout is `totalLongPayout / totalLongSupply`, so if both sides
    /// deposit equally the long receives even money — regardless of whether the strike has
    /// historically been breached in 27 of the last 30 years. Nothing in the contract knew
    /// the difference between a coin flip and a near-certainty, and the side that did not
    /// know the climatology lost by construction.
    StrikeProbabilityOracle public immutable pricingOracle;

    /// @notice Whether this market's strike is priced, resolved at construction.
    bool public immutable isPriced;

    /// @notice Historical probability that the LONG side wins, in bps.
    ///
    /// @dev Zero when unpriced. For BINARY the long is paid iff the reading lands at or
    /// above `thresholdLow`, which is exactly the "pays above" strike the climatology
    /// publishes. (The oracle's frequency is a strict `>` and the payoff is `>=`; for a
    /// continuous variable the difference is a measure-zero event and is noted rather than
    /// modelled.)
    uint32 public immutable longWinProbabilityBps;

    /// @notice How far the pool's supply split may sit from fair odds.
    ///
    /// @dev Enforced in the direction that MATTERS ONLY: a mint that moves the split toward
    /// fair odds is always allowed, even from outside the band. The alternative — refusing
    /// on the resulting state alone — would reject the very deposits able to correct an
    /// imbalance and would freeze the market one-way, the same trap the skew and capacity
    /// caps had to avoid.
    uint256 public fairOddsToleranceBps = 3000; // ±30 percentage points of the pool

    uint256 public constant MIN_FAIR_ODDS_TOLERANCE_BPS = 500;

    event FairOddsToleranceUpdated(uint256 oldBps, uint256 newBps);

    error MintWorsensOdds(uint256 resultingLongShareBps, uint256 fairLongShareBps);

    /// @dev Bundled into a struct purely to keep the constructor within the EVM's stack
    /// depth — eleven parameters plus the strike-key expression did not fit. A memory
    /// struct is one slot.
    struct OddsQuery {
        address oracle;
        bytes32 regionId;
        uint8 variable;
        int256 thresholdLow;
        uint256 expiry;
        PayoffCalculator.PayoffType payoffType;
    }

    /// @dev Resolve the fair odds for a market at construction time.
    ///
    /// Returns "unpriced" rather than reverting when no climatology exists. Refusing to
    /// deploy would make listing a new region impossible until the seeder had run, which
    /// is an operational deadlock rather than a safety property — and this factory is
    /// permissionless by design. An unpriced market is possible and is flagged as such
    /// on-chain, which is the part that was missing.
    function _resolveFairOdds(OddsQuery memory q)
        private
        view
        returns (bool priced, uint32 probabilityBps)
    {
        if (q.oracle == address(0)) return (false, 0);
        if (q.payoffType != PayoffCalculator.PayoffType.BINARY) return (false, 0);
        // A negative strike cannot be expressed as the oracle's unsigned threshold.
        if (q.thresholdLow < 0) return (false, 0);

        StrikeProbabilityOracle oracle_ = StrikeProbabilityOracle(q.oracle);
        bytes32 key = oracle_.strikeKey(
            q.regionId,
            q.variable,
            false, // the long is paid ABOVE the strike
            uint256(q.thresholdLow),
            CivilDate.monthOfYear(q.expiry)
        );
        if (!oracle_.isPriced(key)) return (false, 0);

        return (true, oracle_.getStrike(key).probabilityBps);
    }

    event PositionMinted(address indexed user, PositionToken.Side side, uint256 collateralAmount, uint256 tokenId);
    event MarketSettled(int256 oracleValue, uint256 longPayoutPerToken, uint256 shortPayoutPerToken);
    event PositionRedeemed(address indexed user, uint256 tokenId, uint256 amount, uint256 payout);

    error MarketExpired();
    error MarketNotExpired();
    error MarketAlreadySettled();
    error MarketNotSettled();
    error InvalidOracleData();
    error OracleDataStale();
    error ZeroAmount();
    error InvalidParameters();
    error Unauthorized();

    modifier onlyRole(bytes32 role) {
        require(accessControl.hasRole(role, msg.sender), "BreezeSwap: unauthorized");
        _;
    }

    constructor(
        bytes32 regionId_,
        WeatherVariable weatherVariable_,
        int256 thresholdLow_,
        int256 thresholdHigh_,
        uint256 expiryTimestamp_,
        address oracleAddress_,
        address collateralToken_,
        address positionTokenAddress_,
        PayoffCalculator.PayoffType payoffType_,
        address accessControl_,
        address pricingOracle_
    ) {
        if (
            expiryTimestamp_ <= block.timestamp ||
            oracleAddress_ == address(0) ||
            collateralToken_ == address(0) ||
            positionTokenAddress_ == address(0) ||
            accessControl_ == address(0)
        ) {
            revert InvalidParameters();
        }

        pricingOracle = StrikeProbabilityOracle(pricingOracle_);

        // Resolve the fair odds once, at construction, so they cannot move underneath a
        // market that positions have already been minted into.
        //
        // BINARY only, and the restriction is a real limit rather than laziness. A breach
        // PROBABILITY determines the fair split of a binary claim exactly. It does not
        // determine the fair split of a LINEAR or CAPPED payoff, which depends on where
        // inside the range the reading lands — that needs the distribution, not one
        // quantile of it. Pricing those off a breach probability would produce a number
        // that looks authoritative and is wrong, which is worse than declaring them
        // unpriced.
        (bool priced, uint32 probability) = _resolveFairOdds(
            OddsQuery({
                oracle: pricingOracle_,
                regionId: regionId_,
                variable: uint8(weatherVariable_),
                thresholdLow: thresholdLow_,
                expiry: expiryTimestamp_,
                payoffType: payoffType_
            })
        );
        isPriced = priced;
        longWinProbabilityBps = probability;

        regionId = regionId_;
        weatherVariable = weatherVariable_;
        thresholdLow = thresholdLow_;
        thresholdHigh = thresholdHigh_;
        expiryTimestamp = expiryTimestamp_;
        oracle = IWeatherOracle(oracleAddress_);
        collateralToken = IERC20(collateralToken_);
        positionToken = PositionToken(positionTokenAddress_);
        payoffType = payoffType_;
        accessControl = BreezeAccessControl(accessControl_);

        vault = new CollateralVault(collateralToken_, address(this));
        status = Status.OPEN;
    }

    // -----------------------------------------------------------------
    // Fair odds
    // -----------------------------------------------------------------

    /// @notice Share of the pool the LONG side should hold for the odds to be fair.
    ///
    /// @dev A long depositing `d` receives `d / totalLongSupply * totalLongPayout`, and
    /// `totalLongPayout` is the whole pool when the long wins and nothing otherwise. So
    /// the expected value of a unit deposited long is `P * totalCollateral /
    /// totalLongSupply`, and it breaks even exactly when the long side holds `P` of the
    /// pool. That is the number a depositor needs and the contract never published.
    function fairLongShareBps() public view returns (uint256) {
        return longWinProbabilityBps;
    }

    /// @notice Share of the pool the long side actually holds.
    function impliedLongShareBps() public view returns (uint256) {
        if (totalCollateral == 0) return 0;
        return (totalLongSupply * 10000) / totalCollateral;
    }

    /// @notice How far the pool's odds sit from fair, in bps of the pool.
    function oddsGapBps() public view returns (uint256) {
        uint256 implied = impliedLongShareBps();
        uint256 fair = fairLongShareBps();
        return implied > fair ? implied - fair : fair - implied;
    }

    /// @dev Refuse a mint that pushes the pool further from fair odds once it is already
    /// outside the tolerance. Never refuse one that moves it closer, even from far outside
    /// the band — the market must always be repairable, and a rule keyed on the resulting
    /// state alone would reject exactly the deposits able to correct it.
    ///
    /// The first mint into an empty pool is always allowed: a single deposit is 100% of one
    /// side by construction, so there is no split it could have chosen that was fair.
    function _checkFairOdds(PositionToken.Side side, uint256 amount) internal view {
        if (!isPriced) return;

        uint256 newTotal = totalCollateral + amount;
        uint256 newLong =
            side == PositionToken.Side.LONG ? totalLongSupply + amount : totalLongSupply;
        uint256 resulting = (newLong * 10000) / newTotal;
        uint256 fair = fairLongShareBps();

        uint256 newGap = resulting > fair ? resulting - fair : fair - resulting;
        if (newGap <= fairOddsToleranceBps) return;

        if (totalCollateral == 0) return; // nothing to be closer to yet
        if (newGap < oddsGapBps()) return; // moves toward fair

        revert MintWorsensOdds(resulting, fair);
    }

    /// @dev Floored so the band cannot be widened until it permits any odds at all, which
    /// would leave the market priced in name only.
    function setFairOddsToleranceBps(uint256 newBps) external onlyRole(accessControl.ADMIN_ROLE()) {
        if (newBps < MIN_FAIR_ODDS_TOLERANCE_BPS || newBps > 10000) revert InvalidParameters();
        uint256 old = fairOddsToleranceBps;
        fairOddsToleranceBps = newBps;
        emit FairOddsToleranceUpdated(old, newBps);
    }

    /// @notice Pause new position minting on this specific market.
    function pauseMarket() external onlyRole(accessControl.PAUSER_ROLE()) {
        _pause();
    }

    /// @notice Unpause position minting on this market.
    function unpauseMarket() external onlyRole(accessControl.PAUSER_ROLE()) {
        _unpause();
    }

    /**
     * @notice Mint Long or Short position tokens prior to expiry by depositing collateral.
     */
    function mintPosition(PositionToken.Side side, uint256 collateralAmount) external nonReentrant whenNotPaused returns (uint256 tokenId) {
        if (block.timestamp >= expiryTimestamp) revert MarketExpired();
        if (status != Status.OPEN) revert MarketAlreadySettled();
        if (collateralAmount == 0) revert ZeroAmount();

        // Odds are checked BEFORE any collateral moves, so the market never briefly holds
        // a state it is about to reject.
        _checkFairOdds(side, collateralAmount);

        // 1. Pull collateral into market vault
        vault.deposit(msg.sender, collateralAmount);
        totalCollateral += collateralAmount;

        // 2. Track supply
        if (side == PositionToken.Side.LONG) {
            totalLongSupply += collateralAmount;
        } else {
            totalShortSupply += collateralAmount;
        }

        // 3. Mint Position Tokens to caller
        tokenId = positionToken.mint(msg.sender, address(this), side, collateralAmount);

        emit PositionMinted(msg.sender, side, collateralAmount, tokenId);
    }

    // DO NOT add whenNotPaused here — see SECURITY.md "Pause never traps funds"
    /**
     * @notice Permissionlessly settle the market after expiryTimestamp using weather oracle readings.
     */
    function settle() external nonReentrant {
        if (block.timestamp < expiryTimestamp) revert MarketNotExpired();
        if (status == Status.SETTLED) revert MarketAlreadySettled();

        // 1. Fetch oracle reading
        IWeatherOracle.Reading memory reading = oracle.getReading(regionId, expiryTimestamp);
        if (!reading.isValid) revert InvalidOracleData();
        if (oracle.isStale(regionId, 86400)) revert OracleDataStale();

        finalOracleValue = reading.value;

        // 2. Calculate payouts using PayoffCalculator
        uint256 totalNotional = totalCollateral;

        if (totalNotional > 0) {
            (uint256 totalLongPayout, uint256 totalShortPayout) = PayoffCalculator.calculatePayout(
                payoffType,
                finalOracleValue,
                thresholdLow,
                thresholdHigh,
                totalNotional
            );

            if (totalLongSupply > 0) {
                longPayoutPerToken = (totalLongPayout * 1e18) / totalLongSupply;
            }
            if (totalShortSupply > 0) {
                shortPayoutPerToken = (totalShortPayout * 1e18) / totalShortSupply;
            }
        }

        status = Status.SETTLED;
        emit MarketSettled(finalOracleValue, longPayoutPerToken, shortPayoutPerToken);
    }

    // DO NOT add whenNotPaused here — see SECURITY.md "Pause never traps funds"
    /**
     * @notice Redeem position tokens for collateral after settlement.
     */
    function redeem(uint256 tokenId, uint256 amount) external nonReentrant returns (uint256 payout) {
        if (status != Status.SETTLED) revert MarketNotSettled();
        if (amount == 0) revert ZeroAmount();

        PositionToken.Side side = positionToken.sideOf(tokenId);
        if (positionToken.marketOf(tokenId) != address(this)) revert InvalidParameters();

        // 1. Burn tokens first (checks-effects-interactions)
        positionToken.burn(msg.sender, tokenId, amount);

        if (side == PositionToken.Side.LONG) {
            totalLongSupply -= amount;
            payout = (amount * longPayoutPerToken) / 1e18;
        } else {
            totalShortSupply -= amount;
            payout = (amount * shortPayoutPerToken) / 1e18;
        }

        // 2. Last redeemer gets remainder pattern: if all market position tokens are burned,
        // assign remaining vault collateral to the final redeemer to ensure vault drains to 0
        if (totalLongSupply == 0 && totalShortSupply == 0) {
            uint256 remainingVault = vault.totalDeposited();
            if (remainingVault > 0 && remainingVault <= payout + 1e15) {
                payout = remainingVault;
            }
        }

        // 3. Withdraw payout from vault to user
        if (payout > 0) {
            vault.withdraw(msg.sender, payout);
        }

        emit PositionRedeemed(msg.sender, tokenId, amount, payout);
    }
}
