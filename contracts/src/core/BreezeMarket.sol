// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "../oracle/IWeatherOracle.sol";
import "../vault/CollateralVault.sol";
import "../settlement/PayoffCalculator.sol";
import "./PositionToken.sol";

/**
 * @title BreezeMarket
 * @notice Individual parametric weather derivative market instance.
 */
contract BreezeMarket is ReentrancyGuard {
    enum WeatherVariable { RAINFALL, TEMPERATURE }
    enum Status { OPEN, SETTLED }

    bytes32 public immutable regionId;
    WeatherVariable public immutable weatherVariable;
    int256 public immutable thresholdLow;
    int256 public immutable thresholdHigh;
    uint256 public immutable expiryTimestamp;
    
    IWeatherOracle public immutable oracle;
    IERC20 public immutable collateralToken;
    PositionToken public immutable positionToken;
    CollateralVault public immutable vault;
    PayoffCalculator.PayoffType public immutable payoffType;

    Status public status;
    int256 public finalOracleValue;

    uint256 public totalLongSupply;
    uint256 public totalShortSupply;
    uint256 public totalCollateral;

    uint256 public longPayoutPerToken;
    uint256 public shortPayoutPerToken;

    event PositionMinted(address indexed user, PositionToken.Side side, uint256 collateralAmount, uint256 tokenId);
    event MarketSettled(int256 oracleValue, uint256 longPayoutPerToken, uint256 shortPayoutPerToken);
    event PositionRedeemed(address indexed user, uint256 tokenId, uint256 amount, uint256 payout);

    error MarketExpired();
    error MarketNotExpired();
    error MarketAlreadySettled();
    error MarketNotSettled();
    error InvalidOracleData();
    error OracleDataStale();
    error ZeroAmount();
    error InvalidParameters();
    error Unauthorized();

    constructor(
        bytes32 regionId_,
        WeatherVariable weatherVariable_,
        int256 thresholdLow_,
        int256 thresholdHigh_,
        uint256 expiryTimestamp_,
        address oracleAddress_,
        address collateralToken_,
        address positionTokenAddress_,
        PayoffCalculator.PayoffType payoffType_
    ) {
        if (
            expiryTimestamp_ <= block.timestamp ||
            oracleAddress_ == address(0) ||
            collateralToken_ == address(0) ||
            positionTokenAddress_ == address(0)
        ) {
            revert InvalidParameters();
        }

        regionId = regionId_;
        weatherVariable = weatherVariable_;
        thresholdLow = thresholdLow_;
        thresholdHigh = thresholdHigh_;
        expiryTimestamp = expiryTimestamp_;
        oracle = IWeatherOracle(oracleAddress_);
        collateralToken = IERC20(collateralToken_);
        positionToken = PositionToken(positionTokenAddress_);
        payoffType = payoffType_;

        vault = new CollateralVault(collateralToken_, address(this));
        status = Status.OPEN;
    }

    /**
     * @notice Mint Long or Short position tokens prior to expiry by depositing collateral.
     */
    function mintPosition(PositionToken.Side side, uint256 collateralAmount) external nonReentrant returns (uint256 tokenId) {
        if (block.timestamp >= expiryTimestamp) revert MarketExpired();
        if (status != Status.OPEN) revert MarketAlreadySettled();
        if (collateralAmount == 0) revert ZeroAmount();

        // 1. Pull collateral into market vault
        vault.deposit(msg.sender, collateralAmount);
        totalCollateral += collateralAmount;

        // 2. Track supply
        if (side == PositionToken.Side.LONG) {
            totalLongSupply += collateralAmount;
        } else {
            totalShortSupply += collateralAmount;
        }

        // 3. Mint Position Tokens to caller
        tokenId = positionToken.mint(msg.sender, address(this), side, collateralAmount);

        emit PositionMinted(msg.sender, side, collateralAmount, tokenId);
    }

    /**
     * @notice Permissionlessly settle the market after expiryTimestamp using weather oracle readings.
     */
    function settle() external nonReentrant {
        if (block.timestamp < expiryTimestamp) revert MarketNotExpired();
        if (status == Status.SETTLED) revert MarketAlreadySettled();

        // 1. Fetch oracle reading
        IWeatherOracle.Reading memory reading = oracle.getReading(regionId, expiryTimestamp);
        if (!reading.isValid) revert InvalidOracleData();
        if (oracle.isStale(regionId, 86400)) revert OracleDataStale();

        finalOracleValue = reading.value;

        // 2. Calculate payouts using PayoffCalculator
        uint256 totalNotional = totalCollateral;

        if (totalNotional > 0) {
            (uint256 totalLongPayout, uint256 totalShortPayout) = PayoffCalculator.calculatePayout(
                payoffType,
                finalOracleValue,
                thresholdLow,
                thresholdHigh,
                totalNotional
            );

            if (totalLongSupply > 0) {
                longPayoutPerToken = (totalLongPayout * 1e18) / totalLongSupply;
            }
            if (totalShortSupply > 0) {
                shortPayoutPerToken = (totalShortPayout * 1e18) / totalShortSupply;
            }
        }

        status = Status.SETTLED;
        emit MarketSettled(finalOracleValue, longPayoutPerToken, shortPayoutPerToken);
    }

    /**
     * @notice Redeem position tokens for collateral after settlement.
     */
    function redeem(uint256 tokenId, uint256 amount) external nonReentrant returns (uint256 payout) {
        if (status != Status.SETTLED) revert MarketNotSettled();
        if (amount == 0) revert ZeroAmount();

        PositionToken.Side side = positionToken.sideOf(tokenId);
        if (positionToken.marketOf(tokenId) != address(this)) revert InvalidParameters();

        // 1. Burn tokens first (checks-effects-interactions)
        positionToken.burn(msg.sender, tokenId, amount);

        if (side == PositionToken.Side.LONG) {
            totalLongSupply -= amount;
            payout = (amount * longPayoutPerToken) / 1e18;
        } else {
            totalShortSupply -= amount;
            payout = (amount * shortPayoutPerToken) / 1e18;
        }

        // 2. Last redeemer gets remainder pattern: if all market position tokens are burned,
        // assign remaining vault collateral to the final redeemer to ensure vault drains to 0
        if (totalLongSupply == 0 && totalShortSupply == 0) {
            uint256 remainingVault = vault.totalDeposited();
            if (remainingVault > 0 && remainingVault <= payout + 1e15) {
                payout = remainingVault;
            }
        }

        // 3. Withdraw payout from vault to user
        if (payout > 0) {
            vault.withdraw(msg.sender, payout);
        }

        emit PositionRedeemed(msg.sender, tokenId, amount, payout);
    }
}
