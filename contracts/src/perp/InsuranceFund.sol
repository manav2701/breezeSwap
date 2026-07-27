// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../access/BreezeAccessControl.sol";

/// @title InsuranceFund
/// @notice Centralized insurance reserve backing bad debt during liquidations across perpetual markets.
contract InsuranceFund {
    IERC20 public immutable collateralToken;
    BreezeAccessControl public immutable accessControl;
    mapping(address => bool) public authorizedMarkets;

    event Deposited(address indexed from, uint256 amount);
    event ShortfallCovered(address indexed market, uint256 amount, uint256 coveredAmount);
    event MarketAuthorizationSet(address indexed market, bool authorized);

    error UnauthorizedCaller();
    error ZeroAddress();

    modifier onlyAdmin() {
        if (!accessControl.hasRole(accessControl.ADMIN_ROLE(), msg.sender)) {
            revert UnauthorizedCaller();
        }
        _;
    }

    constructor(address _collateralToken, address _accessControl) {
        if (_collateralToken == address(0) || _accessControl == address(0)) revert ZeroAddress();
        collateralToken = IERC20(_collateralToken);
        accessControl = BreezeAccessControl(_accessControl);
    }

    function setMarketAuthorization(address market, bool authorized) external onlyAdmin {
        if (market == address(0)) revert ZeroAddress();
        authorizedMarkets[market] = authorized;
        emit MarketAuthorizationSet(market, authorized);
    }

    function deposit(uint256 amount) external {
        require(amount > 0, "zero amount");
        require(collateralToken.transferFrom(msg.sender, address(this), amount), "transfer failed");
        emit Deposited(msg.sender, amount);
    }

    function coverShortfall(uint256 amount) external returns (uint256 coveredAmount) {
        if (!authorizedMarkets[msg.sender]) revert UnauthorizedCaller();
        uint256 available = collateralToken.balanceOf(address(this));
        coveredAmount = amount > available ? available : amount;
        if (coveredAmount > 0) {
            require(collateralToken.transfer(msg.sender, coveredAmount), "transfer failed");
        }
        emit ShortfallCovered(msg.sender, amount, coveredAmount);
    }

    function balance() external view returns (uint256) {
        return collateralToken.balanceOf(address(this));
    }
}
