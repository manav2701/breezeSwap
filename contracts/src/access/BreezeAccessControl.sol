// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title BreezeAccessControl
/// @notice Single shared role registry for the entire BreezeSwap protocol.
/// All other contracts check roles against this contract rather than
/// maintaining independent permission systems, so role state can never
/// drift out of sync between contracts.
contract BreezeAccessControl is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MARKET_CREATOR_ROLE = keccak256("MARKET_CREATOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant ORACLE_UPDATER_ROLE = keccak256("ORACLE_UPDATER_ROLE");

    constructor(address initialAdmin) {
        // DEFAULT_ADMIN_ROLE (from OZ AccessControl) can grant/revoke all other roles
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(ADMIN_ROLE, initialAdmin);
        _grantRole(PAUSER_ROLE, initialAdmin);
        _grantRole(ORACLE_UPDATER_ROLE, initialAdmin);
        // Note: MARKET_CREATOR_ROLE is intentionally NOT granted here for Classic
        // Markets since that factory stays permissionless. It IS required for the vAMM PerpFactory in Phase 8.
    }
}
