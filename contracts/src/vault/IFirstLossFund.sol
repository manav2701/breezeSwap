// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IFirstLossFund
/// @notice Protocol-owned capital drawn before any LP capital in the loss
/// waterfall. `InsuranceFund` satisfies this interface.
///
/// @dev Declared as an interface rather than importing `InsuranceFund` directly
/// so the vault does not depend on the perp module, and so the first-loss tier
/// can later be swapped for a differently-funded reserve without touching the
/// vault.
interface IFirstLossFund {
    /// @notice Pay up to `amount` to the caller. Returns what was actually paid,
    /// which may be less than requested.
    function coverShortfall(uint256 amount) external returns (uint256 coveredAmount);

    function balance() external view returns (uint256);
}
