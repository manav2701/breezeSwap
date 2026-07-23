// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./BreezeMarket.sol";
import "./PositionToken.sol";
import "../settlement/PayoffCalculator.sol";

/**
 * @title BreezeMarketFactory
 * @notice Permissionless factory contract for creating and registering BreezeMarket instances.
 */
contract BreezeMarketFactory is Ownable {
    PositionToken public immutable sharedPositionToken;

    address[] public allMarkets;
    mapping(address => bool) public isMarket;

    event MarketCreated(
        address indexed market,
        bytes32 indexed regionId,
        uint256 expiryTimestamp,
        address collateralToken,
        PayoffCalculator.PayoffType payoffType
    );

    error InvalidParameters();

    constructor(address sharedPositionToken_) Ownable(msg.sender) {
        if (sharedPositionToken_ == address(0)) revert InvalidParameters();
        sharedPositionToken = PositionToken(sharedPositionToken_);
    }

    /**
     * @notice Create a new parametric weather market.
     */
    function createMarket(
        bytes32 regionId,
        BreezeMarket.WeatherVariable weatherVariable,
        int256 thresholdLow,
        int256 thresholdHigh,
        uint256 expiryTimestamp,
        address oracleAddress,
        address collateralToken,
        PayoffCalculator.PayoffType payoffType
    ) external returns (address marketAddress) {
        // Input validation
        if (
            expiryTimestamp <= block.timestamp ||
            oracleAddress == address(0) ||
            collateralToken == address(0)
        ) {
            revert InvalidParameters();
        }

        if (payoffType != PayoffCalculator.PayoffType.BINARY) {
            if (thresholdLow >= thresholdHigh) revert InvalidParameters();
        }

        // 1. Deploy new BreezeMarket contract
        BreezeMarket market = new BreezeMarket(
            regionId,
            weatherVariable,
            thresholdLow,
            thresholdHigh,
            expiryTimestamp,
            oracleAddress,
            collateralToken,
            address(sharedPositionToken),
            payoffType
        );

        marketAddress = address(market);

        // 2. Authorize market as minter on shared PositionToken
        sharedPositionToken.setMinter(marketAddress, true);

        // 3. Register market
        allMarkets.push(marketAddress);
        isMarket[marketAddress] = true;

        emit MarketCreated(marketAddress, regionId, expiryTimestamp, collateralToken, payoffType);
    }

    /**
     * @notice Returns total number of deployed markets.
     */
    function getMarketCount() external view returns (uint256) {
        return allMarkets.length;
    }
}
