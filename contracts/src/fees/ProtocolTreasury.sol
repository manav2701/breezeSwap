// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../access/BreezeAccessControl.sol";

/// @title ProtocolTreasury
/// @notice Holds the protocol's share of trading fee revenue, separate from
/// InsuranceFund (which exists purely to cover bad debt, not to be spent).
contract ProtocolTreasury {
    IERC20 public immutable collateralToken;
    BreezeAccessControl public immutable accessControl;
    uint256 public totalReceived;  // lifetime total, for the "Total Protocol Fees" stat

    event FeeReceived(address indexed fromMarket, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    constructor(address _collateralToken, address _accessControl) {
        require(_collateralToken != address(0) && _accessControl != address(0), "zero address");
        collateralToken = IERC20(_collateralToken);
        accessControl = BreezeAccessControl(_accessControl);
    }

    function receiveFee(uint256 amount) external {
        totalReceived += amount;
        emit FeeReceived(msg.sender, amount);
    }

    function withdraw(address to, uint256 amount) external {
        require(accessControl.hasRole(accessControl.ADMIN_ROLE(), msg.sender), "unauthorized");
        require(amount <= collateralToken.balanceOf(address(this)), "insufficient balance");
        collateralToken.transfer(to, amount);
        emit Withdrawn(to, amount);
    }

    function balance() external view returns (uint256) {
        return collateralToken.balanceOf(address(this));
    }
}
