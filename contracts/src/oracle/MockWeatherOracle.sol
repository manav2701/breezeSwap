// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IWeatherOracle.sol";

/**
 * @title MockWeatherOracle
 * @notice Mock implementation of IWeatherOracle for testing and seeding with real Open-Meteo data.
 */
contract MockWeatherOracle is IWeatherOracle, Ownable {
    // regionId => timestamp => Reading
    mapping(bytes32 => mapping(uint256 => Reading)) public readings;
    
    // regionId => latest reading timestamp
    mapping(bytes32 => uint256) public latestTimestamp;

    event ReadingSet(bytes32 indexed regionId, uint256 indexed timestamp, int256 value);

    error Unauthorized();

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Set weather reading for a specific region and timestamp. Restricted to owner/admin.
     */
    function setReading(bytes32 regionId, uint256 timestamp, int256 value) external onlyOwner {
        readings[regionId][timestamp] = Reading({
            value: value,
            timestamp: timestamp,
            isValid: true
        });

        if (timestamp > latestTimestamp[regionId]) {
            latestTimestamp[regionId] = timestamp;
        }

        emit ReadingSet(regionId, timestamp, value);
    }

    /**
     * @notice Returns weather reading at or after a target timestamp.
     */
    function getReading(bytes32 regionId, uint256 atOrAfterTimestamp) external view override returns (Reading memory) {
        // First check exact timestamp
        Reading memory exact = readings[regionId][atOrAfterTimestamp];
        if (exact.isValid) {
            return exact;
        }

        // If exact timestamp not present, check latest timestamp if it satisfies constraint
        uint256 latestTime = latestTimestamp[regionId];
        if (latestTime >= atOrAfterTimestamp) {
            Reading memory latest = readings[regionId][latestTime];
            if (latest.isValid) {
                return latest;
            }
        }

        return Reading({ value: 0, timestamp: 0, isValid: false });
    }

    /**
     * @notice Checks if data for region is older than maxAge seconds.
     */
    function isStale(bytes32 regionId, uint256 maxAge) external view override returns (bool) {
        uint256 latestTime = latestTimestamp[regionId];
        if (latestTime == 0) {
            return true; // No data ever set
        }

        if (block.timestamp < latestTime) {
            return false;
        }

        return (block.timestamp - latestTime) > maxAge;
    }
}
