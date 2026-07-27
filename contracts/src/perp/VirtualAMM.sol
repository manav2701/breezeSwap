// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title VirtualAMM
/// @notice Pure constant-product pricing logic for BreezeSwap perpetual markets.
/// Holds no state and no real assets — operates on a Reserves struct passed by the caller.
/// Reserves are synthetic accounting figures used solely for price discovery.
library VirtualAMM {
    struct Reserves {
        uint256 collateralReserve;  // "x" - virtual USD-equivalent reserve
        uint256 weatherReserve;     // "y" - virtual weather-exposure reserve
    }

    error InsufficientLiquidity();
    error InvalidReserves();

    function k(Reserves memory r) internal pure returns (uint256) {
        return r.collateralReserve * r.weatherReserve;
    }

    /// @notice Current mark price = (collateralReserve * 1e18) / weatherReserve
    function markPrice(Reserves memory r) internal pure returns (uint256) {
        if (r.weatherReserve == 0) revert InvalidReserves();
        return (r.collateralReserve * 1e18) / r.weatherReserve;
    }

    /// @notice Quote: how much virtual weather exposure does `collateralIn` buy
    function quoteOpenLong(Reserves memory r, uint256 collateralIn)
        internal pure returns (uint256 exposureOut, Reserves memory newReserves)
    {
        if (r.collateralReserve == 0 || r.weatherReserve == 0) revert InvalidReserves();
        uint256 kVal = k(r);
        uint256 newCollateralReserve = r.collateralReserve + collateralIn;
        uint256 newWeatherReserve = kVal / newCollateralReserve;
        if (newWeatherReserve >= r.weatherReserve) revert InsufficientLiquidity();
        exposureOut = r.weatherReserve - newWeatherReserve;
        newReserves = Reserves(newCollateralReserve, newWeatherReserve);
    }

    /// @notice Opening a short reduces collateralReserve and increases weatherReserve
    function quoteOpenShort(Reserves memory r, uint256 collateralIn)
        internal pure returns (uint256 exposureOut, Reserves memory newReserves)
    {
        if (r.collateralReserve <= collateralIn || r.weatherReserve == 0) revert InsufficientLiquidity();
        uint256 kVal = k(r);
        uint256 newCollateralReserve = r.collateralReserve - collateralIn;
        if (newCollateralReserve == 0) revert InsufficientLiquidity();
        uint256 newWeatherReserve = kVal / newCollateralReserve;
        if (newWeatherReserve <= r.weatherReserve) revert InsufficientLiquidity();
        exposureOut = newWeatherReserve - r.weatherReserve;
        newReserves = Reserves(newCollateralReserve, newWeatherReserve);
    }

    /// @notice Reverses a long position's effect on the curve when closed
    function quoteCloseLong(Reserves memory r, uint256 exposureIn)
        internal pure returns (uint256 collateralOut, Reserves memory newReserves)
    {
        if (r.collateralReserve == 0 || r.weatherReserve == 0) revert InvalidReserves();
        uint256 kVal = k(r);
        uint256 newWeatherReserve = r.weatherReserve + exposureIn;
        uint256 newCollateralReserve = kVal / newWeatherReserve;
        if (r.collateralReserve <= newCollateralReserve) revert InsufficientLiquidity();
        collateralOut = r.collateralReserve - newCollateralReserve;
        newReserves = Reserves(newCollateralReserve, newWeatherReserve);
    }

    /// @notice Reverses a short position's effect on the curve when closed
    function quoteCloseShort(Reserves memory r, uint256 exposureIn)
        internal pure returns (uint256 collateralOut, Reserves memory newReserves)
    {
        if (r.weatherReserve <= exposureIn || r.collateralReserve == 0) revert InsufficientLiquidity();
        uint256 kVal = k(r);
        uint256 newWeatherReserve = r.weatherReserve - exposureIn;
        if (newWeatherReserve == 0) revert InsufficientLiquidity();
        uint256 newCollateralReserve = kVal / newWeatherReserve;
        if (newCollateralReserve <= r.collateralReserve) revert InsufficientLiquidity();
        collateralOut = newCollateralReserve - r.collateralReserve;
        newReserves = Reserves(newCollateralReserve, newWeatherReserve);
    }
}
