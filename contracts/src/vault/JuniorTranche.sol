// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../access/BreezeAccessControl.sol";
import "./BreezeLiquidityVault.sol";

/// @title JuniorTranche
/// @notice Subordinated underwriting capital. Absorbs protocol loss ahead of the
/// senior pool, and is paid a boosted share of protocol profit for doing so.
///
/// The single-tranche pool that preceded this contract spread every loss evenly
/// across all depositors, which forces one product on everyone: a depositor who
/// wants a low-variance yield and a depositor who wants to be paid for taking the
/// tail had to hold the identical claim. Insurance markets do not work that way —
/// reinsurance, catastrophe bonds and ILS funds all separate the layer that takes
/// first loss from the layer that is protected, and price the two differently.
///
/// The waterfall is: protocol-owned first-loss fund, then this tranche, then the
/// senior pool. Two consequences follow, and both are the point:
///
///   - Senior capital only loses value once this tranche is exhausted, so the
///     senior claim becomes materially safer without any change to reserve
///     sizing. It is a second line of defence for the case where the calibrated
///     coverage ratio turns out to be wrong.
///   - This tranche earns a multiple of its pro-rata share of profit, because
///     the risk it carries is a multiple of its pro-rata share of loss.
///
/// Junior capital also counts toward the protocol's backing capacity, so adding
/// it increases the notional the markets can support rather than merely
/// reshuffling who bears the same risk.
///
/// Exit discipline is deliberately stricter than the senior pool's. First-loss
/// capital that can leave as fast as protected capital is not really first-loss
/// capital: whoever notices trouble first would simply be senior in practice.
/// The default cooldown here is therefore longer than the senior vault's.
contract JuniorTranche is ERC4626, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    BreezeAccessControl public immutable accessControl;

    /// @notice The senior pool this tranche is subordinated to. Only it may draw
    /// loss from, or pay profit into, this contract.
    BreezeLiquidityVault public seniorVault;

    // -----------------------------------------------------------------
    // Profit recognition — mirrors the senior vault
    // -----------------------------------------------------------------

    /// @notice Profit received but not yet recognised as junior LP value.
    /// @dev Same rationale as the senior pool: instant recognition would let a
    /// depositor arrive one block before a profit event, capture it through the
    /// jump in share price, and leave having carried none of the exposure.
    uint256 public lockedProfit;
    uint256 public lastProfitAt;

    /// @notice Absolute time at which `lockedProfit` finishes vesting.
    /// @dev Same rationale as the senior pool: a single start time cannot both keep
    /// the recognised level continuous across an absorb and avoid restarting the
    /// window, so anyone could defer recognition indefinitely with dust absorbs.
    /// An explicit end lets the deadline be a value-weighted blend instead.
    uint256 public unlockEnd;

    uint256 public profitUnlockPeriod = 7 days;
    uint256 public constant MIN_PROFIT_UNLOCK_PERIOD = 1 days;
    uint256 public constant MAX_PROFIT_UNLOCK_PERIOD = 90 days;

    // -----------------------------------------------------------------
    // Withdrawal cooldown
    // -----------------------------------------------------------------

    struct WithdrawalRequest {
        uint256 shares;
        uint256 requestedAt;
        uint256 cooldown;
    }

    mapping(address => WithdrawalRequest) public withdrawalRequests;

    /// @notice Longer than the senior vault's 3 days, by design — see the note on
    /// exit discipline above.
    uint256 public withdrawalCooldown = 7 days;

    uint256 public constant MAX_WITHDRAWAL_COOLDOWN = 30 days;
    uint256 public constant WITHDRAWAL_WINDOW = 2 days;

    // -----------------------------------------------------------------
    // The layer: attachment, exhaustion, and a per-period limit
    // -----------------------------------------------------------------

    /// @notice Loss level at which this layer begins to pay, as bps of total
    /// backing.
    ///
    /// @dev Reported rather than enforced, and the distinction matters enough to
    /// state plainly. In a catastrophe bond the retention below the attachment point
    /// is the sponsor's own capital, contractually present. Here the equivalent is
    /// waterfall tier 1, which is fee-funded and may legitimately be empty. If this
    /// tranche REFUSED to pay below the attachment point, a loss arriving while tier
    /// 1 was thin would land on senior capital — inverting the subordination the
    /// tranche exists to provide and leaving senior strictly worse off than before.
    ///
    /// So the honest form is: this is the size tier 1 is expected to hold
    /// (`FirstLossReserve.targetSize` describes the same boundary from the other
    /// side), and junior pays immediately after tier 1 is exhausted regardless of
    /// where that happens to be. Publishing it is what makes the gap measurable.
    uint256 public attachmentBps = 200; // 2% of backing retained by tier 1

    /// @notice Loss level at which this layer is exhausted, as bps of total backing.
    ///
    /// @dev This one IS enforced, and it is the real parameter. `exhaustionBps -
    /// attachmentBps` is the width of the band this tranche covers, and that width
    /// becomes a hard per-period limit on what it can be asked for. Beyond it, loss
    /// passes to senior.
    ///
    /// Why a limit at all, given junior can never lose more than it holds: without
    /// one, "junior absorbs until empty" means a long series of small losses grinds
    /// the tranche to nothing, so junior's exposure is its entire capital with no
    /// bound in time. That is not a priceable risk, and a layer nobody can price is
    /// a layer nobody funds. Reinsurance solves this with an annual aggregate limit;
    /// this is that.
    ///
    /// Set from the width sweep (`test_calibrate_layer_band_*`): aggressive funding
    /// preset, 3 seeds x 600 actions, junior additive at 100k on 400k senior.
    ///
    ///   exhaustion   band width   senior worst   junior end   absorbed   band bound
    ///     1000bps        8%           0.771        119,871      26,667     2 of 3
    ///     2500bps       23%           0.886         66,412      69,024     0 of 3
    ///     5000bps       48%           0.886         66,412      69,024     0 of 3
    ///    10000bps       98%           0.886         66,412      69,024     0 of 3
    ///
    /// A clean two-sided trade-off, and the naive direction after all: the wider band
    /// leaves senior better off (0.886 vs 0.771) and junior worse off (66k vs 120k of
    /// its 100k start, junior being paid a boosted profit share on top of taking first
    /// loss). The three wide columns are identical because from 2500bps upward the band
    /// no longer binds — junior's ASSETS run out first — so widening it further changes
    /// nothing. That saturation is the sweep confirming it measured the right variable,
    /// and it also means 2500 is the narrowest width that buys senior the full benefit.
    ///
    /// The arm comparison agrees, which is what makes 2500 defensible rather than merely
    /// chosen: at this width additive junior capital left senior at least as well off as
    /// the undifferentiated pool on 5 of 5 seeds, with no senior drawdown at all.
    ///
    /// Two cautions worth more than the table itself:
    ///
    ///   - This ranking is NOT stable across configurations. An earlier run of the same
    ///     sweep, before capacity was priced, put 1000bps ahead on both axes — narrow
    ///     bands protect against many moderate losses and wide bands against one large
    ///     one, so the winner depends on the loss distribution, and adding the capacity
    ///     surcharge changed that distribution enough to flip the order. Anyone re-tuning
    ///     the fee model must re-run this sweep rather than trusting the numbers above.
    ///   - 3 seeds over-reads, and senior worst price is a minimum statistic. That lesson
    ///     was learned calibrating `skewReserveBps`, where a single-seed run put the
    ///     frontier 25pp from where 3 seeds put it. The boundary between 1000 and 2500 is
    ///     unlocated.
    ///
    /// Open: a bounded band raises a pricing question the sweep does not answer, since
    /// junior's exposure is capped below its capital while it is still paid a 2x
    /// multiplier. A per-occurrence limit alongside the aggregate one would let the layer
    /// be narrow against a single event and wide in aggregate, which is the shape that
    /// would satisfy both regimes rather than picking between them.
    uint256 public exhaustionBps = 2500; // junior covers loss from 2% to 25% of backing

    uint256 public constant MAX_EXHAUSTION_BPS = 10000;

    /// @notice How long the aggregate limit applies before it resets.
    uint256 public layerPeriod = 365 days;
    uint256 public constant MIN_LAYER_PERIOD = 30 days;
    uint256 public constant MAX_LAYER_PERIOD = 1095 days;

    /// @notice Total backing snapshotted at the start of the current period.
    ///
    /// @dev Snapshotted rather than read live, because a live basis shrinks as the
    /// layer pays — which shrinks the limit, which is a limit that tightens exactly
    /// when it is being used. Fixing the basis for the period makes the layer's
    /// worst case knowable in advance, which is the only thing that makes it
    /// priceable.
    uint256 public layerBasis;

    /// @notice Loss absorbed so far in the current period.
    uint256 public layerConsumed;

    /// @notice Start of the current period. Zero until the first draw.
    uint256 public layerStart;

    event LayerParamsUpdated(uint256 attachmentBps, uint256 exhaustionBps, uint256 layerPeriod);
    event LayerPeriodRolled(uint256 basis, uint256 startedAt);
    event LayerLimitReached(uint256 requested, uint256 granted, uint256 limit);

    error InvalidLayer();

    event SeniorVaultUpdated(address indexed oldVault, address indexed newVault);
    event LossAbsorbed(uint256 requested, uint256 absorbed);
    event ProfitReceived(uint256 amount);
    event ProfitUnlockPeriodUpdated(uint256 oldPeriod, uint256 newPeriod);
    event WithdrawalRequested(address indexed owner, uint256 executableAt, uint256 shares);
    event WithdrawalCooldownUpdated(uint256 oldPeriod, uint256 newPeriod);

    error UnauthorizedCaller();
    error ZeroAddress();
    error ZeroAmount();
    error InvalidUnlockPeriod();
    error InvalidCooldown();
    error InsufficientAvailableLiquidity();
    error WithdrawalNotRequested();
    error WithdrawalCooldownActive(uint256 executableAt);
    error WithdrawalRequestExpired();
    error WithdrawalExceedsRequest(uint256 requested, uint256 allowed);

    modifier onlyAdmin() {
        if (!accessControl.hasRole(accessControl.ADMIN_ROLE(), msg.sender)) revert UnauthorizedCaller();
        _;
    }

    modifier onlyPauser() {
        if (!accessControl.hasRole(accessControl.PAUSER_ROLE(), msg.sender)) revert UnauthorizedCaller();
        _;
    }

    modifier onlySeniorVault() {
        if (msg.sender != address(seniorVault) || msg.sender == address(0)) revert UnauthorizedCaller();
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

    /// @dev Virtual shares offset, same as the senior pool — makes the
    /// first-depositor share-inflation attack uneconomic.
    function _decimalsOffset() internal pure override returns (uint8) {
        return 6;
    }

    // ---------------------------------------------------------------------
    // Accounting
    // ---------------------------------------------------------------------

    function lockedProfitRemaining() public view returns (uint256) {
        if (lockedProfit == 0 || block.timestamp >= unlockEnd) return 0;
        uint256 span = unlockEnd - lastProfitAt;
        if (span == 0) return 0;
        return (lockedProfit * (unlockEnd - block.timestamp)) / span;
    }

    /// @dev Adds to the locked balance without restarting the clock for profit
    /// already vesting; the deadline becomes a value-weighted blend.
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

    /// @dev Consumes unrecognised profit without extending or restarting the schedule.
    function _burnLockedProfit(uint256 amount) internal {
        uint256 remaining = lockedProfitRemaining();
        uint256 left = remaining > amount ? remaining - amount : 0;

        lockedProfit = left;
        lastProfitAt = block.timestamp;
        if (left == 0) unlockEnd = block.timestamp;
    }

    function totalAssets() public view override returns (uint256) {
        uint256 held = IERC20(asset()).balanceOf(address(this));
        uint256 locked = lockedProfitRemaining();
        return held > locked ? held - locked : 0;
    }

    /// @notice Every token held, recognised or not.
    /// @dev This — not `totalAssets()` — is what the waterfall can actually draw
    /// on, and what the senior vault counts as backing capacity. Unrecognised
    /// profit was collected for exactly this risk.
    function backingAssets() public view returns (uint256) {
        return IERC20(asset()).balanceOf(address(this));
    }

    // ---------------------------------------------------------------------
    // Layer accounting
    // ---------------------------------------------------------------------

    /// @dev Total backing the layer is sized against. Falls back to this tranche's
    /// own balance when no senior vault is configured, so a standalone deployment
    /// still has a well-defined layer rather than a zero one.
    function _currentBacking() internal view returns (uint256) {
        if (address(seniorVault) == address(0)) return backingAssets();
        return seniorVault.totalBackingAssets();
    }

    /// @dev True when the stored period has lapsed, or none has ever started, or the
    /// stored basis is zero.
    ///
    /// The zero-basis case is not a formality. `setLayerParams` snapshots the basis
    /// when it is called, and an admin configuring the band before any LP has
    /// deposited would otherwise fix the basis at zero for a whole period — leaving
    /// the tranche holding capital while its layer limit was zero, so it absorbed
    /// nothing and senior took the first loss. A layer sized against no backing is
    /// not a layer, so it re-snapshots instead.
    function _periodDue() internal view returns (bool) {
        return layerStart == 0 || layerBasis == 0 || block.timestamp >= layerStart + layerPeriod;
    }

    /// @notice Basis the layer is currently sized against.
    /// @dev Reports the basis a draw arriving NOW would use, so the views agree with
    /// what `absorbLoss` would actually do. Before the first draw, and after a period
    /// lapses, that is live backing rather than the stale stored figure.
    function effectiveLayerBasis() public view returns (uint256) {
        return _periodDue() ? _currentBacking() : layerBasis;
    }

    /// @notice Loss absorbed in the period a draw arriving now would fall into.
    function effectiveLayerConsumed() public view returns (uint256) {
        return _periodDue() ? 0 : layerConsumed;
    }

    /// @notice Width of the covered band, in bps of backing.
    function layerWidthBps() public view returns (uint256) {
        return exhaustionBps > attachmentBps ? exhaustionBps - attachmentBps : 0;
    }

    /// @notice Loss level at which this layer starts paying, in assets.
    function attachmentPoint() public view returns (uint256) {
        return (effectiveLayerBasis() * attachmentBps) / 10000;
    }

    /// @notice Loss level at which this layer is exhausted, in assets.
    function exhaustionPoint() public view returns (uint256) {
        return (effectiveLayerBasis() * exhaustionBps) / 10000;
    }

    /// @notice Most this layer can be asked for across the current period.
    function layerLimit() public view returns (uint256) {
        return (effectiveLayerBasis() * layerWidthBps()) / 10000;
    }

    /// @notice Remaining contractual capacity of the layer this period.
    function layerRemaining() public view returns (uint256) {
        uint256 limit = layerLimit();
        uint256 used = effectiveLayerConsumed();
        return limit > used ? limit - used : 0;
    }

    /// @notice What a draw right now could actually obtain.
    /// @dev The binding constraint is whichever is smaller — the layer's remaining
    /// limit, or the assets the tranche holds. Both are real, and reporting only the
    /// limit would overstate what the layer can deliver.
    function absorbableNow() public view returns (uint256) {
        uint256 remaining = layerRemaining();
        uint256 held = backingAssets();
        return remaining < held ? remaining : held;
    }

    /// @notice Assets this tranche may release without breaching the protocol's
    /// utilisation floor.
    ///
    /// @dev Junior capital counts toward backing capacity, so junior LPs are
    /// bound by the same utilisation constraint as senior LPs. Asking the senior
    /// vault for the shared free amount — rather than tracking a second, separate
    /// floor here — is what keeps the two tranches from each withdrawing the same
    /// headroom. Every withdrawal reduces combined backing, so a later caller
    /// sees a correspondingly smaller figure.
    ///
    /// Junior capital in excess of the vault's counted share is added back, and it
    /// has to be. That capital was excluded from `totalBackingAssets`, so the
    /// utilisation floor was never computed against it — clamping it to the shared
    /// headroom would trap junior capital that is holding up no capacity at all.
    /// Releasing it cannot breach the floor by construction: it is not in the figure
    /// the floor constrains.
    function availableLiquidity() public view returns (uint256) {
        uint256 held = totalAssets();
        if (address(seniorVault) == address(0)) return held;
        uint256 free = seniorVault.freeBackingAssets() + seniorVault.juniorUncreditedBacking();
        return free < held ? free : held;
    }

    function maxWithdraw(address owner) public view override returns (uint256) {
        uint256 owed = _convertToAssets(requestedShares(owner), Math.Rounding.Floor);
        uint256 free = availableLiquidity();
        return owed < free ? owed : free;
    }

    function maxRedeem(address owner) public view override returns (uint256) {
        uint256 shares = requestedShares(owner);
        uint256 sharesForFree = _convertToShares(availableLiquidity(), Math.Rounding.Floor);
        return shares < sharesForFree ? shares : sharesForFree;
    }

    function maxDeposit(address) public view override returns (uint256) {
        return paused() ? 0 : type(uint256).max;
    }

    function maxMint(address) public view override returns (uint256) {
        return paused() ? 0 : type(uint256).max;
    }

    // ---------------------------------------------------------------------
    // Withdrawal cooldown — mirrors the senior vault's semantics
    // ---------------------------------------------------------------------

    function requestWithdrawal() external {
        uint256 held = balanceOf(msg.sender);
        withdrawalRequests[msg.sender] =
            WithdrawalRequest({shares: held, requestedAt: block.timestamp, cooldown: withdrawalCooldown});
        emit WithdrawalRequested(msg.sender, block.timestamp + withdrawalCooldown, held);
    }

    function requestedShares(address owner) public view returns (uint256) {
        if (withdrawalCooldown == 0) return balanceOf(owner);
        if (!canWithdraw(owner)) return 0;
        uint256 claim = withdrawalRequests[owner].shares;
        uint256 held = balanceOf(owner);
        return claim < held ? claim : held;
    }

    function canWithdraw(address owner) public view returns (bool) {
        if (withdrawalCooldown == 0) return true;
        WithdrawalRequest memory r = withdrawalRequests[owner];
        if (r.requestedAt == 0 || r.shares == 0) return false;
        uint256 opensAt = r.requestedAt + r.cooldown;
        return block.timestamp >= opensAt && block.timestamp <= opensAt + WITHDRAWAL_WINDOW;
    }

    /// @dev An outbound share transfer cancels the sender's request, so a served
    /// cooldown cannot be handed to a fresh address and a pre-warmed address
    /// cannot redeem shares it never waited for.
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            delete withdrawalRequests[from];
        }
        super._update(from, to, value);
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

    /// @dev Deliberately not `whenNotPaused`: pausing must never trap LP capital.
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

            withdrawalRequests[owner].shares = r.shares - shares;
        }

        super._withdraw(caller, receiver, owner, assets, shares);
    }

    // ---------------------------------------------------------------------
    // Waterfall interface — senior vault only
    // ---------------------------------------------------------------------

    /// @notice Hand up to `amount` to the senior vault to absorb a loss.
    /// @dev A partial fill is normal and is not an error: this tranche is a
    /// finite layer, and exhausting it is exactly the condition under which the
    /// senior pool begins to take loss. Two things can cause one — running out of
    /// assets, and running out of LAYER. The second is the point of the band: once
    /// the period's aggregate limit is consumed, further loss belongs to senior even
    /// though junior still holds capital.
    function absorbLoss(uint256 amount) external onlySeniorVault nonReentrant returns (uint256 covered) {
        if (amount == 0) revert ZeroAmount();

        _rollLayerIfDue();

        uint256 limit = layerLimit();
        uint256 remaining = limit > layerConsumed ? limit - layerConsumed : 0;
        uint256 want = amount > remaining ? remaining : amount;

        uint256 held = IERC20(asset()).balanceOf(address(this));
        covered = want > held ? held : want;

        if (want < amount) emit LayerLimitReached(amount, want, limit);

        layerConsumed += covered;

        if (covered > 0) {
            // Unrecognised profit is consumed before junior principal, for the
            // same reason the senior pool does it: the premium collected for a
            // risk should pay that risk's claim before anyone's capital does.
            _burnLockedProfit(covered);

            IERC20(asset()).safeTransfer(address(seniorVault), covered);
        }
        emit LossAbsorbed(amount, covered);
    }

    /// @notice Roll the layer period if it is due, absorbing nothing.
    ///
    /// @dev Permissionless, and called by the senior vault before any tier of a
    /// claim moves money. It exists so the basis is snapshotted against backing as it
    /// stood BEFORE tier 1 paid into the vault — otherwise the snapshot would include
    /// capital already in flight and the layer would be marginally wider than
    /// `layerLimit()` reported an instant earlier. Anyone may call it; the only
    /// effect is to start a period that was due anyway.
    function pokeLayer() external {
        _rollLayerIfDue();
    }

    /// @notice Pull this tranche's boosted share of profit from the senior vault.
    function receiveProfit(uint256 amount) external onlySeniorVault nonReentrant {
        if (amount == 0) revert ZeroAmount();

        // Locked before the transfer, so a reentrant redeem can never observe the
        // incoming tokens as already-recognised junior value.
        _addLockedProfit(amount);

        IERC20(asset()).safeTransferFrom(msg.sender, address(this), amount);

        emit ProfitReceived(amount);
    }

    /// @dev Start a fresh period, re-snapshotting the basis from current backing.
    ///
    /// Called lazily from `absorbLoss` rather than on a schedule, because nothing
    /// else needs the state to have advanced and a keeper that stops running must not
    /// be able to freeze the layer at a stale basis. The views agree with it via
    /// `_periodDue`, so an external reader never sees a limit the next draw will not
    /// honour.
    function _rollLayerIfDue() internal {
        if (!_periodDue()) return;
        layerBasis = _currentBacking();
        layerConsumed = 0;
        layerStart = block.timestamp;
        emit LayerPeriodRolled(layerBasis, block.timestamp);
    }

    // ---------------------------------------------------------------------
    // Administration
    // ---------------------------------------------------------------------

    /// @notice Set the covered band and the period its aggregate limit applies over.
    ///
    /// @dev Set together, because they are only meaningful together: the limit is a
    /// width per period, so changing one alone silently rescales the layer's real
    /// exposure. Committing the current period first would be wrong here — unlike a
    /// funding rate, a band change is a change to what junior LPs have agreed to
    /// cover, so the new band applies from a fresh period with a fresh basis rather
    /// than retroactively reinterpreting loss already absorbed under the old one.
    function setLayerParams(uint256 newAttachmentBps, uint256 newExhaustionBps, uint256 newPeriod)
        external
        onlyAdmin
    {
        if (
            newExhaustionBps <= newAttachmentBps ||
            newExhaustionBps > MAX_EXHAUSTION_BPS ||
            newPeriod < MIN_LAYER_PERIOD ||
            newPeriod > MAX_LAYER_PERIOD
        ) revert InvalidLayer();

        attachmentBps = newAttachmentBps;
        exhaustionBps = newExhaustionBps;
        layerPeriod = newPeriod;

        layerBasis = _currentBacking();
        layerConsumed = 0;
        layerStart = block.timestamp;

        emit LayerParamsUpdated(newAttachmentBps, newExhaustionBps, newPeriod);
        emit LayerPeriodRolled(layerBasis, block.timestamp);
    }

    function setSeniorVault(address vault) external onlyAdmin {
        address old = address(seniorVault);
        seniorVault = BreezeLiquidityVault(vault);
        emit SeniorVaultUpdated(old, vault);
    }

    function setProfitUnlockPeriod(uint256 newPeriod) external onlyAdmin {
        if (newPeriod < MIN_PROFIT_UNLOCK_PERIOD || newPeriod > MAX_PROFIT_UNLOCK_PERIOD) {
            revert InvalidUnlockPeriod();
        }
        lockedProfit = lockedProfitRemaining();
        lastProfitAt = block.timestamp;
        unlockEnd = block.timestamp + newPeriod;

        uint256 old = profitUnlockPeriod;
        profitUnlockPeriod = newPeriod;
        emit ProfitUnlockPeriodUpdated(old, newPeriod);
    }

    function setWithdrawalCooldown(uint256 newPeriod) external onlyAdmin {
        if (newPeriod > MAX_WITHDRAWAL_COOLDOWN) revert InvalidCooldown();
        uint256 old = withdrawalCooldown;
        withdrawalCooldown = newPeriod;
        emit WithdrawalCooldownUpdated(old, newPeriod);
    }

    function pauseDeposits() external onlyPauser {
        _pause();
    }

    function unpauseDeposits() external onlyPauser {
        _unpause();
    }
}
