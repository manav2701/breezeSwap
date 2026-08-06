// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../access/BreezeAccessControl.sol";
import "../vault/BreezeLiquidityVault.sol";
import "./IPerilExposureRegistry.sol";

/// @dev The minimum a market must expose to be aggregated. Deliberately narrow so the
/// registry does not acquire a dependency on the whole perp market.
interface IPerpExposureSource {
    function regionId() external view returns (bytes32);
    function requiredVaultReserve() external view returns (uint256);
}

/// @title PerilExposureRegistry
/// @notice Aggregate exposure caps across markets that share a peril.
///
/// This is the control that REPLACED pool isolation, and the reasoning is worth keeping
/// next to the code. Isolation protects unrelated markets from each other's losses.
/// Weather markets are not unrelated: rainfall in Tokyo and rainfall in Osaka can be the
/// same storm system. Isolating them gives an appearance of diversification while the
/// underlying peril is shared — so the binding constraint for a weather book is
/// CORRELATION, not contagion.
///
/// `WeatherPolicyMarket` already had this control, bucketing `perilExposure` by
/// (region, month). Perp markets had nothing equivalent: `maxNotionalCapacity()` bounds
/// each market against the shared backing pool, but two rainfall markets on correlated
/// regions could each fill their own capacity while facing one weather event. The pool
/// looks diversified and holds one large bet.
///
/// **Exposure is PULLED, not pushed.** Markets report nothing; the registry reads
/// `requiredVaultReserve()` from each registered market when asked. Push-based accounting
/// would need every open, close and liquidation to update a mirror of state that already
/// exists, and any missed path leaves the mirror wrong in a way nothing detects — the
/// failure mode that made the skew reservation need its own invariant suite. Pulling
/// cannot desync because there is nothing to sync.
///
/// The loop that makes pulling possible is bounded by `MAX_MARKETS` and only admin can
/// grow it, for exactly the reason `openPositionObligations` had to be bounded: a loop
/// users can inflate is a liveness failure waiting for enough volume.
contract PerilExposureRegistry is IPerilExposureRegistry {
    using EnumerableSet for EnumerableSet.AddressSet;

    BreezeAccessControl public immutable accessControl;

    /// @notice The pool whose capital the caps are expressed against.
    BreezeLiquidityVault public liquidityVault;

    EnumerableSet.AddressSet private _markets;

    /// @dev Governance-sized, and the reason the pull model is affordable.
    uint256 public constant MAX_MARKETS = 32;

    /// @notice Correlation bucket for each region.
    ///
    /// @dev Keyed by region rather than by market address so two markets on the same
    /// region are automatically grouped, and so a market can be replaced without
    /// re-declaring its correlation.
    ///
    /// An unset region maps to `bytes32(0)`, which puts every unconfigured market into
    /// ONE group. That default is deliberate: unknown correlation is treated as full
    /// correlation, so registering a market before declaring its peril tightens the book
    /// rather than loosening it. The opposite default — every unconfigured market its own
    /// group — would mean forgetting a configuration step silently removes the cap.
    mapping(bytes32 => bytes32) public perilGroupOf;

    /// @notice Cap on the capital committed to any one peril group.
    uint256 public maxGroupExposureBps = 4000; // 40% of backing

    uint256 public constant MAX_GROUP_EXPOSURE_CEILING_BPS = 8000;

    /// @notice Cap on the capital committed across every group at once.
    ///
    /// @dev The group cap bounds each bucket but says nothing about their sum, so enough
    /// distinct groups still add up to an unbounded book — the same gap
    /// `WeatherPolicyMarket.maxAggregateExposureBps` closes. Set at the vault's own
    /// utilisation ceiling by default, so this is not the binding constraint until an
    /// admin tightens it.
    uint256 public maxAggregateExposureBps = 8000; // 80% of backing

    event MarketRegistered(address indexed market, bool registered);
    event PerilGroupSet(bytes32 indexed regionId, bytes32 indexed group);
    event LiquidityVaultUpdated(address indexed oldVault, address indexed newVault);
    event ExposureCapsUpdated(uint256 groupBps, uint256 aggregateBps);

    error UnauthorizedCaller();
    error ZeroAddress();
    error TooManyMarkets(uint256 cap);
    error InvalidParameter();

    modifier onlyAdmin() {
        if (!accessControl.hasRole(accessControl.ADMIN_ROLE(), msg.sender)) {
            revert UnauthorizedCaller();
        }
        _;
    }

    constructor(address _accessControl, address _liquidityVault) {
        if (_accessControl == address(0) || _liquidityVault == address(0)) revert ZeroAddress();
        accessControl = BreezeAccessControl(_accessControl);
        liquidityVault = BreezeLiquidityVault(_liquidityVault);
    }

    // ---------------------------------------------------------------------
    // Aggregation
    // ---------------------------------------------------------------------

    /// @notice The correlation bucket a market belongs to.
    /// @dev Reads the market's own `regionId`, so a market cannot be registered under a
    /// group that contradicts the region it actually trades.
    function perilGroupOfMarket(address market) public view returns (bytes32) {
        // The code check is not redundant with `try`. A call to an address with no code
        // SUCCEEDS with empty return data, and Solidity's `catch` does not cover failures
        // decoding a successful call's return value — so `try` alone lets a codeless
        // registry entry revert the whole aggregation and, through it, every open in every
        // registered market.
        if (market.code.length == 0) return bytes32(0);

        try IPerpExposureSource(market).regionId() returns (bytes32 region) {
            return perilGroupOf[region];
        } catch {
            return bytes32(0);
        }
    }

    /// @notice Capital currently committed by every registered market in `group`.
    function groupReserve(bytes32 group) public view returns (uint256 total) {
        uint256 count = _markets.length();
        for (uint256 i = 0; i < count; i++) {
            address m = _markets.at(i);
            if (perilGroupOfMarket(m) != group) continue;
            total += _reserveOf(m);
        }
    }

    /// @notice Capital currently committed across every registered market.
    function aggregateReserve() public view returns (uint256 total) {
        uint256 count = _markets.length();
        for (uint256 i = 0; i < count; i++) {
            total += _reserveOf(_markets.at(i));
        }
    }

    /// @inheritdoc IPerilExposureRegistry
    ///
    /// @dev Excludes `market`'s OWN current commitment from both sums, so the caller can
    /// compare its whole prospective requirement against what comes back. Netting the
    /// market's existing reserve out here rather than expecting the caller to add it back
    /// keeps the caller from having to know how the sums were built.
    function availableGroupReserve(address market) external view returns (uint256) {
        uint256 backing = liquidityVault.totalBackingAssets();
        bytes32 group = perilGroupOfMarket(market);

        uint256 othersInGroup;
        uint256 othersTotal;

        uint256 count = _markets.length();
        for (uint256 i = 0; i < count; i++) {
            address m = _markets.at(i);
            if (m == market) continue;
            uint256 r = _reserveOf(m);
            othersTotal += r;
            if (perilGroupOfMarket(m) == group) othersInGroup += r;
        }

        uint256 groupCap = (backing * maxGroupExposureBps) / 10000;
        uint256 aggregateCap = (backing * maxAggregateExposureBps) / 10000;

        uint256 groupRoom = groupCap > othersInGroup ? groupCap - othersInGroup : 0;
        uint256 aggregateRoom = aggregateCap > othersTotal ? aggregateCap - othersTotal : 0;

        return groupRoom < aggregateRoom ? groupRoom : aggregateRoom;
    }

    /// @dev Tolerant of a market that does not answer. A registry entry pointing at
    /// something that cannot report its reserve must not be able to block every open in
    /// every other market — the same reasoning that makes every vault call on the close
    /// path tolerant. It counts as zero, which is the permissive direction, so the
    /// registry is a cap on declared exposure and not a proof of total exposure.
    function _reserveOf(address market) internal view returns (uint256) {
        if (market.code.length == 0) return 0; // see `perilGroupOfMarket`

        try IPerpExposureSource(market).requiredVaultReserve() returns (uint256 r) {
            return r;
        } catch {
            return 0;
        }
    }

    function registeredMarketCount() external view returns (uint256) {
        return _markets.length();
    }

    function registeredMarketAt(uint256 index) external view returns (address) {
        return _markets.at(index);
    }

    function isRegistered(address market) external view returns (bool) {
        return _markets.contains(market);
    }

    // ---------------------------------------------------------------------
    // Administration
    // ---------------------------------------------------------------------

    function setMarketRegistration(address market, bool registered) external onlyAdmin {
        if (market == address(0)) revert ZeroAddress();

        if (registered) {
            if (_markets.length() >= MAX_MARKETS && !_markets.contains(market)) {
                revert TooManyMarkets(MAX_MARKETS);
            }
            _markets.add(market);
        } else {
            _markets.remove(market);
        }

        emit MarketRegistered(market, registered);
    }

    /// @notice Declare which correlation bucket a region belongs to.
    function setPerilGroup(bytes32 regionId, bytes32 group) external onlyAdmin {
        perilGroupOf[regionId] = group;
        emit PerilGroupSet(regionId, group);
    }

    function setExposureCaps(uint256 groupBps, uint256 aggregateBps) external onlyAdmin {
        if (
            groupBps == 0 ||
            groupBps > MAX_GROUP_EXPOSURE_CEILING_BPS ||
            aggregateBps == 0 ||
            aggregateBps > 10000 ||
            groupBps > aggregateBps
        ) revert InvalidParameter();

        maxGroupExposureBps = groupBps;
        maxAggregateExposureBps = aggregateBps;
        emit ExposureCapsUpdated(groupBps, aggregateBps);
    }

    function setLiquidityVault(address vault) external onlyAdmin {
        if (vault == address(0)) revert ZeroAddress();
        address old = address(liquidityVault);
        liquidityVault = BreezeLiquidityVault(vault);
        emit LiquidityVaultUpdated(old, vault);
    }
}
