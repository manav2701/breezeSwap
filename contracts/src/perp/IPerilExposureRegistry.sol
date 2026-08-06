// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IPerilExposureRegistry
/// @notice Caps the capital committed to a set of CORRELATED weather markets, not just
/// to each one individually.
///
/// @dev The perp market holds only this interface, so it carries no dependency on the
/// registry's own view of the vault or of its peers.
interface IPerilExposureRegistry {
    /// @notice Capital `market` may commit, given what the rest of its peril group has
    /// already committed.
    ///
    /// @dev Denominated in RESERVE CAPITAL rather than notional, deliberately. Notional
    /// is not comparable across markets that run different coverage ratios, whereas
    /// `requiredVaultReserve()` is the capital each market's exposure actually consumes —
    /// the same denominator `WeatherPolicyMarket.maxPerilExposureBps` uses.
    function availableGroupReserve(address market) external view returns (uint256);

    /// @notice The correlation bucket `market` belongs to.
    function perilGroupOfMarket(address market) external view returns (bytes32);
}
