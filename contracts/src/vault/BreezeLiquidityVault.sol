// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../access/BreezeAccessControl.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./IFirstLossFund.sol";
import "./IJuniorTranche.sol";

/// @title BreezeLiquidityVault
/// @notice Pooled underwriting capital that stands as counterparty to BreezeSwap
/// perpetual markets.
///
/// A vAMM produces synthetic exposure, not liquidity: when traders are net
/// profitable there is no natural counterparty whose losses fund those profits.
/// Without a backstop a market pays winners out of the collateral posted by
/// traders who have not yet closed, and the last trader out absorbs the
/// shortfall. This vault is that backstop — depositors collectively take the
/// other side of trader flow, earning trading fees and trader losses, and
/// funding trader profits.
///
/// Shares follow ERC4626. Depositors are exposed to real loss: `coverLoss`
/// reduces `totalAssets` and therefore the value of every share.
///
/// This is the SENIOR tranche of a three-tier loss waterfall. A loss is drawn in
/// order from the protocol-owned first-loss fund, then from `JuniorTranche`, and
/// only then from the depositors here. Both upper tiers are optional: with
/// neither configured the waterfall collapses to the single-tranche behaviour
/// this contract had originally, and nothing about the LP interface changes.
///
/// The waterfall pays for itself out of `absorbProfit`: the junior tranche takes
/// a multiple of its pro-rata share of profit, because it takes the whole of the
/// first loss.
///

