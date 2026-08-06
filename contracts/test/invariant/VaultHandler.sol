// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../src/vault/BreezeLiquidityVault.sol";

/// @notice Drives arbitrary sequences of LP and market actions against the vault.
/// Every action is bounded to a legal range so the fuzzer spends its runs
/// exploring real state transitions rather than bouncing off input validation.
contract VaultHandler is Test {
    BreezeLiquidityVault public vault;
    ERC20 public token;

    address[3] public lps;
    address[2] public markets;

    uint256 public totalDeposited;
    uint256 public totalWithdrawn;
    uint256 public totalProfitAbsorbed;
    uint256 public totalLossCovered;

    constructor(BreezeLiquidityVault _vault, ERC20 _token, address[3] memory _lps, address[2] memory _markets) {
        vault = _vault;
        token = _token;
        lps = _lps;
        markets = _markets;
    }

    function _lp(uint256 seed) internal view returns (address) {
        return lps[seed % lps.length];
    }

    function _market(uint256 seed) internal view returns (address) {
        return markets[seed % markets.length];
    }

    function deposit(uint256 lpSeed, uint256 amount) external {
        address lp = _lp(lpSeed);
        amount = bound(amount, 1e18, 100_000e18);
        if (token.balanceOf(lp) < amount) return;

        vm.prank(lp);
        try vault.deposit(amount, lp) {
            totalDeposited += amount;
        } catch {}
    }

    /// @dev Serves the withdrawal cooldown so the fuzzer still reaches the
    /// withdrawal paths. Without this every exit reverts and the invariants
    /// would only ever be checked against a pool nobody can leave.
    function _serveCooldown(address lp) internal {
        vm.prank(lp);
        vault.requestWithdrawal();
        vm.warp(block.timestamp + vault.withdrawalCooldown());
    }

    function withdraw(uint256 lpSeed, uint256 amount) external {
        address lp = _lp(lpSeed);
        _serveCooldown(lp);

        uint256 max = vault.maxWithdraw(lp);
        if (max == 0) return;
        amount = bound(amount, 1, max);

        vm.prank(lp);
        try vault.withdraw(amount, lp, lp) {
            totalWithdrawn += amount;
        } catch {}
    }

    function redeem(uint256 lpSeed, uint256 shares) external {
        address lp = _lp(lpSeed);
        _serveCooldown(lp);

        uint256 max = vault.maxRedeem(lp);
        if (max == 0) return;
        shares = bound(shares, 1, max);

        vm.prank(lp);
        try vault.redeem(shares, lp, lp) {} catch {}
    }

    function reserve(uint256 marketSeed, uint256 amount) external {
        address m = _market(marketSeed);
        uint256 max = vault.reservableLiquidity();
        if (max == 0) return;
        amount = bound(amount, 1, max);

        vm.prank(m);
        try vault.reserve(amount) {} catch {}
    }

    function release(uint256 marketSeed, uint256 amount) external {
        address m = _market(marketSeed);
        uint256 held = vault.marketReserved(m);
        if (held == 0) return;
        amount = bound(amount, 1, held);

        vm.prank(m);
        try vault.release(amount) {} catch {}
    }

    function absorbProfit(uint256 marketSeed, uint256 amount) external {
        address m = _market(marketSeed);
        amount = bound(amount, 1e18, 50_000e18);
        if (token.balanceOf(m) < amount) return;

        vm.prank(m);
        try vault.absorbProfit(amount) {
            totalProfitAbsorbed += amount;
        } catch {}
    }

    function coverLoss(uint256 marketSeed, uint256 amount) external {
        address m = _market(marketSeed);
        uint256 assets = vault.totalAssets();
        if (assets == 0) return;
        amount = bound(amount, 1, assets);

        vm.prank(m);
        try vault.coverLoss(amount) returns (uint256 covered) {
            totalLossCovered += covered;
        } catch {}
    }

    function marketReservedSum() external view returns (uint256 sum) {
        for (uint256 i = 0; i < markets.length; i++) {
            sum += vault.marketReserved(markets[i]);
        }
    }
}
