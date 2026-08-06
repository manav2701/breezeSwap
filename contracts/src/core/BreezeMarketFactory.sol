// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/utils/Pausable.sol";
import "../access/BreezeAccessControl.sol";
import "./BreezeMarket.sol";
import "../oracle/StrikeProbabilityOracle.sol";
import "./PositionToken.sol";
import "../settlement/PayoffCalculator.sol";

/**
 * @title BreezeMarketFactory
 * @notice Permissionless factory contract for creating and registering BreezeMarket instances.
 * Retrofitted in Phase 7 to include PAUSER_ROLE-gated emergency pause functionality.
 */
contract BreezeMarketFactory is Pausable {
    BreezeAccessControl public immutable accessControl;
    PositionToken public immutable sharedPositionToken;

    address[] public allMarkets;
    mapping(address => bool) public isMarket;

    /// @notice Climatology new markets resolve their fair odds against. Optional.
    ///
    /// @dev Deliberately does NOT gate creation. Refusing markets whose strike has no
    /// posted climatology would make listing a new region impossible until the seeder had
    /// run — an operational deadlock rather than a safety property, and this factory is
    /// permissionless by design. Instead each market records whether it is priced
    /// (`BreezeMarket.isPriced`) and enforces a fair-odds band only when it is, so an
    /// unpriced market is possible and is flagged as such on-chain rather than being
    /// indistinguishable from a priced one.
    StrikeProbabilityOracle public pricingOracle;

    event PricingOracleUpdated(address indexed oldOracle, address indexed newOracle);

    event MarketCreated(
        address indexed market,
        bytes32 indexed regionId,
        uint256 expiryTimestamp,
        address collateralToken,
        PayoffCalculator.PayoffType payoffType
    );

    error InvalidParameters();

    modifier onlyRole(bytes32 role) {
        require(accessControl.hasRole(role, msg.sender), "BreezeSwap: unauthorized");
        _;
    }

    constructor(address sharedPositionToken_, address _accessControl) {
        if (sharedPositionToken_ == address(0) || _accessControl == address(0)) revert InvalidParameters();
        sharedPositionToken = PositionToken(sharedPositionToken_);
        accessControl = BreezeAccessControl(_accessControl);
    }

    /// @notice Admin-gated emergency pause for the factory (blocks NEW market creation only).
    /// Pausing the factory does NOT stop existing markets from minting, settling, or redeeming.
    function pauseFactory() external onlyRole(accessControl.PAUSER_ROLE()) {
        _pause();
    }

    /// @notice Unpause factory market creation.
    function unpauseFactory() external onlyRole(accessControl.PAUSER_ROLE()) {
        _unpause();
    }

    /**
     * @notice Create a new parametric weather market. Stays permissionless for Classic Markets.
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
    ) external whenNotPaused returns (address marketAddress) {
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

        // 1. Deploy new BreezeMarket contract (passing accessControl reference)
        BreezeMarket market = new BreezeMarket(
            regionId,
            weatherVariable,
            thresholdLow,
            thresholdHigh,
            expiryTimestamp,
            oracleAddress,
            collateralToken,
            address(sharedPositionToken),
            payoffType,
            address(accessControl),
            address(pricingOracle)
        );

        marketAddress = address(market);

        // 2. Authorize market as minter on shared PositionToken
        sharedPositionToken.setMinter(marketAddress, true);

        // 3. Register market
        allMarkets.push(marketAddress);
        isMarket[marketAddress] = true;

        emit MarketCreated(marketAddress, regionId, expiryTimestamp, collateralToken, payoffType);
    }

    function setPricingOracle(address oracle) external onlyRole(accessControl.ADMIN_ROLE()) {
        address old = address(pricingOracle);
        pricingOracle = StrikeProbabilityOracle(oracle);
        emit PricingOracleUpdated(old, oracle);
    }

    /**
     * @notice Returns total number of deployed markets.
     */
    function getMarketCount() external view returns (uint256) {
        return allMarkets.length;
    }
}
