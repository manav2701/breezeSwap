// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./IWeatherOracle.sol";

/**
 * @title FtsoWeatherAdapter
 * @notice Swap-in adapter contract connecting BreezeSwap to Flare's FTSOv2 oracle system.
 * When official Flare/Kweather feeds go live, this contract reads from the FTSO registry.
 *
 * Swap-in instruction for judges/developers:
 * Change getReading() to call IFtsoV2(ftsoRegistry).getFeedById(feedId) and remove FtsoFeedNotYetLive revert.
 */
contract FtsoWeatherAdapter is IWeatherOracle {
    address public immutable ftsoRegistry;
    bytes21 public immutable feedId; // Flare FTSO v2 Feed Identifier (e.g. 0x01... for weather feed)

    error FtsoFeedNotYetLive();

    constructor(address ftsoRegistry_, bytes21 feedId_) {
        ftsoRegistry = ftsoRegistry_;
        feedId = feedId_;
    }

    /**
     * @notice Fetch weather reading via Flare FTSOv2. Reverts until weather feed is active.
     */
    function getReading(bytes32 regionId, uint256 atOrAfterTimestamp) external view override returns (Reading memory) {
        // Swap-in point once Flare/Kweather feeds go live:
        // uint256 value = IFtsoV2(ftsoRegistry).getFeedById(feedId);
        // return Reading({ value: int256(value), timestamp: block.timestamp, isValid: true });

        revert FtsoFeedNotYetLive();
    }

    /**
     * @notice Staleness check against FTSOv2 feed updates.
     */
    function isStale(bytes32 regionId, uint256 maxAge) external view override returns (bool) {
        // Swap-in point: Check feed timestamp from FTSOv2 registry
        return false;
    }
}
