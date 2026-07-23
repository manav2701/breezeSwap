// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IWeatherOracle
 * @notice Standard interface for weather data oracles on Flare (Mock, FTSO, and FDC adapters).
 */
interface IWeatherOracle {
    struct Reading {
        int256 value;       // Fixed point value (e.g. mm of rain * 100 or temp in °C * 100)
        uint256 timestamp;  // Block or measurement timestamp
        bool isValid;       // Indicates if data is valid and initialized
    }

    /**
     * @notice Fetch weather reading for a given region at or after a timestamp.
     */
    function getReading(bytes32 regionId, uint256 atOrAfterTimestamp) external view returns (Reading memory);

    /**
     * @notice Check whether data for a region is stale relative to maxAge seconds.
     */
    function isStale(bytes32 regionId, uint256 maxAge) external view returns (bool);
}
