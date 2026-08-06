// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IJuniorTranche
/// @notice Subordinated LP capital: absorbs loss ahead of the senior pool and is
/// paid a boosted share of profit for doing so.
///
/// @dev The senior vault holds only this interface. `JuniorTranche` imports the
/// senior vault (it must ask what backing is free before letting anyone out), so
/// the dependency has to run one way to avoid a circular import.
interface IJuniorTranche {
    /// @notice Loss-absorbing capital held by the tranche, at raw token value.
    /// @dev Includes premium not yet recognised as junior LP value — unrecognised
    /// premium is still real capital and is still available to pay a claim.
    function backingAssets() external view returns (uint256);

    /// @notice Transfer up to `amount` to the calling senior vault to absorb a
    /// loss. Returns what was actually transferred.
    function absorbLoss(uint256 amount) external returns (uint256 covered);

    /// @notice Pull `amount` of profit from the calling senior vault. The caller
    /// must have approved the tranche for `amount` first.
    function receiveProfit(uint256 amount) external;

    /// @notice Snapshot the layer's basis if its period is due, without absorbing
    /// anything.
    ///
    /// @dev The vault calls this at the top of `coverLoss`, before any tier moves
    /// money. Without it the basis would be snapshotted mid-claim, after tier 1 had
    /// already transferred its contribution INTO the vault — so the snapshot would
    /// include capital in flight and the layer would come out slightly wider than
    /// `layerLimit()` reported a moment earlier. The gap is small and only appears on
    /// the first loss of a period, which is precisely what would make it hard to
    /// notice and easy to mistrust the views over.
    function pokeLayer() external;
}
