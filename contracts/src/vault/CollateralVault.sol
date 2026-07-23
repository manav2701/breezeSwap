// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CollateralVault
 * @notice Vault contract holding ERC20 collateral for a specific BreezeMarket instance.
 */
contract CollateralVault is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable collateralToken;
    address public market;
    uint256 public totalDeposited;

    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    error OnlyMarket();
    error InvalidMarketAddress();
    error InsufficientBalance();
    error TransferFailed();

    modifier onlyMarket() {
        if (msg.sender != market) revert OnlyMarket();
        _;
    }

    constructor(address collateralToken_, address market_) Ownable(msg.sender) {
        if (collateralToken_ == address(0) || market_ == address(0)) revert InvalidMarketAddress();
        collateralToken = IERC20(collateralToken_);
        market = market_;
    }

    /**
     * @notice Deposit collateral from user into vault. Called exclusively by market contract.
     */
    function deposit(address from, uint256 amount) external onlyMarket {
        if (amount == 0) return;
        totalDeposited += amount;
        collateralToken.safeTransferFrom(from, address(this), amount);
        emit Deposited(from, amount);
    }

    /**
     * @notice Withdraw collateral from vault to user. Called exclusively by market contract.
     */
    function withdraw(address to, uint256 amount) external onlyMarket nonReentrant {
        if (amount == 0) return;
        if (amount > totalDeposited) revert InsufficientBalance();
        
        totalDeposited -= amount;
        collateralToken.safeTransfer(to, amount);
        emit Withdrawn(to, amount);
    }
}
