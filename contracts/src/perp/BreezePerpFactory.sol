// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./BreezePerpMarket.sol";
import "./InsuranceFund.sol";
import "./VirtualAMM.sol";
import "../fees/FeeConfig.sol";
import "../fees/ProtocolTreasury.sol";
import "../access/BreezeAccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title BreezePerpFactory
/// @notice Factory contract for deploying vAMM perpetual weather markets.
/// Creation is gated by MARKET_CREATOR_ROLE to ensure sound initial reserve parameters.
contract BreezePerpFactory is Pausable {
    BreezeAccessControl public immutable accessControl;
    InsuranceFund public immutable sharedInsuranceFund;
    FeeConfig public immutable feeConfig;
    ProtocolTreasury public immutable treasury;
    address[] public allMarkets;

    event PerpMarketCreated(
        address indexed marketAddress,
        bytes32 indexed regionId,
        uint256 initialCollateralReserve,
        uint256 initialWeatherReserve,
        address oracleAddress,
        address collateralToken
    );

    error UnauthorizedCaller();
    error InvalidInitialReserves();
    error ZeroAddress();

    modifier onlyMarketCreator() {
        if (!accessControl.hasRole(accessControl.MARKET_CREATOR_ROLE(), msg.sender)) {
            revert UnauthorizedCaller();
        }
        _;
    }

    modifier onlyPauser() {
        if (!accessControl.hasRole(accessControl.PAUSER_ROLE(), msg.sender)) {
            revert UnauthorizedCaller();
        }
        _;
    }

    constructor(
        address _accessControl,
        address _sharedInsuranceFund,
        address _feeConfig,
        address _treasury
    ) {
        if (
            _accessControl == address(0) ||
            _sharedInsuranceFund == address(0) ||
            _feeConfig == address(0) ||
            _treasury == address(0)
        ) revert ZeroAddress();

        accessControl = BreezeAccessControl(_accessControl);
        sharedInsuranceFund = InsuranceFund(_sharedInsuranceFund);
        feeConfig = FeeConfig(_feeConfig);
        treasury = ProtocolTreasury(_treasury);
    }

    function createPerpMarket(
        bytes32 regionId,
        uint256 initialCollateralReserve,
        uint256 initialWeatherReserve,
        address oracleAddress,
        address collateralToken
    ) external onlyMarketCreator whenNotPaused returns (address marketAddress) {
        if (initialCollateralReserve == 0 || initialWeatherReserve == 0) revert InvalidInitialReserves();
        if (oracleAddress == address(0) || collateralToken == address(0)) revert ZeroAddress();

        VirtualAMM.Reserves memory initialReserves = VirtualAMM.Reserves({
            collateralReserve: initialCollateralReserve,
            weatherReserve: initialWeatherReserve
        });

        BreezePerpMarket market = new BreezePerpMarket(
            initialReserves,
            oracleAddress,
            address(sharedInsuranceFund),
            address(feeConfig),
            address(treasury),
            address(accessControl),
            collateralToken,
            regionId
        );

        marketAddress = address(market);
        allMarkets.push(marketAddress);

        emit PerpMarketCreated(
            marketAddress,
            regionId,
            initialCollateralReserve,
            initialWeatherReserve,
            oracleAddress,
            collateralToken
        );
    }

    error InvalidInvalidReserves();

    function getMarketCount() external view returns (uint256) {
        return allMarkets.length;
    }

    function pauseFactory() external onlyPauser {
        _pause();
    }

    function unpauseFactory() external onlyPauser {
        _unpause();
    }
}
