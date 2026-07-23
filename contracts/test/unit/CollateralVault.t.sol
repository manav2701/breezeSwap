// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../src/vault/CollateralVault.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("Mock Collateral", "USDT0") {
        _mint(msg.sender, 1_000_000 * 1e18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

// Malicious token that attempts reentrancy during transfer
contract ReentrantERC20 is ERC20 {
    CollateralVault public targetVault;
    address public maliciousUser;
    bool public reenterAttempted;

    constructor() ERC20("Reentrant Token", "RTOK") {
        _mint(msg.sender, 1_000_000 * 1e18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setVault(CollateralVault vault, address user) external {
        targetVault = vault;
        maliciousUser = user;
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        if (!reenterAttempted && address(targetVault) != address(0)) {
            reenterAttempted = true;
            // Attempt to reenter vault withdraw
            targetVault.withdraw(maliciousUser, 10);
        }
        return super.transfer(to, amount);
    }
}

contract CollateralVaultTest is Test {
    CollateralVault public vault;
    MockERC20 public token;
    address public market = address(0x1111);
    address public alice = address(0x2222);

    function setUp() public {
        token = new MockERC20();
        vault = new CollateralVault(address(token), market);

        token.mint(alice, 1000 * 1e18);
        vm.prank(alice);
        token.approve(address(vault), type(uint256).max);
    }

    function test_DepositUpdatesBalanceAndAccounting() public {
        uint256 depositAmount = 500 * 1e18;

        vm.prank(market);
        vault.deposit(alice, depositAmount);

        assertEq(vault.totalDeposited(), depositAmount);
        assertEq(token.balanceOf(address(vault)), depositAmount);
    }

    function test_WithdrawUpdatesBalanceAndAccounting() public {
        uint256 depositAmount = 500 * 1e18;
        uint256 withdrawAmount = 200 * 1e18;

        vm.prank(market);
        vault.deposit(alice, depositAmount);

        vm.prank(market);
        vault.withdraw(alice, withdrawAmount);

        assertEq(vault.totalDeposited(), depositAmount - withdrawAmount);
        assertEq(token.balanceOf(address(vault)), depositAmount - withdrawAmount);
    }

    function test_CannotWithdrawMoreThanDeposited() public {
        vm.prank(market);
        vault.deposit(alice, 100);

        vm.prank(market);
        vm.expectRevert(CollateralVault.InsufficientBalance.selector);
        vault.withdraw(alice, 200);
    }

    function test_UnauthorizedCallerCannotDepositOrWithdraw() public {
        vm.prank(alice);
        vm.expectRevert(CollateralVault.OnlyMarket.selector);
        vault.deposit(alice, 100);

        vm.prank(alice);
        vm.expectRevert(CollateralVault.OnlyMarket.selector);
        vault.withdraw(alice, 100);
    }

    function test_ReentrancyAttemptFails() public {
        ReentrantERC20 rToken = new ReentrantERC20();
        CollateralVault rVault = new CollateralVault(address(rToken), market);
        rToken.setVault(rVault, alice);

        rToken.mint(alice, 1000);
        vm.prank(alice);
        rToken.approve(address(rVault), type(uint256).max);

        vm.prank(market);
        rVault.deposit(alice, 500);

        // Withdrawal triggers rToken.transfer which attempts to reenter rVault.withdraw
        vm.prank(market);
        vm.expectRevert(); // ReentrancyGuard revert
        rVault.withdraw(alice, 100);
    }
}
