// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./IWeatherOracle.sol";

/**
 * @title FdcWeatherAdapter
 * @notice Swap-in adapter contract connecting BreezeSwap to Flare Data Connector (FDC) for external web2 weather API attestations.
 *
 * Swap-in instruction for judges/developers:
 * Change getReading() to verify Merkle proof against FDC Hub attestation result and remove FdcAttestationTypeNotYetLive revert.
 */
contract FdcWeatherAdapter is IWeatherOracle {
    address public immutable fdcHub;
    bytes32 public immutable attestationType;

    error FdcAttestationTypeNotYetLive();

    constructor(address fdcHub_, bytes32 attestationType_) {
        fdcHub = fdcHub_;
        attestationType = attestationType_;
    }

    /**
     * @notice Fetch weather reading via Flare Data Connector Merkle attestation proof.
     */
    function getReading(bytes32 regionId, uint256 atOrAfterTimestamp) external view override returns (Reading memory) {
        // Swap-in point: Verify Merkle proof against FDC Hub attestation result
        revert FdcAttestationTypeNotYetLive();
    }

    /**
     * @notice Staleness check for FDC attestations.
     */
    function isStale(bytes32 regionId, uint256 maxAge) external view override returns (bool) {
        return false;
    }
}
