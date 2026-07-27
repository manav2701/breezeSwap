// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./VirtualAMM.sol";
import "./FundingRateEngine.sol";
import "./PerpConstants.sol";
import "./InsuranceFund.sol";
import "../fees/FeeConfig.sol";
import "../fees/ProtocolTreasury.sol";
import "../oracle/IWeatherOracle.sol";
import "../access/BreezeAccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title BreezePerpMarket
/// @notice Perpetual vAMM weather market contract managing positions, leverage, funding rates, liquidations, and fees.
contract BreezePerpMarket is Pausable, ReentrancyGuard {
    using VirtualAMM for VirtualAMM.Reserves;

    struct Position {
        address trader;
        bool isLong;
        uint256 collateral;        // Net collateral posted after fee deduction
        uint256 leverage;
        uint256 virtualSize;       // Weather exposure units from vAMM
        uint256 entryMarkPrice;
        int256 entryFundingIndex;  // Cumulative funding index at open
        bool isOpen;
    }

    VirtualAMM.Reserves public reserves;
    IWeatherOracle public immutable oracle;
    InsuranceFund public immutable insuranceFund;
    FeeConfig public immutable feeConfig;
    ProtocolTreasury public immutable treasury;
    BreezeAccessControl public immutable accessControl;
    IERC20 public immutable collateralToken;
    bytes32 public immutable regionId;

    uint256 public constant MAX_ORACLE_AGE = 86400; // 24 hours

    mapping(uint256 => Position) public positions;
    uint256 public nextPositionId;
    uint256 public totalLongOpenInterest;   // Total net collateral backing Longs
    uint256 public totalShortOpenInterest;  // Total net collateral backing Shorts

    int256 public cumulativeFundingIndex;
    uint256 public lastFundingSettledAt;

    event PositionOpened(
        uint256 indexed positionId,
        address indexed trader,
        bool isLong,
        uint256 collateral,
        uint256 leverage,
        uint256 virtualSize,
        uint256 markPrice
    );
    event PositionClosed(
        uint256 indexed positionId,
        address indexed trader,
        int256 pnl,
        uint256 payout
    );
    event PositionLiquidated(
        uint256 indexed positionId,
        address indexed liquidator,
        uint256 reward,
        uint256 badDebt,
        uint256 coveredDebt
    );
    event FundingSettled(int256 fundingRate, int256 newCumulativeIndex, uint256 timestamp);
    event FeeCollected(
        address indexed market,
        address indexed trader,
        uint256 feeAmount,
        uint256 insuranceShare,
        uint256 treasuryShare
    );

    error UnauthorizedCaller();
    error InvalidLeverage();
    error PositionNotOpen();
    error PositionNotLiquidatable();
    error ZeroAddress();

    modifier onlyPauser() {
        if (!accessControl.hasRole(accessControl.PAUSER_ROLE(), msg.sender)) {
            revert UnauthorizedCaller();
        }
        _;
    }

    constructor(
        VirtualAMM.Reserves memory initialReserves,
        address _oracle,
        address _insuranceFund,
        address _feeConfig,
        address _treasury,
        address _accessControl,
        address _collateralToken,
        bytes32 _regionId
    ) {
        if (
            _oracle == address(0) ||
            _insuranceFund == address(0) ||
            _feeConfig == address(0) ||
            _treasury == address(0) ||
            _accessControl == address(0) ||
            _collateralToken == address(0)
        ) revert ZeroAddress();

        reserves = initialReserves;
        oracle = IWeatherOracle(_oracle);
        insuranceFund = InsuranceFund(_insuranceFund);
        feeConfig = FeeConfig(_feeConfig);
        treasury = ProtocolTreasury(_treasury);
        accessControl = BreezeAccessControl(_accessControl);
        collateralToken = IERC20(_collateralToken);
        regionId = _regionId;
        lastFundingSettledAt = block.timestamp;
    }

    function getMarkPrice() external view returns (uint256) {
        return reserves.markPrice();
    }

    function openPosition(bool isLong, uint256 collateral, uint256 leverage)
        external
        whenNotPaused
        nonReentrant
        returns (uint256 positionId)
    {
        if (leverage == 0 || leverage > PerpConstants.MAX_LEVERAGE) revert InvalidLeverage();
        require(collateral > 0, "zero collateral");

        require(
            collateralToken.transferFrom(msg.sender, address(this), collateral),
            "collateral transfer failed"
        );

        // Deduct trading fee from posted margin collateral
        (uint256 feeAmount, uint256 insuranceShare, uint256 treasuryShare) = feeConfig.calculateFeeSplit(collateral);
        if (feeAmount > 0) {
            if (insuranceShare > 0) {
                collateralToken.approve(address(insuranceFund), insuranceShare);
                insuranceFund.deposit(insuranceShare);
            }
            if (treasuryShare > 0) {
                collateralToken.transfer(address(treasury), treasuryShare);
                treasury.receiveFee(treasuryShare);
            }
            emit FeeCollected(address(this), msg.sender, feeAmount, insuranceShare, treasuryShare);
        }

        uint256 netCollateral = collateral - feeAmount;
        uint256 notional = netCollateral * leverage;
        uint256 exposureOut;
        VirtualAMM.Reserves memory newReserves;

        if (isLong) {
            (exposureOut, newReserves) = reserves.quoteOpenLong(notional);
            totalLongOpenInterest += netCollateral;
        } else {
            (exposureOut, newReserves) = reserves.quoteOpenShort(notional);
            totalShortOpenInterest += netCollateral;
        }

        reserves = newReserves;
        positionId = nextPositionId++;

        positions[positionId] = Position({
            trader: msg.sender,
            isLong: isLong,
            collateral: netCollateral,
            leverage: leverage,
            virtualSize: exposureOut,
            entryMarkPrice: reserves.markPrice(),
            entryFundingIndex: cumulativeFundingIndex,
            isOpen: true
        });

        emit PositionOpened(
            positionId,
            msg.sender,
            isLong,
            netCollateral,
            leverage,
            exposureOut,
            reserves.markPrice()
        );
    }

    function closePosition(uint256 positionId) external nonReentrant returns (int256 pnl) {
        Position storage pos = positions[positionId];
        if (!pos.isOpen) revert PositionNotOpen();
        require(pos.trader == msg.sender, "not position owner");

        pnl = _executeClose(positionId, pos, msg.sender);
    }

    function liquidate(uint256 positionId) external nonReentrant returns (uint256 reward) {
        Position storage pos = positions[positionId];
        if (!pos.isOpen) revert PositionNotOpen();
        if (!_isLiquidatable(positionId)) revert PositionNotLiquidatable();

        return _executeLiquidation(positionId, pos, msg.sender);
    }

    function settleFunding() external {
        require(
            block.timestamp >= lastFundingSettledAt + PerpConstants.FUNDING_INTERVAL,
            "funding interval not reached"
        );

        IWeatherOracle.Reading memory reading = oracle.getReading(regionId, block.timestamp);
        require(reading.isValid, "oracle reading invalid");
        require(!oracle.isStale(regionId, MAX_ORACLE_AGE), "oracle reading stale");

        int256 rate = FundingRateEngine.calculateFundingRate(
            reserves.markPrice(),
            uint256(reading.value)
        );

        cumulativeFundingIndex += rate;
        lastFundingSettledAt = block.timestamp;

        emit FundingSettled(rate, cumulativeFundingIndex, block.timestamp);
    }

    function pauseOpens() external onlyPauser {
        _pause();
    }

    function unpauseOpens() external onlyPauser {
        _unpause();
    }

    function calculateUnrealizedPnl(uint256 positionId) public view returns (int256 totalPnl) {
        Position storage pos = positions[positionId];
        if (!pos.isOpen) return 0;

        uint256 collateralOut;
        if (pos.isLong) {
            (collateralOut, ) = reserves.quoteCloseLong(pos.virtualSize);
        } else {
            (collateralOut, ) = reserves.quoteCloseShort(pos.virtualSize);
        }

        uint256 notional = pos.collateral * pos.leverage;
        int256 pricePnl = int256(collateralOut) - int256(notional);

        int256 fundingIndexDelta = cumulativeFundingIndex - pos.entryFundingIndex;
        int256 fundingBpsImpact = pos.isLong ? -fundingIndexDelta : fundingIndexDelta;
        int256 fundingPnl = (int256(notional) * fundingBpsImpact) / 10000;

        totalPnl = pricePnl + fundingPnl;
    }

    function isLiquidatable(uint256 positionId) external view returns (bool) {
        return _isLiquidatable(positionId);
    }

    function _isLiquidatable(uint256 positionId) internal view returns (bool) {
        Position storage pos = positions[positionId];
        if (!pos.isOpen) return false;

        int256 pnl = calculateUnrealizedPnl(positionId);
        int256 equity = int256(pos.collateral) + pnl;

        uint256 notional = pos.collateral * pos.leverage;
        uint256 maintenanceRequired = (notional * PerpConstants.MAINTENANCE_MARGIN_BPS) / 10000;

        return equity < int256(maintenanceRequired);
    }

    function _executeClose(uint256 positionId, Position storage pos, address recipient)
        internal
        returns (int256 totalPnl)
    {
        VirtualAMM.Reserves memory newReserves;

        if (pos.isLong) {
            (, newReserves) = reserves.quoteCloseLong(pos.virtualSize);
            totalLongOpenInterest -= pos.collateral;
        } else {
            (, newReserves) = reserves.quoteCloseShort(pos.virtualSize);
            totalShortOpenInterest -= pos.collateral;
        }

        reserves = newReserves;
        totalPnl = calculateUnrealizedPnl(positionId);
        pos.isOpen = false;

        int256 equity = int256(pos.collateral) + totalPnl;
        uint256 rawPayout = equity > 0 ? uint256(equity) : 0;

        uint256 netPayout = rawPayout;
        if (rawPayout > 0) {
            (uint256 feeAmount, uint256 insuranceShare, uint256 treasuryShare) = feeConfig.calculateFeeSplit(rawPayout);
            if (feeAmount > 0) {
                if (insuranceShare > 0) {
                    collateralToken.approve(address(insuranceFund), insuranceShare);
                    insuranceFund.deposit(insuranceShare);
                }
                if (treasuryShare > 0) {
                    collateralToken.transfer(address(treasury), treasuryShare);
                    treasury.receiveFee(treasuryShare);
                }
                emit FeeCollected(address(this), recipient, feeAmount, insuranceShare, treasuryShare);
            }
            netPayout = rawPayout - feeAmount;
        }

        uint256 bal = collateralToken.balanceOf(address(this));
        if (netPayout > bal) netPayout = bal;

        if (netPayout > 0) {
            require(collateralToken.transfer(recipient, netPayout), "payout transfer failed");
        }

        emit PositionClosed(positionId, recipient, totalPnl, netPayout);
    }

    function _executeLiquidation(uint256 positionId, Position storage pos, address liquidator)
        internal
        returns (uint256 reward)
    {
        VirtualAMM.Reserves memory newReserves;
        if (pos.isLong) {
            (, newReserves) = reserves.quoteCloseLong(pos.virtualSize);
            totalLongOpenInterest -= pos.collateral;
        } else {
            (, newReserves) = reserves.quoteCloseShort(pos.virtualSize);
            totalShortOpenInterest -= pos.collateral;
        }
        reserves = newReserves;

        int256 totalPnl = calculateUnrealizedPnl(positionId);
        pos.isOpen = false;

        reward = (pos.collateral * PerpConstants.LIQUIDATION_REWARD_BPS) / 10000;
        int256 equity = int256(pos.collateral) + totalPnl;

        uint256 badDebt = 0;
        uint256 coveredDebt = 0;

        if (equity <= 0) {
            badDebt = uint256(-equity);
            uint256 shortfallToCover = badDebt + reward;
            coveredDebt = insuranceFund.coverShortfall(shortfallToCover);

            uint256 availableBal = collateralToken.balanceOf(address(this));
            uint256 liquidatorPayout = reward > availableBal ? availableBal : reward;
            if (liquidatorPayout > 0) {
                require(collateralToken.transfer(liquidator, liquidatorPayout), "liquidator payout failed");
            }
        } else {
            uint256 remainingEquity = uint256(equity);
            uint256 liquidatorPayout = reward > remainingEquity ? remainingEquity : reward;
            uint256 traderPayout = remainingEquity > liquidatorPayout ? remainingEquity - liquidatorPayout : 0;

            if (liquidatorPayout > 0) {
                require(collateralToken.transfer(liquidator, liquidatorPayout), "liquidator payout failed");
            }
            if (traderPayout > 0) {
                require(collateralToken.transfer(pos.trader, traderPayout), "trader payout failed");
            }
        }

        emit PositionLiquidated(positionId, liquidator, reward, badDebt, coveredDebt);
    }
}