/// Pause discipline matches the rest of the protocol — deposits can be paused,
/// withdrawals and redemptions never can. Pausing must not trap LP funds.
contract BreezeLiquidityVault is ERC4626, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    BreezeAccessControl public immutable accessControl;

    /// @notice Markets permitted to reserve capital and draw on the pool.
    mapping(address => bool) public authorizedMarkets;

    /// @notice Capital each market has locked against its open interest.
    mapping(address => uint256) public marketReserved;

    /// @notice Sum of `marketReserved`. Never withdrawable by LPs.
    uint256 public totalReserved;

    /// @notice Share of the pool that may be reserved in aggregate. Capital above
    /// this line stays withdrawable so LPs are never fully locked in.
    uint256 public maxUtilizationBps = 8000; // 80%

    /// @notice Ceiling on utilisation. Immutable — no admin action can raise the
    /// portion of the pool that markets are able to lock.
    uint256 public constant MAX_UTILIZATION_CEILING_BPS = 9000; // 90%

    /// @notice Share of the pool a single market may reserve, limiting the damage
    /// one mispriced market can do to the whole pool.
    uint256 public constant MAX_SINGLE_MARKET_BPS = 5000; // 50%

    /// @notice Authorised markets, enumerable so the concentration cap can be
    /// enforced continuously rather than only at the moment of reserving.
    ///
    /// @dev The cap used to be a point-in-time check inside `reserve()`, so a market
    /// could pass it and then drift above 50% as LPs withdrew or the pool took a
    /// loss — the concentration limit held on the way in and nowhere else.
    /// Enforcing it from the withdrawal side needs the LARGEST market reservation,
    /// which needs enumeration.
    ///
    /// Iterating an unbounded set is exactly the gas trap that made
    /// `openPositionObligations` a liveness failure, so this set is deliberately
    /// governance-sized: entries are added only by admin and hard-capped, which
    /// bounds the loop by something users cannot inflate.
    EnumerableSet.AddressSet private _marketList;

    uint256 public constant MAX_AUTHORIZED_MARKETS = 32;

    // -----------------------------------------------------------------
    // Loss waterfall
    // -----------------------------------------------------------------

    /// @notice Tier 1. Protocol-owned capital, drawn before any LP capital.
    /// @dev Fee-funded and therefore self-replenishing, which is what makes it
    /// the right first tier: routine losses are absorbed by protocol revenue
    /// rather than by depositors, and the tier refills from ordinary volume
    /// without anyone having to top it up.
    IFirstLossFund public firstLossFund;

    /// @notice Tier 2. Subordinated LP capital, drawn before senior depositors.
    IJuniorTranche public juniorTranche;

    /// @notice Multiple of its pro-rata share that the junior tranche earns.
    ///
    /// @dev At 10000 junior earns exactly pro-rata, which would be indefensible:
    /// it carries strictly more risk than senior for identical reward, so nobody
    /// rational would ever subscribe to it. Hence the hard floor at pro-rata and
    /// a default well above it. The ceiling exists because the boost is paid out
    /// of senior's share — an unbounded multiplier would let admin starve the
    /// senior tranche of yield entirely while leaving its risk in place.
    uint256 public juniorYieldMultiplierBps = 20000; // 2x pro-rata
    uint256 public constant MIN_JUNIOR_YIELD_MULTIPLIER_BPS = 10000; // never sub-pro-rata
    uint256 public constant MAX_JUNIOR_YIELD_MULTIPLIER_BPS = 30000; // 3x pro-rata

    /// @notice Largest share of counted backing that junior capital may make up.
    ///
    /// @dev This is the enforcement half of "junior capital must be ADDITIVE", and
    /// the simulation is what argued for it. `WaterfallMonteCarloTest` holds total
    /// LP capital constant and carves the junior tranche OUT of it; measured that
    /// way the waterfall beat the flat pool on 4 of 5 seeds but lost on the mean,
    /// because a senior tranche 25% thinner moves 25% further per unit of residual
    /// loss once junior is exhausted. Tranching redistributes loss, it does not
    /// reduce it — so junior capital replacing senior capital is the wrong shape,
    /// and only junior capital ADDED to senior capital is an improvement.
    ///
    /// A vault cannot control where a depositor's money came from, so "additive"
    /// cannot be enforced at the point of deposit. What it can control is whether
    /// junior capital BUYS CAPACITY. Counting junior toward backing only up to this
    /// share means a protocol that funds itself by moving senior LPs into the junior
    /// tranche gets no extra capacity for it, while one that attracts genuinely new
    /// subordinated capital does — which is the incentive the right way round.
    ///
    /// The cap is also the operational form of a target junior ratio: it is the
    /// ratio past which junior capital stops enlarging the protocol. Excess junior
    /// capital is not rejected and not trapped — it still absorbs loss, and it stays
    /// withdrawable via `juniorUncreditedBacking`, because capital that backs no
    /// capacity cannot be holding any up.
    uint256 public maxJuniorBackingShareBps = 3333; // junior may be up to 1/3 of backing

    /// @dev Ceiling of 5000 is not arbitrary: at parity the two tranches are the
    /// same size, and a "subordinated" layer as large as the layer it protects is
    /// not a first-loss position — it is a coin flip over which half absorbs first.
    uint256 public constant MAX_JUNIOR_BACKING_SHARE_BPS = 5000;

    // -----------------------------------------------------------------
    // Premium recognition
    // -----------------------------------------------------------------

    /// @notice Premium received but not yet recognised as LP profit.
    ///
    /// Premium is earned across the life of the risk it pays for, not at the
    /// moment it arrives. Crediting it instantly would let an LP deposit one
    /// block before a sale, capture the whole premium through the jump in share
    /// price, and withdraw the next block having carried none of the exposure —
    /// leaving the remaining term of that risk with everyone else. Recognising
    /// it linearly ties the reward to time actually spent underwriting.
    uint256 public lockedProfit;

    uint256 public lastProfitAt;

    /// @notice Absolute time at which `lockedProfit` finishes vesting.
    ///
    /// @dev Recognition used to be `lockedProfit * (period - elapsed) / period` with
    /// `lastProfitAt` reset to now on every absorb. That restarted the full period
    /// for profit already part-way through vesting, so anyone could defer LP profit
    /// recognition indefinitely by repeatedly triggering trivial absorbs.
    ///
    /// Storing an explicit end time fixes it, and the reason it has to be a separate
    /// slot is worth recording. With a single start time the level at the moment of
    /// an absorb is `lockedProfit * (period - elapsed) / period`; to keep that
    /// continuous while adding new profit, the window must be exactly `period` long,
    /// which is the reset. Tracking the end independently lets the span be a
    /// VALUE-WEIGHTED blend of the outgoing deadline and the new one: the level
    /// stays continuous, and a dust absorb barely moves the deadline because it
    /// carries almost no weight.
    uint256 public unlockEnd;

    /// @notice Period over which received premium is recognised.
    uint256 public profitUnlockPeriod = 7 days;

    /// @notice Bounds on the unlock period. A period of zero would restore the
    /// instant-recognition exploit, so it can never be set.
    uint256 public constant MIN_PROFIT_UNLOCK_PERIOD = 1 days;
    uint256 public constant MAX_PROFIT_UNLOCK_PERIOD = 90 days;

    // -----------------------------------------------------------------
    // Withdrawal cooldown
    // -----------------------------------------------------------------

    /// @notice When each LP asked to withdraw. Zero means no live request.
    ///
    /// Losses hit share price the moment a claim settles, while profit is
    /// recognised gradually — and the oracle reading that triggers a claim is
    /// public before anyone calls `settlePolicy`. Without a delay an LP can read
    /// the trigger and exit ahead of settlement, leaving the loss with whoever
    /// stayed. Underwriting would then be optional for the well-informed and
    /// compulsory for everyone else.
    ///
    /// This delays exit; it never blocks it. The cooldown is bounded by
    /// `MAX_WITHDRAWAL_COOLDOWN`.
    ///
    /// The request records the share balance held AT REQUEST TIME, and any
    /// outbound share transfer cancels it. Keying the wait to the owner alone is
    /// not enough: shares are ordinary ERC20 and `requestWithdrawal` costs
    /// nothing, so anyone could pre-warm an empty address, be handed shares
    /// later, and redeem instantly. Binding the request to a snapshot of shares
    /// already held makes a pre-warmed address worth nothing, because it had no
    /// shares to claim for.
    struct WithdrawalRequest {
        uint256 shares;
        uint256 requestedAt;
        /// Cooldown in force when the request was made. Snapshotting it stops a
        /// later admin increase from retroactively freezing an LP who has
        /// already begun waiting.
        uint256 cooldown;
    }

    mapping(address => WithdrawalRequest) public withdrawalRequests;

    uint256 public withdrawalCooldown = 3 days;

    uint256 public constant MAX_WITHDRAWAL_COOLDOWN = 14 days;

    /// @notice How long a matured request stays usable before it must be renewed.
    ///
    /// @dev Without an expiry a request never lapses, so every LP would simply
    /// request once on deposit and hold a permanent standing exit — which is
    /// exactly the freedom the cooldown exists to remove. The window has to be
    /// long enough to be practical and short enough that an LP cannot be sitting
    /// on a ready exit when news breaks.
    uint256 public constant WITHDRAWAL_WINDOW = 2 days;

    event WithdrawalRequested(address indexed owner, uint256 executableAt, uint256 shares);
    event WithdrawalCooldownUpdated(uint256 oldPeriod, uint256 newPeriod);

    error WithdrawalNotRequested();
    error WithdrawalCooldownActive(uint256 executableAt);
    error WithdrawalRequestExpired();
    error WithdrawalExceedsRequest(uint256 requested, uint256 allowed);
    error InvalidCooldown();

    event ProfitUnlockPeriodUpdated(uint256 oldPeriod, uint256 newPeriod);
    event MarketAuthorizationSet(address indexed market, bool authorized);
    event Reserved(address indexed market, uint256 amount, uint256 totalReserved);
    event Released(address indexed market, uint256 amount, uint256 totalReserved);
    event LossCovered(address indexed market, uint256 requested, uint256 covered);
    event ProfitAbsorbed(address indexed market, uint256 amount);
    event MaxUtilizationUpdated(uint256 oldBps, uint256 newBps);

    /// @notice Per-tier breakdown of how a loss was absorbed. The primary audit
    /// trail for the waterfall — without it, "senior lost nothing" is unverifiable
    /// from outside the contract.
    event LossWaterfall(
        address indexed market,
        uint256 requested,
        uint256 fromFirstLossFund,
        uint256 fromJunior,
        uint256 fromSenior
    );
    event ProfitSplit(uint256 total, uint256 toJunior, uint256 toSenior);
    event FirstLossFundUpdated(address indexed oldFund, address indexed newFund);
    event JuniorTrancheUpdated(address indexed oldTranche, address indexed newTranche);
    event JuniorYieldMultiplierUpdated(uint256 oldBps, uint256 newBps);
    event MaxJuniorBackingShareUpdated(uint256 oldBps, uint256 newBps);

    error UnauthorizedCaller();
    error ZeroAddress();
    error ZeroAmount();
    error ExceedsUtilizationCap();
    error ExceedsSingleMarketCap();
    error ReleaseExceedsReserved();
    error InsufficientAvailableLiquidity();
    error InvalidUtilization();
    error InvalidUnlockPeriod();
    error InvalidYieldMultiplier();
    error InvalidJuniorBackingShare();
    error TooManyMarkets(uint256 cap);

    modifier onlyAdmin() {
        if (!accessControl.hasRole(accessControl.ADMIN_ROLE(), msg.sender)) revert UnauthorizedCaller();
        _;
    }

    modifier onlyPauser() {
        if (!accessControl.hasRole(accessControl.PAUSER_ROLE(), msg.sender)) revert UnauthorizedCaller();
        _;
    }

    modifier onlyAuthorizedMarket() {
        if (!authorizedMarkets[msg.sender]) revert UnauthorizedCaller();
        _;
    }

    constructor(IERC20 asset_, address _accessControl, string memory name_, string memory symbol_)
        ERC20(name_, symbol_)
        ERC4626(asset_)
    {
        if (_accessControl == address(0) || address(asset_) == address(0)) revert ZeroAddress();
        accessControl = BreezeAccessControl(_accessControl);
        lastProfitAt = block.timestamp;
        unlockEnd = block.timestamp;
    }

    function setProfitUnlockPeriod(uint256 newPeriod) external onlyAdmin {
        if (newPeriod < MIN_PROFIT_UNLOCK_PERIOD || newPeriod > MAX_PROFIT_UNLOCK_PERIOD) {
            revert InvalidUnlockPeriod();
        }
        // Settle the current schedule before changing its length, so in-flight
        // premium is not re-vested under the new period. Unlike an absorb, an
        // explicit admin reconfiguration does restart the window — that is the
        // point of the call.
        lockedProfit = lockedProfitRemaining();
        lastProfitAt = block.timestamp;
        unlockEnd = block.timestamp + newPeriod;

        uint256 old = profitUnlockPeriod;
        profitUnlockPeriod = newPeriod;
        emit ProfitUnlockPeriodUpdated(old, newPeriod);
    }

    /// @dev Virtual shares offset. Makes the first-depositor share-inflation attack
    /// uneconomic by keeping the initial exchange rate anchored.
    function _decimalsOffset() internal pure override returns (uint8) {
        return 6;
    }

    // ---------------------------------------------------------------------
    // LP accounting
    // ---------------------------------------------------------------------

    /// @notice Premium still awaiting recognition, decaying linearly to zero.
    function lockedProfitRemaining() public view returns (uint256) {
        if (lockedProfit == 0 || block.timestamp >= unlockEnd) return 0;
        uint256 span = unlockEnd - lastProfitAt;
        if (span == 0) return 0;
        return (lockedProfit * (unlockEnd - block.timestamp)) / span;
    }

    /// @dev Add `amount` to the locked balance without restarting the clock for
    /// profit already vesting. The new deadline is the value-weighted average of the
    /// outgoing one and `now + profitUnlockPeriod`, so the recognised level is
    /// continuous across the call while a trivial amount barely shifts the schedule.
    function _addLockedProfit(uint256 amount) internal {
        uint256 remaining = lockedProfitRemaining();
        uint256 endForNew = block.timestamp + profitUnlockPeriod;

        uint256 blendedEnd;
        if (remaining == 0) {
            blendedEnd = endForNew;
        } else {
            uint256 oldEnd = unlockEnd > block.timestamp ? unlockEnd : block.timestamp;
            blendedEnd = (remaining * oldEnd + amount * endForNew) / (remaining + amount);
        }

        lockedProfit = remaining + amount;
        lastProfitAt = block.timestamp;
        unlockEnd = blendedEnd;
    }

    /// @dev Consume up to `amount` of unrecognised profit, leaving the vesting
    /// deadline untouched. A claim must not extend or restart the schedule.
    function _burnLockedProfit(uint256 amount) internal {
        uint256 remaining = lockedProfitRemaining();
        uint256 left = remaining > amount ? remaining - amount : 0;

        lockedProfit = left;
        lastProfitAt = block.timestamp;
        if (left == 0) unlockEnd = block.timestamp;
    }

    /// @dev Unrecognised premium is held by the vault but is not yet LP value, so
    /// it is excluded from the figure shares are priced against.
    function totalAssets() public view override returns (uint256) {
        uint256 held = IERC20(asset()).balanceOf(address(this));
        uint256 locked = lockedProfitRemaining();
        return held > locked ? held - locked : 0;
    }

    /// @notice Smallest pool size consistent with the utilisation cap given what
    /// is currently reserved.
    ///
    /// @dev `maxUtilizationBps` was previously enforced only when reserving, so
    /// withdrawals could drain the pool until reserved capital was 100% of it —
    /// erasing exactly the buffer the cap exists to hold. Deriving the withdrawal
    /// limit from the same ratio keeps the constraint true from both directions.
    /// @dev Rounds UP. Flooring leaves the retained amount fractionally too small,
    /// so utilisation lands just above the cap — and at small reserve sizes the
    /// flooring error is not fractional at all. Rounding up keeps the cap a real
    /// bound rather than an approximate one.
    /// @dev Two constraints, and the binding one wins. The aggregate utilisation cap
    /// gives one floor; the per-market concentration cap gives another, because a
    /// market holding 50% of the pool means the pool cannot shrink below twice that
    /// market's reservation without breaching its own limit. Taking only the
    /// aggregate left the concentration cap enforced on the way in and nowhere else.
    function minRequiredAssets() public view returns (uint256) {
        if (totalReserved == 0) return 0;

        uint256 aggregateFloor = Math.ceilDiv(totalReserved * 10000, maxUtilizationBps);
        uint256 concentrationFloor =
            Math.ceilDiv(largestMarketReserved() * 10000, MAX_SINGLE_MARKET_BPS);

        return aggregateFloor > concentrationFloor ? aggregateFloor : concentrationFloor;
    }

    /// @notice The largest reservation held by any single authorised market.
    /// @dev Bounded by `MAX_AUTHORIZED_MARKETS`, which only admin can grow.
    function largestMarketReserved() public view returns (uint256 largest) {
        uint256 count = _marketList.length();
        for (uint256 i = 0; i < count; i++) {
            uint256 held = marketReserved[_marketList.at(i)];
            if (held > largest) largest = held;
        }
    }

    /// @notice Number of authorised markets.
    function authorizedMarketCount() external view returns (uint256) {
        return _marketList.length();
    }

    /// @notice Loss-absorbing capital held in the junior tranche, if configured.
    function juniorBackingAssets() public view returns (uint256) {
        if (address(juniorTranche) == address(0)) return 0;
        return juniorTranche.backingAssets();
    }

    /// @notice Junior capital that counts toward backing capacity.
    ///
    /// @dev Capped at `maxJuniorBackingShareBps` of the counted total. Solving
    /// `c <= share * (s + c)` for the credited amount `c` given senior assets `s`
    /// gives `c <= s * share / (10000 - share)`, which is the form used here — the
    /// naive `share * juniorAssets` would compare junior against itself.
    function juniorBackingCredited() public view returns (uint256) {
        uint256 j = juniorBackingAssets();
        if (j == 0) return 0;

        // Denominator is never zero: the share is capped at 5000.
        uint256 cap = (totalAssets() * maxJuniorBackingShareBps)
            / (10000 - maxJuniorBackingShareBps);
        return j < cap ? j : cap;
    }

    /// @notice Junior capital in excess of what counts toward capacity.
    ///
    /// @dev Withdrawable on top of the shared free amount, and it has to be. This
    /// capital unlocks no capacity by construction, so it cannot be holding any up,
    /// and clamping it to the shared headroom would trap junior capital that the
    /// utilisation floor was never computed against. It does still absorb loss while
    /// it is here — over-subscribed junior capital protects senior without enlarging
    /// the protocol, which is the correct treatment of capital the reserve model has
    /// not been sized to rely on.
    function juniorUncreditedBacking() public view returns (uint256) {
        return juniorBackingAssets() - juniorBackingCredited();
    }

    /// @notice Junior's actual share of counted backing, in bps.
    function juniorBackingShareBps() public view returns (uint256) {
        uint256 counted = totalBackingAssets();
        if (counted == 0) return 0;
        return (juniorBackingCredited() * 10000) / counted;
    }

    /// @notice All capital standing behind the markets: senior plus credited junior.
    ///
    /// @dev Capacity is measured across both tranches because both genuinely pay
    /// claims. Counting only senior assets would mean adding junior capital made
    /// the protocol safer without making it any larger — the risk would be
    /// resegmented but no additional trade could be accepted. Junior capital is
    /// first in line to pay, so it is the last thing that should be excluded from
    /// what the protocol can support.
    ///
    /// Junior is counted only up to `maxJuniorBackingShareBps` of the total, so
    /// capacity tracks senior depth rather than being manufactured by shifting
    /// capital between the tranches. See `juniorBackingCredited`.
    function totalBackingAssets() public view returns (uint256) {
        return totalAssets() + juniorBackingCredited();
    }

    /// @notice Combined backing above the utilisation floor.
    /// @dev Shared by both tranches. Junior queries this before releasing capital,
    /// so neither tranche can withdraw headroom the other is relying on: every
    /// withdrawal reduces combined backing, so a later caller sees less.
    function freeBackingAssets() public view returns (uint256) {
        uint256 combined = totalBackingAssets();
        uint256 floorAssets = minRequiredAssets();
        return combined > floorAssets ? combined - floorAssets : 0;
    }

    /// @notice Smallest senior balance consistent with the utilisation floor, once
    /// the knock-on effect of senior assets on credited junior capital is taken
    /// into account.
    ///
    /// @dev This is subtler than it first looks, and getting it wrong opened a hole
    /// in the utilisation floor that `NightmareScenariosTest.test_S2` caught.
    ///
    /// Credited junior capital is `min(j, s * k)` where `k = share / (10000 - share)`,
    /// so once junior is oversubscribed the credited amount is a FUNCTION OF SENIOR
    /// ASSETS. A senior withdrawal of W therefore removes W of senior backing *and*
    /// up to `W * k` of credited junior backing. Sizing senior's exit off
    /// `freeBackingAssets()` — which is what the code did — let a bank run drain
    /// counted backing by 1.5x the headroom that existed, straight through the floor.
    ///
    /// Solving for the senior floor `sMin` such that `sMin + min(j, sMin * k) >= f`
    /// gives two candidates, one per regime, and the larger is correct in both:
    ///
    ///   junior inside its share at sMin:  sMin = f - j
    ///   junior capped by sMin:            sMin = f * (10000 - share) / 10000
    ///
    /// At the boundary between the regimes the two coincide, so taking the maximum is
    /// exact rather than merely conservative.
    function minRequiredSeniorAssets() public view returns (uint256) {
        uint256 f = minRequiredAssets();
        if (f == 0) return 0;

        uint256 j = juniorBackingAssets();
        uint256 candidateUncapped = f > j ? f - j : 0;
        uint256 candidateCapped =
            Math.ceilDiv(f * (10000 - maxJuniorBackingShareBps), 10000);

        return candidateUncapped > candidateCapped ? candidateUncapped : candidateCapped;
    }

    /// @notice Assets withdrawable without breaching the utilisation cap.
    /// @dev Clamped to this tranche's own assets: shared headroom does not let
    /// senior LPs withdraw junior tokens.
    function availableLiquidity() public view returns (uint256) {
        uint256 senior = totalAssets();
        uint256 floorAssets = minRequiredSeniorAssets();
        return senior > floorAssets ? senior - floorAssets : 0;
    }

    /// @notice Assets a market may still reserve before hitting the utilisation cap.
    function reservableLiquidity() public view returns (uint256) {
        uint256 cap = (totalBackingAssets() * maxUtilizationBps) / 10000;
        return cap > totalReserved ? cap - totalReserved : 0;
    }

    /// @notice What `market` specifically may still reserve, respecting both the
    /// pool-wide utilisation cap and its own concentration limit.
    /// @dev Callers that size a reservation dynamically need the binding limit,
    /// not just the pool-wide one, or they will request an amount that reverts.
    function reservableByMarket(address market) public view returns (uint256) {
        uint256 poolRoom = reservableLiquidity();
        uint256 marketCap = (totalBackingAssets() * MAX_SINGLE_MARKET_BPS) / 10000;
        uint256 held = marketReserved[market];
        uint256 marketRoom = marketCap > held ? marketCap - held : 0;
        return poolRoom < marketRoom ? poolRoom : marketRoom;
    }

    /// @dev Reserved capital is not withdrawable, so an LP's withdrawable amount is
    /// their share value clamped to what the pool has free.
    ///
    /// Both limits are derived from primitives rather than from each other:
    /// the base `maxWithdraw` is implemented in terms of `maxRedeem`, so having
    /// either override call the other would recurse infinitely.
    function maxWithdraw(address owner) public view override returns (uint256) {
        // Bounded by the shares the matured request actually covers, not by the
        // whole balance — shares acquired after the request were never waited for.
        uint256 owed = _convertToAssets(requestedShares(owner), Math.Rounding.Floor);
        uint256 free = availableLiquidity();
        return owed < free ? owed : free;
    }

    function maxRedeem(address owner) public view override returns (uint256) {
        uint256 shares = requestedShares(owner);
        uint256 sharesForFree = _convertToShares(availableLiquidity(), Math.Rounding.Floor);
        return shares < sharesForFree ? shares : sharesForFree;
    }

    /// @dev Deposits are pausable; withdrawals deliberately are not.
    function maxDeposit(address) public view override returns (uint256) {
        return paused() ? 0 : type(uint256).max;
    }

    function maxMint(address) public view override returns (uint256) {
        return paused() ? 0 : type(uint256).max;
    }

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares)
        internal
        override
        whenNotPaused
        nonReentrant
    {
        if (assets == 0) revert ZeroAmount();
        super._deposit(caller, receiver, assets, shares);
    }

    /// @notice Start the cooldown before withdrawing.
    /// @dev Never pausable — an LP must always be able to begin exiting.
    /// Snapshots the caller's current share balance; only that many shares can
    /// be redeemed under this request.
    function requestWithdrawal() external {
        uint256 held = balanceOf(msg.sender);
        withdrawalRequests[msg.sender] =
            WithdrawalRequest({shares: held, requestedAt: block.timestamp, cooldown: withdrawalCooldown});
        emit WithdrawalRequested(msg.sender, block.timestamp + withdrawalCooldown, held);
    }

    /// @notice Shares `owner` may currently redeem under a matured request.
    function requestedShares(address owner) public view returns (uint256) {
        if (withdrawalCooldown == 0) return balanceOf(owner);
        if (!canWithdraw(owner)) return 0;
        uint256 claim = withdrawalRequests[owner].shares;
        uint256 held = balanceOf(owner);
        return claim < held ? claim : held;
    }

    /// @notice Whether `owner` has served the cooldown and is inside the window.
    function canWithdraw(address owner) public view returns (bool) {
        if (withdrawalCooldown == 0) return true;
        WithdrawalRequest memory r = withdrawalRequests[owner];
        if (r.requestedAt == 0 || r.shares == 0) return false;
        uint256 opensAt = r.requestedAt + r.cooldown;
        return block.timestamp >= opensAt && block.timestamp <= opensAt + WITHDRAWAL_WINDOW;
    }

    /// @dev Cancels a pending request when shares leave the owner.
    ///
    /// Without this, an LP could serve the cooldown, hand the shares to a fresh
    /// address, and the claim would survive; or a warmed address could receive
    /// shares it never waited for. Burns are exempt because `_withdraw` consumes
    /// the request before burning.
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            delete withdrawalRequests[from];
        }
        super._update(from, to, value);
    }

    /// @dev Intentionally NOT `whenNotPaused`: pausing must never trap LP capital.
    /// The cooldown is checked against `owner`, not `caller`, so an approved
    /// spender cannot be used to sidestep the owner's waiting period.
    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares)
        internal
        override
        nonReentrant
    {
        if (assets > availableLiquidity()) revert InsufficientAvailableLiquidity();

        if (withdrawalCooldown != 0) {
            WithdrawalRequest memory r = withdrawalRequests[owner];
            if (r.requestedAt == 0 || r.shares == 0) revert WithdrawalNotRequested();
            uint256 opensAt = r.requestedAt + r.cooldown;
            if (block.timestamp < opensAt) revert WithdrawalCooldownActive(opensAt);
            if (block.timestamp > opensAt + WITHDRAWAL_WINDOW) revert WithdrawalRequestExpired();
            if (shares > r.shares) revert WithdrawalExceedsRequest(shares, r.shares);

            // Draw down the claim rather than clearing it, so a partial exit does
            // not force a fresh wait for the remainder.
            withdrawalRequests[owner].shares = r.shares - shares;
        }

        super._withdraw(caller, receiver, owner, assets, shares);
    }

    function setWithdrawalCooldown(uint256 newPeriod) external onlyAdmin {
        if (newPeriod > MAX_WITHDRAWAL_COOLDOWN) revert InvalidCooldown();
        uint256 old = withdrawalCooldown;
        withdrawalCooldown = newPeriod;
        emit WithdrawalCooldownUpdated(old, newPeriod);
    }

    // ---------------------------------------------------------------------
    // Market interface
    // ---------------------------------------------------------------------

    /// @notice Lock capital against a market's open interest so LPs cannot withdraw
    /// the funds that back live trader positions.
    function reserve(uint256 amount) external onlyAuthorizedMarket nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (amount > reservableLiquidity()) revert ExceedsUtilizationCap();

        uint256 newMarketReserved = marketReserved[msg.sender] + amount;
        if (newMarketReserved > (totalBackingAssets() * MAX_SINGLE_MARKET_BPS) / 10000) {
            revert ExceedsSingleMarketCap();
        }

        marketReserved[msg.sender] = newMarketReserved;
        totalReserved += amount;
        emit Reserved(msg.sender, amount, totalReserved);
    }

    /// @notice Unlock capital when a market's open interest shrinks.
    function release(uint256 amount) external onlyAuthorizedMarket {
        if (amount == 0) revert ZeroAmount();
        if (amount > marketReserved[msg.sender]) revert ReleaseExceedsReserved();

        marketReserved[msg.sender] -= amount;
        totalReserved -= amount;
        emit Released(msg.sender, amount, totalReserved);
    }

    /// @notice Pay a market to fund trader profit it cannot cover itself.
    /// @dev Draws on the whole pool, reserved capital included — backing live
    /// positions is exactly what reserved capital is for. Returns the amount
    /// actually paid, which is capped by pool assets; callers must handle a
    /// partial fill rather than assuming the full request.
    function coverLoss(uint256 amount)
        external
        onlyAuthorizedMarket
        nonReentrant
        returns (uint256 covered)
    {
        if (amount == 0) revert ZeroAmount();

        // Fix the junior layer's basis against backing as it stands NOW, before any
        // tier has moved money. Tier 1 pays INTO this vault, so a basis snapshotted
        // after that draw would include capital in flight and the layer would come
        // out wider than `layerLimit()` reported an instant earlier. Tolerant, like
        // every other call out of this function.
        if (address(juniorTranche) != address(0)) {
            try juniorTranche.pokeLayer() {} catch {}
        }

        // Tiers 1 and 2 pull capital INTO this contract, so by the time the
        // senior tier is measured the balance already includes whatever they
        // supplied. That is what makes the ordering real rather than cosmetic:
        // senior `totalAssets` falls only by the residual those tiers could not
        // absorb.
        uint256 fromFund = _drawFirstLossFund(amount);
        uint256 remaining = amount - fromFund;

        uint256 fromJunior = 0;
        if (remaining > 0 && address(juniorTranche) != address(0)) {
            // Tolerant: a junior tranche that reverts must degrade to
            // senior-funded cover, never block a trader's exit.
            try juniorTranche.absorbLoss(remaining) returns (uint256 drawn) {
                fromJunior = drawn > remaining ? remaining : drawn;
            } catch {}
            remaining -= fromJunior;
        }

        // Claims are paid from everything the vault holds, including premium not
        // yet recognised — that premium was collected for precisely this risk.
        uint256 held = IERC20(asset()).balanceOf(address(this));
        covered = amount > held ? held : amount;

        uint256 fromSenior = covered > fromFund + fromJunior ? covered - fromFund - fromJunior : 0;

        if (covered > 0) {
            // Burn unrecognised premium first: a claim consumes the premium that
            // paid for it before it eats into LP principal. Sized on the senior
            // share only — premium must not be written off against a loss the
            // upper tiers already paid.
            if (fromSenior > 0) _burnLockedProfit(fromSenior);

            IERC20(asset()).safeTransfer(msg.sender, covered);
        }
        emit LossCovered(msg.sender, amount, covered);
        emit LossWaterfall(msg.sender, amount, fromFund, fromJunior, fromSenior);
    }

    /// @dev Tier 1 of the waterfall. Tolerant of failure for the same reason every
    /// other vault-to-market call is: this sits on the close and liquidation
    /// paths, and a misconfigured or de-authorised reserve must not make positions
    /// impossible to exit.
    function _drawFirstLossFund(uint256 amount) internal returns (uint256 drawn) {
        if (address(firstLossFund) == address(0)) return 0;
        try firstLossFund.coverShortfall(amount) returns (uint256 paid) {
            drawn = paid > amount ? amount : paid;
        } catch {}
    }

    /// @notice The junior tranche's share of `amount`.
    ///
    /// @dev Split by WEIGHTED capital: junior's capital counts at the multiplier,
    /// senior's at par, and each tranche takes its weight's fraction of the whole.
    ///
    /// The obvious formulation — take junior's pro-rata share, then multiply it —
    /// is wrong, and wrong in a way that only shows up once the junior tranche
    /// grows. At a 2x multiplier a junior tranche holding half the capital claims
    /// 2 x 50% = 100% of profit, so senior yield hits exactly zero while senior
    /// risk stays where it was. Every senior LP then leaves, and the protection
    /// the tranche was built to provide has nothing left to protect. Weighting
    /// cannot do that: the denominator grows with the numerator, so junior's share
    /// approaches but never reaches the whole.
    ///
    /// The property that matters survives intact, and in fact becomes exact —
    /// junior earns `juniorYieldMultiplierBps / 10000` times senior PER UNIT OF
    /// CAPITAL at every possible ratio of the two, because the per-unit rate is
    /// weight over total weight and the capital term cancels. That is the number
    /// an LP choosing between the tranches actually needs.
    ///
    /// Degenerates correctly at the edges: nothing to a tranche with no capital,
    /// everything to junior if senior is empty.
    ///
    /// Weighted on junior's FULL balance, not the portion credited toward capacity.
    /// Yield here is payment for risk borne, and uncredited junior capital bears the
    /// same first-loss risk as credited junior capital — `absorbLoss` draws on the
    /// whole balance. Paying it only for the credited part would take the risk and
    /// withhold the compensation.
    function juniorProfitShare(uint256 amount) public view returns (uint256) {
        uint256 j = juniorBackingAssets();
        if (j == 0 || amount == 0) return 0;

        uint256 juniorWeight = j * juniorYieldMultiplierBps;
        uint256 seniorWeight = totalAssets() * 10000;
        uint256 totalWeight = juniorWeight + seniorWeight;
        if (totalWeight == 0) return 0;

        return (amount * juniorWeight) / totalWeight;
    }

    /// @notice Take in premium or trader losses as LP profit. The market must
    /// have approved this vault for `amount` beforehand.
    /// @dev Recognised linearly over `profitUnlockPeriod` rather than instantly,
    /// and split with the junior tranche in return for its first-loss position.
    function absorbProfit(uint256 amount) external onlyAuthorizedMarket nonReentrant {
        if (amount == 0) revert ZeroAmount();

        // Measured before the transfer, so the incoming amount does not inflate
        // the senior side of the ratio it is being split by.
        uint256 juniorCut = juniorProfitShare(amount);

        // State before the transfer. If the asset hands control to a third party
        // mid-transfer, `totalAssets()` must not already reflect the incoming
        // tokens while `lockedProfit` still excludes them — that window prices
        // shares as though the premium were recognised and lets a reentrant
        // redeem exit at an inflated rate.
        //
        // The whole amount is locked, including the junior slice, and the slice is
        // deducted again once it has actually left. Locking only the senior slice
        // would leave the junior slice looking like recognised senior value for
        // the duration of the transfer — the same inflated-rate window, reached a
        // different way.
        _addLockedProfit(amount);

        IERC20(asset()).safeTransferFrom(msg.sender, address(this), amount);

        if (juniorCut > 0) {
            IERC20(asset()).forceApprove(address(juniorTranche), juniorCut);
            juniorTranche.receiveProfit(juniorCut);
            // Clear any unused allowance rather than trusting the callee to have
            // spent it exactly.
            IERC20(asset()).forceApprove(address(juniorTranche), 0);

            // The junior slice never becomes senior value. Removing it through the
            // burn helper keeps the blended deadline intact — deducting the notional
            // directly would leave the schedule describing a larger amount than is
            // actually locked.
            _burnLockedProfit(juniorCut);
        }

        emit ProfitAbsorbed(msg.sender, amount);
        emit ProfitSplit(amount, juniorCut, amount - juniorCut);
    }

    // ---------------------------------------------------------------------
    // Administration
    // ---------------------------------------------------------------------

    function setMarketAuthorization(address market, bool authorized) external onlyAdmin {
        if (market == address(0)) revert ZeroAddress();
        authorizedMarkets[market] = authorized;

        if (authorized) {
            // Bounded so the concentration-cap loop can never be made expensive.
            if (_marketList.length() >= MAX_AUTHORIZED_MARKETS && !_marketList.contains(market)) {
                revert TooManyMarkets(MAX_AUTHORIZED_MARKETS);
            }
            _marketList.add(market);
        } else {
            // A de-authorised market may still hold a reservation, since `release`
            // is market-only. It stops constraining the concentration floor but is
            // still covered by the aggregate one, and repointing the market's vault
            // releases it.
            _marketList.remove(market);
        }

        emit MarketAuthorizationSet(market, authorized);
    }

    function setMaxUtilizationBps(uint256 newBps) external onlyAdmin {
        if (newBps == 0 || newBps > MAX_UTILIZATION_CEILING_BPS) revert InvalidUtilization();
        uint256 old = maxUtilizationBps;
        maxUtilizationBps = newBps;
        emit MaxUtilizationUpdated(old, newBps);
    }

    /// @notice Set or clear tier 1 of the waterfall. Zero disables the tier.
    function setFirstLossFund(address fund) external onlyAdmin {
        address old = address(firstLossFund);
        firstLossFund = IFirstLossFund(fund);
        emit FirstLossFundUpdated(old, fund);
    }

    /// @notice Set or clear tier 2 of the waterfall. Zero disables the tier.
    /// @dev Clearing it removes junior capital from `totalBackingAssets`, which
    /// tightens capacity and can put the pool above its utilisation cap until
    /// markets re-sync. That is the correct direction — capacity should not
    /// survive the capital that justified it — but it means the setter can leave
    /// the pool temporarily unable to accept new risk.
    function setJuniorTranche(address tranche) external onlyAdmin {
        address old = address(juniorTranche);
        juniorTranche = IJuniorTranche(tranche);
        emit JuniorTrancheUpdated(old, tranche);
    }

    /// @notice Adjust how much of the counted backing junior capital may make up.
    /// @dev Lowering it shrinks capacity immediately, which is the correct direction
    /// — capacity should not outlive the justification for it — but it can leave the
    /// pool above its utilisation cap until markets re-sync, exactly as clearing the
    /// junior tranche can.
    function setMaxJuniorBackingShareBps(uint256 newBps) external onlyAdmin {
        if (newBps == 0 || newBps > MAX_JUNIOR_BACKING_SHARE_BPS) {
            revert InvalidJuniorBackingShare();
        }
        uint256 old = maxJuniorBackingShareBps;
        maxJuniorBackingShareBps = newBps;
        emit MaxJuniorBackingShareUpdated(old, newBps);
    }

    function setJuniorYieldMultiplierBps(uint256 newBps) external onlyAdmin {
        if (newBps < MIN_JUNIOR_YIELD_MULTIPLIER_BPS || newBps > MAX_JUNIOR_YIELD_MULTIPLIER_BPS) {
            revert InvalidYieldMultiplier();
        }
        uint256 old = juniorYieldMultiplierBps;
        juniorYieldMultiplierBps = newBps;
        emit JuniorYieldMultiplierUpdated(old, newBps);
    }

    function pauseDeposits() external onlyPauser {
        _pause();
    }

    function unpauseDeposits() external onlyPauser {
        _unpause();
    }
}
