// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./BreezePerpMarket.sol";
import "./InsuranceFund.sol";
import "./PerpMarketDeployer.sol";
import "./VirtualAMM.sol";
import "../fees/FeeConfig.sol";
import "../fees/ProtocolTreasury.sol";
import "../access/BreezeAccessControl.sol";
import "../oracle/StrikeProbabilityOracle.sol";
import "../oracle/CivilDate.sol";
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

    /// @notice Climatology used to sanity-check a new market's starting price.
    ///
    /// @dev A perp market's initial reserves fix its opening mark price, and nothing
    /// checked that price against the climate it is meant to track. A rainfall market
    /// could be opened at a mark implying 400mm in a region that averages 40mm, and every
    /// trade from then on would be priced off a number unrelated to the weather — funding
    /// would push mark toward index from an absurd starting point, and whoever was on the
    /// right side of that convergence would collect the difference from whoever was not.
    ///
    /// Settable rather than a constructor argument so an already-deployed factory can be
    /// brought under climatology without redeploying, and so the check is opt-in: unset
    /// means unenforced, which is exactly the behaviour the factory had before.
    StrikeProbabilityOracle public pricingOracle;

    /// @notice How far a new market's opening mark may sit from the climatological
    /// expectation for the current month.
    ///
    /// @dev Wide, deliberately. This is a sanity bound on market CREATION, not a peg: a
    /// perpetual has no expiry, so its fair mark legitimately drifts across seasons and a
    /// tight band would refuse reasonable markets. The purpose is to catch a mark that is
    /// wrong by an order of magnitude, which is the error that actually happens — a
    /// mis-scaled reserve ratio, or a number copied from another region.
    uint256 public maxInitialMarkDeviationBps = 5000; // ±50%

    uint256 public constant MIN_INITIAL_MARK_DEVIATION_BPS = 1000; // ±10%
    uint256 public constant MAX_INITIAL_MARK_DEVIATION_BPS = 9000; // ±90%

    event PerpMarketCreated(
        address indexed marketAddress,
        bytes32 indexed regionId,
        uint256 initialCollateralReserve,
        uint256 initialWeatherReserve,
        address oracleAddress,
        address collateralToken
    );

    event PricingOracleUpdated(address indexed oldOracle, address indexed newOracle);
    event InitialMarkDeviationUpdated(uint256 oldBps, uint256 newBps);
    event InitialMarkChecked(
        address indexed market,
        uint256 markPrice,
        uint256 climatologyPrice,
        uint8 monthOfYear
    );

    error UnauthorizedCaller();
    error InvalidInitialReserves();
    error ZeroAddress();
    error InvalidParameter();
    error InitialMarkOffClimatology(uint256 markPrice, uint256 climatologyPrice, uint256 maxBps);

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

        // Delegated to an external library so the market's creation bytecode is not
        // compiled into this contract. Inlining it here put the factory at 26,527 bytes
        // against the 24,576 byte chain limit, which made the factory undeployable on any
        // EVM chain. The DELEGATECALL executes in this contract's context, so the market's
        // creator is still this factory and nothing about its behaviour changes.
        BreezePerpMarket market = BreezePerpMarket(
            PerpMarketDeployer.deploy(
                PerpMarketDeployer.MarketParams({
                    reserves: VirtualAMM.Reserves({
                        collateralReserve: initialCollateralReserve,
                        weatherReserve: initialWeatherReserve
                    }),
                    oracle: oracleAddress,
                    insuranceFund: address(sharedInsuranceFund),
                    feeConfig: address(feeConfig),
                    treasury: address(treasury),
                    accessControl: address(accessControl),
                    collateralToken: collateralToken,
                    regionId: regionId
                })
            )
        );

        _checkInitialMark(market, regionId);

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

    /// @dev Refuse a market whose opening mark is nowhere near the climate it tracks.
    ///
    /// Run AFTER deployment rather than on the raw reserve ratio, so the comparison uses
    /// the market's own `indexPrice()` — and therefore its own `oracleValueScale`. Doing
    /// the conversion here with an assumed 1e6 would reintroduce exactly the scale
    /// mismatch that pinned the funding rate at its cap (SECURITY.md §6b), just one layer
    /// further out.
    ///
    /// The month comes from `block.timestamp`, not from the caller. A perpetual has no
    /// expiry, so the relevant climatology is the season it opens into; and deriving it
    /// removes the possibility of a creator declaring a month whose climatology happens to
    /// admit the price they wanted.
    function _checkInitialMark(BreezePerpMarket market, bytes32 regionId) internal {
        if (address(pricingOracle) == address(0)) return;

        uint8 month = CivilDate.monthOfYear(block.timestamp);
        bytes32 key = pricingOracle.levelKey(regionId, month);

        // An unpriced region is not refused. Gating creation on climatology that has not
        // been posted yet would make listing a new region impossible until the seeder had
        // run, which is an operational deadlock rather than a safety property. The check
        // binds where the data exists.
        if (!pricingOracle.isLevelSet(key)) return;

        uint256 expected = pricingOracle.expectedLevel(regionId, month);
        uint256 climatologyPrice = market.indexPrice(expected);
        uint256 mark = market.getMarkPrice();

        uint256 gap = mark > climatologyPrice ? mark - climatologyPrice : climatologyPrice - mark;
        if (gap * 10000 > climatologyPrice * maxInitialMarkDeviationBps) {
            revert InitialMarkOffClimatology(mark, climatologyPrice, maxInitialMarkDeviationBps);
        }

        emit InitialMarkChecked(address(market), mark, climatologyPrice, month);
    }

    function setPricingOracle(address oracle) external {
        if (!accessControl.hasRole(accessControl.ADMIN_ROLE(), msg.sender)) {
            revert UnauthorizedCaller();
        }
        address old = address(pricingOracle);
        pricingOracle = StrikeProbabilityOracle(oracle);
        emit PricingOracleUpdated(old, oracle);
    }

    function setMaxInitialMarkDeviationBps(uint256 newBps) external {
        if (!accessControl.hasRole(accessControl.ADMIN_ROLE(), msg.sender)) {
            revert UnauthorizedCaller();
        }
        if (
            newBps < MIN_INITIAL_MARK_DEVIATION_BPS || newBps > MAX_INITIAL_MARK_DEVIATION_BPS
        ) revert InvalidParameter();

        uint256 old = maxInitialMarkDeviationBps;
        maxInitialMarkDeviationBps = newBps;
        emit InitialMarkDeviationUpdated(old, newBps);
    }

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
