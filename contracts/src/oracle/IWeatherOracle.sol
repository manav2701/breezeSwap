// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IWeatherOracle
 * @notice Standard interface for weather data oracles on Flare (Mock, FTSO, and FDC adapters).
 */
interface IWeatherOracle {
    /// @dev `value` is fixed point with 6 decimals — mm of rain * 1e6, °C * 1e6 —
    /// matching `ORACLE_DECIMALS` in the SDK, which the indexer and the
    /// climatology seeder also follow. This previously documented `* 100`, which
    /// no component actually produced; `BreezePerpMarket.oracleValueScale` exists
    /// to reconcile a differently-scaled adapter, and it defaults to 1e6.
    ///
    /// Consumers that compare a reading against another reading (a strike
    /// threshold, say) are scale-invariant. Consumers that compare it against a
    /// 1e18-scaled price are NOT, and must normalise.
    struct Reading {
        int256 value;       // Fixed point value, 6 decimals (see note above)
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
