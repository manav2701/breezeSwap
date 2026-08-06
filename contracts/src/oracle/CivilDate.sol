// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CivilDate
/// @notice Calendar month from a UNIX timestamp, in UTC.
///
/// @dev Exists so a market can key its own climatology instead of being told which month
/// it belongs to. Every priced strike is per-month — weather is strongly seasonal, so an
/// annual figure misprices every individual month — which means anything consulting the
/// pricing oracle needs a month. Passing it in as a parameter would make the pricing
/// depend on the market creator declaring it honestly, and a wrong declaration would price
/// a market against the wrong season while looking fully priced. Deriving it removes that
/// trust entirely.
///
/// This is Howard Hinnant's `civil_from_days`, restricted to the month. It is exact for
/// all timestamps, with no lookup tables and no loop, and it handles leap years including
/// the 100/400-year rules. The shifted era starts on 0000-03-01 so that leap day falls at
/// the end of a year, which is what removes the special-casing.
library CivilDate {
    uint256 private constant SECONDS_PER_DAY = 86400;

    /// @notice UTC calendar month, 1 (January) through 12 (December).
    function monthOfYear(uint256 timestamp) internal pure returns (uint8) {
        // Days since 1970-01-01, shifted to an era beginning 0000-03-01.
        uint256 z = timestamp / SECONDS_PER_DAY + 719468;

        uint256 era = z / 146097; // 146097 days per 400-year era
        uint256 doe = z - era * 146097; // day of era, 0..146096
        uint256 yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365; // year of era
        uint256 doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // day of year, March-based

        // Month in the March-based year, 0..11.
        uint256 mp = (5 * doy + 2) / 153;

        // Shift back to a January-based year.
        return uint8(mp < 10 ? mp + 3 : mp - 9);
    }
}
