// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../access/BreezeAccessControl.sol";
import "./IFirstLossFund.sol";

/// @title FirstLossReserve
/// @notice Protocol-owned capital dedicated to tier 1 of the loss waterfall, and
/// to nothing else.
///
/// This contract exists because of a measured defect rather than a design
/// preference. Tier 1 was originally `InsuranceFund`, which is also drawn
/// directly by `BreezePerpMarket._executeLiquidation` to clear bad debt. One pot,
/// two unrelated consumers, no ordering between them — so the vault could drain
/// the reserve liquidation depends on. The consequence is not symmetric:
///
///   - Liquidation failing to cover bad debt leaves the deficit on the market's
///     own balance, which reduces what is available to pay OTHER closing
///     positions, which produces more vault draws, which land on senior capital.
///     It compounds.
///   - Senior capital absorbing a loss is exactly what the senior tier is for. It
///     does not compound.
///
/// So liquidation must have the prior claim, and the way to give it one is not a
/// reserved floor with an arbitrary constant — it is to stop the two uses sharing
/// a balance at all. `WaterfallMonteCarloTest` measured the shared-pot version
/// leaving senior LPs worse off on 2 of 5 seeds than having no tier 1 whatsoever.
///
/// Funding comes from `FeeConfig.firstLossShareBps`, a fee leg of its own, so the
/// tier is self-replenishing from ordinary volume in the same way the liquidation
/// backstop is. It is protocol-owned: there are no shares, no depositors, and
/// nothing here is withdrawable by anyone. Capital that arrives is committed to
/// absorbing loss.
contract FirstLossReserve is IFirstLossFund {
    using SafeERC20 for IERC20;

    IERC20 public immutable collateralToken;
    BreezeAccessControl public immutable accessControl;

    /// @notice Addresses permitted to draw on this reserve.
    ///
    /// @dev Deliberately NOT the markets. Only the liquidity vault should appear
    /// here: the whole point of a separate reserve is that the waterfall's tier 1
    /// and the liquidation backstop no longer share a balance, and authorising a
    /// market to draw directly would rebuild the contention this contract exists
    /// to remove.
    mapping(address => bool) public authorizedDrawers;

    /// @notice Size this reserve aims to hold, for reporting.
    ///
    /// @dev The attachment point of the junior layer is the loss level at which
    /// junior capital starts paying, which is where protocol-retained capital is
    /// expected to run out — so this target and `JuniorTranche.attachmentPoint()`
    /// describe the same boundary from either side. It is a target and not a
    /// requirement: the reserve fills from fee flow over time, so demanding it be
    /// full would be a constraint the protocol could not satisfy on day one, and
    /// enforcing it would block trading rather than fund the reserve any faster.
    /// Reporting the gap is the honest form.
    uint256 public targetSize;

    /// @notice Lifetime totals, so the tier's contribution is auditable rather
    /// than inferred from a balance that moves in both directions.
    uint256 public totalDeposited;
    uint256 public totalCovered;

    event Deposited(address indexed from, uint256 amount);
    event ShortfallCovered(address indexed drawer, uint256 requested, uint256 covered);
    event DrawerAuthorizationSet(address indexed drawer, bool authorized);
    event TargetSizeUpdated(uint256 oldTarget, uint256 newTarget);

    error UnauthorizedCaller();
    error ZeroAddress();
    error ZeroAmount();

    modifier onlyAdmin() {
        if (!accessControl.hasRole(accessControl.ADMIN_ROLE(), msg.sender)) {
            revert UnauthorizedCaller();
        }
        _;
    }

    constructor(address _collateralToken, address _accessControl) {
        if (_collateralToken == address(0) || _accessControl == address(0)) revert ZeroAddress();
        collateralToken = IERC20(_collateralToken);
        accessControl = BreezeAccessControl(_accessControl);
    }

    /// @notice Fund the reserve. Permissionless — markets route their fee leg here,
    /// and anyone else topping it up is a gift to LP safety.
    function deposit(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);
        totalDeposited += amount;
        emit Deposited(msg.sender, amount);
    }

    /// @notice Pay up to `amount` to an authorised drawer.
    /// @dev Returns what was actually paid. A partial fill is normal: this is a
    /// finite layer, and exhausting it is the condition under which the next tier
    /// begins to take loss. It never reverts on being empty, because it sits on the
    /// close and liquidation paths where a revert would trap a position.
    function coverShortfall(uint256 amount) external returns (uint256 coveredAmount) {
        if (!authorizedDrawers[msg.sender]) revert UnauthorizedCaller();

        uint256 available = collateralToken.balanceOf(address(this));
        coveredAmount = amount > available ? available : amount;

        if (coveredAmount > 0) {
            totalCovered += coveredAmount;
            collateralToken.safeTransfer(msg.sender, coveredAmount);
        }
        emit ShortfallCovered(msg.sender, amount, coveredAmount);
    }

    function balance() external view returns (uint256) {
        return collateralToken.balanceOf(address(this));
    }

    /// @notice How full the reserve is against its target, in bps. 10000 when no
    /// target is set, since an unset target cannot be unmet.
    function fundingRatioBps() external view returns (uint256) {
        if (targetSize == 0) return 10000;
        uint256 held = collateralToken.balanceOf(address(this));
        if (held >= targetSize) return 10000;
        return (held * 10000) / targetSize;
    }

    function isFunded() external view returns (bool) {
        return collateralToken.balanceOf(address(this)) >= targetSize;
    }

    // ---------------------------------------------------------------------
    // Administration
    // ---------------------------------------------------------------------

    function setDrawerAuthorization(address drawer, bool authorized) external onlyAdmin {
        if (drawer == address(0)) revert ZeroAddress();
        authorizedDrawers[drawer] = authorized;
        emit DrawerAuthorizationSet(drawer, authorized);
    }

    function setTargetSize(uint256 newTarget) external onlyAdmin {
        uint256 old = targetSize;
        targetSize = newTarget;
        emit TargetSizeUpdated(old, newTarget);
    }
}
