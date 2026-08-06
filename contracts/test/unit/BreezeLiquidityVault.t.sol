// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../src/access/BreezeAccessControl.sol";
import "../../src/vault/BreezeLiquidityVault.sol";

contract VaultToken is ERC20 {
    constructor() ERC20("Mock USDT", "mUSDT") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract BreezeLiquidityVaultTest is Test {
    BreezeAccessControl accessControl;
    VaultToken token;
    BreezeLiquidityVault vault;

    address admin = address(this);
    address pauser = address(0x1111);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address market = address(0x1EA5E);
    address attacker = address(0xBAD);

    function setUp() public {
        accessControl = new BreezeAccessControl(admin);
        accessControl.grantRole(accessControl.PAUSER_ROLE(), pauser);

        token = new VaultToken();
        vault = new BreezeLiquidityVault(token, address(accessControl), "Breeze LP", "bLP");

        vault.setMarketAuthorization(market, true);

        token.mint(alice, 1_000_000e18);
        token.mint(bob, 1_000_000e18);
        token.mint(market, 1_000_000e18);
        token.mint(attacker, 1_000_000e18);

        vm.prank(alice);
        token.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        token.approve(address(vault), type(uint256).max);
        vm.prank(market);
        token.approve(address(vault), type(uint256).max);
        vm.prank(attacker);
        token.approve(address(vault), type(uint256).max);
    }

    function _deposit(address who, uint256 amount) internal returns (uint256 shares) {
        vm.prank(who);
        return vault.deposit(amount, who);
    }

    /// LPs must serve the withdrawal cooldown before exiting. Tests that are not
    /// about the cooldown itself use this to get past it.
    function _readyToWithdraw(address who) internal {
        vm.prank(who);
        vault.requestWithdrawal();
        vm.warp(block.timestamp + vault.withdrawalCooldown());
    }

    // ---------------------------------------------------------------
    // Core LP accounting
    // ---------------------------------------------------------------

    function test_deposit_then_withdraw_round_trip() public {
        uint256 before = token.balanceOf(alice);
        uint256 shares = _deposit(alice, 100_000e18);

        _readyToWithdraw(alice);

        vm.prank(alice);
        vault.redeem(shares, alice, alice);

        assertApproxEqAbs(token.balanceOf(alice), before, 1, "round trip lost value");
    }

    function test_absorbed_profit_raises_share_value_once_vested() public {
        uint256 shares = _deposit(alice, 100_000e18);
        uint256 valueBefore = vault.convertToAssets(shares);

        vm.prank(market);
        vault.absorbProfit(10_000e18);

        // Deliberately NOT recognised on receipt — that would let an LP deposit
        // just before profit lands and withdraw straight after, taking the gain
        // without ever carrying the risk.
        assertApproxEqAbs(
            vault.convertToAssets(shares), valueBefore, 1, "profit recognised instantly"
        );

        vm.warp(block.timestamp + vault.profitUnlockPeriod() + 1);
        assertGt(vault.convertToAssets(shares), valueBefore, "profit never recognised");
    }

    function test_covered_loss_lowers_share_value() public {
        uint256 shares = _deposit(alice, 100_000e18);
        uint256 valueBefore = vault.convertToAssets(shares);

        vm.prank(market);
        vault.coverLoss(10_000e18);

        assertLt(vault.convertToAssets(shares), valueBefore, "loss did not lower share value");
    }

    function test_two_lps_share_profit_proportionally() public {
        uint256 aliceShares = _deposit(alice, 100_000e18);
        uint256 bobShares = _deposit(bob, 300_000e18);

        vm.prank(market);
        vault.absorbProfit(40_000e18);

        uint256 aliceGain = vault.convertToAssets(aliceShares) - 100_000e18;
        uint256 bobGain = vault.convertToAssets(bobShares) - 300_000e18;

        // Bob supplied 3x the capital and must earn ~3x the profit.
        assertApproxEqRel(bobGain, aliceGain * 3, 1e12, "profit split not proportional");
    }

    // ---------------------------------------------------------------
    // Reservation mechanics
    // ---------------------------------------------------------------

    function test_reserve_reduces_available_liquidity() public {
        _deposit(alice, 100_000e18);

        vm.prank(market);
        vault.reserve(30_000e18);

        assertEq(vault.totalReserved(), 30_000e18);
        // Two floors apply and the tighter one binds. The 80% aggregate cap would
        // require retaining 30k/0.8 = 37.5k, but a single market may hold at most
        // 50% of the pool, so 30k reserved requires 30k/0.5 = 60k retained. The
        // concentration floor is the binding one here, leaving 40k free.
        //
        // This test previously expected 37.5k, which allowed the pool to shrink
        // until the one market held 80% of it — breaching the very concentration
        // cap `reserve()` had enforced on the way in.
        assertEq(vault.minRequiredAssets(), 60_000e18);
        assertEq(vault.availableLiquidity(), 40_000e18);
    }

    function test_withdrawals_cannot_breach_the_utilisation_cap() public {
        _deposit(alice, 100_000e18);
        vm.prank(market);
        vault.reserve(30_000e18);

        uint256 free = vault.availableLiquidity();
        _readyToWithdraw(alice);
        vm.prank(alice);
        vault.withdraw(free, alice, alice);

        // Reserved capital is still within the cap after the withdrawal.
        uint256 utilization = (vault.totalReserved() * 10000) / vault.totalAssets();
        assertLe(utilization, vault.maxUtilizationBps(), "withdrawal breached the cap");
    }

    function test_release_restores_available_liquidity() public {
        _deposit(alice, 100_000e18);

        vm.startPrank(market);
        vault.reserve(30_000e18);
        vault.release(30_000e18);
        vm.stopPrank();

        assertEq(vault.totalReserved(), 0);
        assertEq(vault.availableLiquidity(), 100_000e18);
    }

    function test_lp_cannot_withdraw_reserved_capital() public {
        _deposit(alice, 100_000e18);

        // 50% is the single-market concentration ceiling.
        vm.prank(market);
        vault.reserve(50_000e18);

        _readyToWithdraw(alice);

        // 50k reserved is already the 50% concentration ceiling on a 100k pool, so
        // the pool cannot shrink at all without breaching it. Nothing is withdrawable.
        assertEq(vault.maxWithdraw(alice), 0);

        vm.prank(alice);
        vm.expectRevert();
        vault.withdraw(1, alice, alice);
    }

    function test_lp_can_withdraw_up_to_available() public {
        _deposit(alice, 100_000e18);

        // 30k reserved: concentration floor is 60k, so 40k is withdrawable.
        vm.prank(market);
        vault.reserve(30_000e18);

        _readyToWithdraw(alice);

        uint256 free = vault.availableLiquidity();
        assertEq(free, 40_000e18);

        vm.prank(alice);
        vault.withdraw(free, alice, alice);

        assertEq(vault.availableLiquidity(), 0);
    }

    function test_reserve_respects_utilization_cap() public {
        _deposit(alice, 100_000e18);

        // Default cap is 80%.
        assertEq(vault.reservableLiquidity(), 80_000e18);

        vm.prank(market);
        vm.expectRevert(BreezeLiquidityVault.ExceedsUtilizationCap.selector);
        vault.reserve(80_000e18 + 1);
    }

    function test_single_market_cannot_exceed_concentration_cap() public {
        _deposit(alice, 100_000e18);
        vault.setMaxUtilizationBps(9000);

        // Utilisation allows 90k, but one market is capped at 50%.
        vm.prank(market);
        vm.expectRevert(BreezeLiquidityVault.ExceedsSingleMarketCap.selector);
        vault.reserve(50_000e18 + 1);
    }

    function test_release_more_than_reserved_reverts() public {
        _deposit(alice, 100_000e18);

        vm.startPrank(market);
        vault.reserve(10_000e18);
        vm.expectRevert(BreezeLiquidityVault.ReleaseExceedsReserved.selector);
        vault.release(10_000e18 + 1);
        vm.stopPrank();
    }

    function test_cover_loss_is_capped_at_pool_assets() public {
        _deposit(alice, 10_000e18);

        vm.prank(market);
        uint256 covered = vault.coverLoss(999_999e18);

        assertEq(covered, 10_000e18, "covered more than the pool held");
        assertEq(vault.totalAssets(), 0);
    }

    // ---------------------------------------------------------------
    // Access control
    // ---------------------------------------------------------------

    function test_unauthorized_market_cannot_reserve() public {
        _deposit(alice, 100_000e18);
        vm.prank(attacker);
        vm.expectRevert(BreezeLiquidityVault.UnauthorizedCaller.selector);
        vault.reserve(1e18);
    }

    function test_unauthorized_market_cannot_cover_loss() public {
        _deposit(alice, 100_000e18);
        vm.prank(attacker);
        vm.expectRevert(BreezeLiquidityVault.UnauthorizedCaller.selector);
        vault.coverLoss(1e18);
    }

    function test_unauthorized_market_cannot_release() public {
        _deposit(alice, 100_000e18);
        vm.prank(market);
        vault.reserve(10_000e18);

        vm.prank(attacker);
        vm.expectRevert(BreezeLiquidityVault.UnauthorizedCaller.selector);
        vault.release(10_000e18);
    }

    function test_deauthorized_market_loses_access() public {
        _deposit(alice, 100_000e18);
        vault.setMarketAuthorization(market, false);

        vm.prank(market);
        vm.expectRevert(BreezeLiquidityVault.UnauthorizedCaller.selector);
        vault.coverLoss(1e18);
    }

    function test_non_admin_cannot_authorize_market() public {
        vm.prank(attacker);
        vm.expectRevert(BreezeLiquidityVault.UnauthorizedCaller.selector);
        vault.setMarketAuthorization(attacker, true);
    }

    function test_non_admin_cannot_change_utilization() public {
        vm.prank(attacker);
        vm.expectRevert(BreezeLiquidityVault.UnauthorizedCaller.selector);
        vault.setMaxUtilizationBps(9000);
    }

    function test_utilization_cannot_exceed_immutable_ceiling() public {
        uint256 ceiling = vault.MAX_UTILIZATION_CEILING_BPS();
        vm.expectRevert(BreezeLiquidityVault.InvalidUtilization.selector);
        vault.setMaxUtilizationBps(ceiling + 1);
    }

    function test_non_pauser_cannot_pause() public {
        vm.prank(attacker);
        vm.expectRevert(BreezeLiquidityVault.UnauthorizedCaller.selector);
        vault.pauseDeposits();
    }

    // ---------------------------------------------------------------
    // Pause discipline — must never trap LP funds
    // ---------------------------------------------------------------

    function test_pause_blocks_deposits() public {
        vm.prank(pauser);
        vault.pauseDeposits();

        assertEq(vault.maxDeposit(alice), 0);
        vm.prank(alice);
        vm.expectRevert();
        vault.deposit(1_000e18, alice);
    }

    function test_pause_never_traps_lp_funds() public {
        uint256 shares = _deposit(alice, 100_000e18);

        vm.prank(pauser);
        vault.pauseDeposits();

        // Withdrawal path must remain fully open while paused.
        uint256 before = token.balanceOf(alice);
        _readyToWithdraw(alice);
        vm.prank(alice);
        vault.redeem(shares, alice, alice);

        assertApproxEqAbs(token.balanceOf(alice) - before, 100_000e18, 1, "paused vault trapped funds");
    }

    function test_unpause_restores_deposits() public {
        vm.prank(pauser);
        vault.pauseDeposits();
        vm.prank(pauser);
        vault.unpauseDeposits();

        _deposit(alice, 1_000e18);
        assertGt(vault.balanceOf(alice), 0);
    }

    // ---------------------------------------------------------------
    // Premium recognition
    // ---------------------------------------------------------------

    /// The attack this mechanism exists to stop: arrive just before profit
    /// lands, leave just after, and pocket it having borne no risk.
    function test_sandwiching_a_profit_event_captures_nothing() public {
        _deposit(alice, 100_000e18);

        uint256 before = token.balanceOf(bob);
        _deposit(bob, 100_000e18);

        vm.prank(market);
        vault.absorbProfit(50_000e18);

        uint256 redeemable = vault.maxRedeem(bob);
        _readyToWithdraw(bob);
        vm.prank(bob);
        vault.redeem(redeemable, bob, bob);

        assertLe(token.balanceOf(bob), before, "extracted profit without carrying risk");
    }

    /// A patient LP who holds through the vesting period does earn it.
    function test_holding_through_vesting_earns_the_profit() public {
        uint256 shares = _deposit(alice, 100_000e18);

        vm.prank(market);
        vault.absorbProfit(10_000e18);

        vm.warp(block.timestamp + vault.profitUnlockPeriod() + 1);
        assertApproxEqRel(
            vault.convertToAssets(shares), 110_000e18, 1e15, "patient LP did not earn the profit"
        );
    }

    function test_locked_profit_decays_linearly() public {
        _deposit(alice, 100_000e18);
        vm.prank(market);
        vault.absorbProfit(10_000e18);

        assertApproxEqRel(vault.lockedProfitRemaining(), 10_000e18, 1e15);

        vm.warp(block.timestamp + vault.profitUnlockPeriod() / 2);
        assertApproxEqRel(vault.lockedProfitRemaining(), 5_000e18, 1e15, "not decaying linearly");

        vm.warp(block.timestamp + vault.profitUnlockPeriod());
        assertEq(vault.lockedProfitRemaining(), 0);
    }

    function test_locked_profit_is_excluded_from_total_assets() public {
        _deposit(alice, 100_000e18);
        vm.prank(market);
        vault.absorbProfit(10_000e18);

        assertEq(token.balanceOf(address(vault)), 110_000e18, "tokens not received");
        assertApproxEqAbs(vault.totalAssets(), 100_000e18, 1, "unearned profit counted as LP value");
    }

    function test_unearned_profit_is_not_withdrawable() public {
        _deposit(alice, 100_000e18);
        vm.prank(market);
        vault.absorbProfit(10_000e18);

        // Serve the cooldown so the limit reflects unvested profit, not the wait.
        vm.prank(alice);
        vault.requestWithdrawal();
        vm.warp(block.timestamp + vault.withdrawalCooldown());

        // The cooldown is shorter than the unlock period, so profit is still
        // partly unvested here and must not be withdrawable.
        assertLt(vault.maxWithdraw(alice), 110_000e18, "unearned profit was withdrawable");
        assertGe(vault.maxWithdraw(alice), 100_000e18, "principal was withheld");
    }

    function test_loss_consumes_unearned_profit_first() public {
        _deposit(alice, 100_000e18);
        vm.prank(market);
        vault.absorbProfit(10_000e18);
        assertGt(vault.lockedProfitRemaining(), 0);

        vm.prank(market);
        vault.coverLoss(10_000e18);

        assertEq(vault.lockedProfitRemaining(), 0, "loss skipped unearned profit");
    }

    function test_loss_can_draw_on_tokens_backing_unearned_profit() public {
        _deposit(alice, 10_000e18);
        vm.prank(market);
        vault.absorbProfit(10_000e18);

        // Only 10k is recognised, but 20k is held and all of it backs claims.
        vm.prank(market);
        uint256 covered = vault.coverLoss(20_000e18);

        assertEq(covered, 20_000e18, "claim could not reach unearned premium");
    }

    function test_second_profit_does_not_accelerate_the_first() public {
        _deposit(alice, 100_000e18);

        vm.prank(market);
        vault.absorbProfit(10_000e18);
        vm.warp(block.timestamp + 1 days);
        uint256 remaining = vault.lockedProfitRemaining();

        vm.prank(market);
        vault.absorbProfit(10_000e18);

        assertGe(vault.lockedProfitRemaining(), remaining, "earlier profit vested early");
    }

    function test_unlock_period_bounds_are_enforced() public {
        // Resolve bounds first — expectRevert binds to the next call, which
        // would otherwise be the getter rather than the setter.
        uint256 tooShort = vault.MIN_PROFIT_UNLOCK_PERIOD() - 1;
        uint256 tooLong = vault.MAX_PROFIT_UNLOCK_PERIOD() + 1;

        vm.expectRevert(BreezeLiquidityVault.InvalidUnlockPeriod.selector);
        vault.setProfitUnlockPeriod(tooShort);

        vm.expectRevert(BreezeLiquidityVault.InvalidUnlockPeriod.selector);
        vault.setProfitUnlockPeriod(tooLong);
    }

    function test_non_admin_cannot_change_unlock_period() public {
        vm.prank(attacker);
        vm.expectRevert(BreezeLiquidityVault.UnauthorizedCaller.selector);
        vault.setProfitUnlockPeriod(30 days);
    }

    function testFuzz_locked_profit_never_exceeds_absorbed(uint256 amount, uint256 elapsed) public {
        amount = bound(amount, 1e18, 500_000e18);
        elapsed = bound(elapsed, 0, 60 days);

        _deposit(alice, 500_000e18);
        vm.prank(market);
        vault.absorbProfit(amount);

        vm.warp(block.timestamp + elapsed);
        assertLe(vault.lockedProfitRemaining(), amount);
    }

    // ---------------------------------------------------------------
    // Withdrawal cooldown
    // ---------------------------------------------------------------

    /// @dev Surfaces as the standard ERC4626 max-exceeded error rather than the
    /// inner guard, because `maxRedeem` correctly reports zero during a cooldown.
    /// The inner `WithdrawalNotRequested` check remains as defence in depth.
    function test_withdrawal_requires_a_request_first() public {
        uint256 shares = _deposit(alice, 100_000e18);

        assertEq(vault.maxRedeem(alice), 0, "quoted a redeem that cannot execute");

        vm.prank(alice);
        vm.expectRevert();
        vault.redeem(shares, alice, alice);
    }

    function test_withdrawal_blocked_until_the_cooldown_elapses() public {
        _deposit(alice, 100_000e18);

        vm.prank(alice);
        vault.requestWithdrawal();

        vm.warp(block.timestamp + vault.withdrawalCooldown() - 1);
        assertFalse(vault.canWithdraw(alice));

        vm.prank(alice);
        vm.expectRevert();
        vault.withdraw(1_000e18, alice, alice);

        vm.warp(block.timestamp + 1);
        assertTrue(vault.canWithdraw(alice));
    }

    /// The attack the cooldown exists to stop: a claim's triggering oracle
    /// reading is public before settlement, so without a delay an informed LP
    /// exits ahead of the loss and leaves it with whoever stayed.
    function test_lp_cannot_exit_between_learning_of_a_loss_and_it_landing() public {
        _deposit(alice, 100_000e18);

        // Alice learns a loss is coming and tries to leave now.
        vm.prank(alice);
        vault.requestWithdrawal();

        // The loss lands during the cooldown.
        vm.prank(market);
        vault.coverLoss(20_000e18);

        vm.warp(block.timestamp + vault.withdrawalCooldown());
        _readyToWithdraw(alice);
        uint256 redeemable = vault.maxRedeem(alice);
        vm.prank(alice);
        vault.redeem(redeemable, alice, alice);

        assertLt(token.balanceOf(alice), 1_000_000e18, "LP escaped the loss it saw coming");
    }

    /// A partial exit draws the claim down rather than voiding it, so an LP is
    /// not forced into a fresh wait for the remainder of what they already
    /// queued. The claim is still finite and still expires.
    function test_partial_withdrawal_draws_down_the_claim() public {
        uint256 shares = _deposit(alice, 100_000e18);
        _readyToWithdraw(alice);

        vm.prank(alice);
        uint256 burned = vault.withdraw(10_000e18, alice, alice);

        (uint256 remaining,,) = vault.withdrawalRequests(alice);
        assertEq(remaining, shares - burned, "claim not drawn down correctly");

        vm.prank(alice);
        vault.withdraw(10_000e18, alice, alice);
    }

    /// The cooldown is keyed to the owner, so an approved spender cannot be used
    /// to sidestep the owner's wait.
    function test_approved_spender_cannot_bypass_the_owner_cooldown() public {
        uint256 shares = _deposit(alice, 100_000e18);

        vm.prank(alice);
        vault.approve(bob, type(uint256).max);

        // Bob having served no cooldown is irrelevant; the limit follows `alice`.
        assertEq(vault.maxRedeem(alice), 0);

        vm.prank(bob);
        vm.expectRevert();
        vault.redeem(shares, bob, alice);
    }

    /// The bypass that defeated the first version: shares are ordinary ERC20 and
    /// requesting costs nothing, so an empty address could be warmed in advance,
    /// handed shares later, and redeem instantly. Binding the request to shares
    /// held at request time makes a pre-warmed address worth nothing.
    function test_prewarmed_address_cannot_redeem_shares_it_was_handed() public {
        // Bob warms up holding nothing.
        vm.prank(bob);
        vault.requestWithdrawal();
        vm.warp(block.timestamp + vault.withdrawalCooldown());

        // Alice deposits and hands her shares over, having waited for nothing.
        uint256 shares = _deposit(alice, 100_000e18);
        vm.prank(alice);
        vault.transfer(bob, shares);

        assertEq(vault.maxRedeem(bob), 0, "pre-warmed address could redeem");
        vm.prank(bob);
        vm.expectRevert();
        vault.redeem(shares, bob, bob);
    }

    /// Transferring shares out must not carry a matured claim with them.
    function test_transferring_shares_cancels_a_matured_request() public {
        uint256 shares = _deposit(alice, 100_000e18);
        _readyToWithdraw(alice);
        assertGt(vault.maxRedeem(alice), 0);

        vm.prank(alice);
        vault.transfer(bob, shares / 2);

        assertEq(vault.maxRedeem(alice), 0, "claim survived a share transfer");
    }

    /// Without an expiry, every LP would request once on deposit and hold a
    /// permanent standing exit — exactly the freedom the cooldown removes.
    function test_request_expires_after_its_window() public {
        _deposit(alice, 100_000e18);

        vm.prank(alice);
        vault.requestWithdrawal();
        vm.warp(block.timestamp + vault.withdrawalCooldown());
        assertTrue(vault.canWithdraw(alice), "request never matured");

        vm.warp(block.timestamp + vault.WITHDRAWAL_WINDOW() + 1);
        assertFalse(vault.canWithdraw(alice), "request never expires");
        assertEq(vault.maxRedeem(alice), 0);
    }

    function test_stale_request_cannot_be_used_when_news_breaks() public {
        _deposit(alice, 100_000e18);
        _deposit(bob, 100_000e18);

        // Alice queues an exit on day zero and sits on it.
        vm.prank(alice);
        vault.requestWithdrawal();
        vm.warp(block.timestamp + 200 days);

        // A loss becomes known. Her old request must not still be live.
        assertEq(vault.maxRedeem(alice), 0, "stale request was still a live exit");
    }

    function test_shares_acquired_after_requesting_are_not_covered() public {
        uint256 first = _deposit(alice, 50_000e18);

        vm.prank(alice);
        vault.requestWithdrawal();
        vm.warp(block.timestamp + vault.withdrawalCooldown());

        // Topping up after the request must not extend the claim to new shares.
        _deposit(alice, 50_000e18);

        assertEq(vault.maxRedeem(alice), first, "unwaited shares became redeemable");
    }

    /// Expiry must never become a trap: a lapsed request can always be renewed.
    /// This is the property that keeps the cooldown a delay rather than a lock.
    function test_expired_request_can_always_be_renewed() public {
        uint256 shares = _deposit(alice, 100_000e18);

        vm.prank(alice);
        vault.requestWithdrawal();
        vm.warp(block.timestamp + vault.withdrawalCooldown() + vault.WITHDRAWAL_WINDOW() + 1);
        assertFalse(vault.canWithdraw(alice));

        _readyToWithdraw(alice);
        vm.prank(alice);
        vault.redeem(shares, alice, alice);

        assertApproxEqAbs(token.balanceOf(alice), 1_000_000e18, 1, "LP could not exit after expiry");
    }

    /// An admin lengthening the cooldown must not retroactively freeze someone
    /// who already started waiting.
    function test_raising_the_cooldown_does_not_freeze_pending_requests() public {
        _deposit(alice, 100_000e18);

        vm.prank(alice);
        vault.requestWithdrawal();

        vault.setWithdrawalCooldown(14 days);

        vm.warp(block.timestamp + 3 days);
        assertTrue(vault.canWithdraw(alice), "pending request was retroactively extended");
    }

    function test_max_withdraw_reports_zero_during_cooldown() public {
        _deposit(alice, 100_000e18);
        assertEq(vault.maxWithdraw(alice), 0, "quoted an amount that would revert");
        assertEq(vault.maxRedeem(alice), 0);
    }

    function test_pause_does_not_extend_the_cooldown() public {
        uint256 shares = _deposit(alice, 100_000e18);
        _readyToWithdraw(alice);

        vm.prank(pauser);
        vault.pauseDeposits();

        // Pausing must never trap funds, cooldown or not.
        vm.prank(alice);
        vault.redeem(shares, alice, alice);
        assertGt(token.balanceOf(alice), 900_000e18);
    }

    function test_cooldown_is_bounded() public {
        uint256 tooLong = vault.MAX_WITHDRAWAL_COOLDOWN() + 1;
        vm.expectRevert(BreezeLiquidityVault.InvalidCooldown.selector);
        vault.setWithdrawalCooldown(tooLong);
    }

    function test_admin_can_disable_the_cooldown() public {
        vault.setWithdrawalCooldown(0);
        uint256 shares = _deposit(alice, 100_000e18);

        vm.prank(alice);
        vault.redeem(shares, alice, alice);
        assertTrue(vault.canWithdraw(alice));
    }

    function test_non_admin_cannot_change_the_cooldown() public {
        vm.prank(attacker);
        vm.expectRevert(BreezeLiquidityVault.UnauthorizedCaller.selector);
        vault.setWithdrawalCooldown(0);
    }

    // ---------------------------------------------------------------
    // Share inflation
    // ---------------------------------------------------------------

    /// Classic ERC4626 first-depositor attack: seed 1 wei, donate a large amount
    /// directly, then let a victim deposit and try to capture their principal.
    function test_first_depositor_inflation_attack_is_uneconomic() public {
        vm.prank(attacker);
        vault.deposit(1, attacker);

        // Direct donation, bypassing deposit accounting.
        vm.prank(attacker);
        token.transfer(address(vault), 100_000e18);

        uint256 victimAssets = 50_000e18;
        uint256 victimShares = _deposit(bob, victimAssets);

        assertGt(victimShares, 0, "victim received zero shares");

        // The victim must be able to recover essentially all of their deposit.
        uint256 recoverable = vault.convertToAssets(victimShares);
        assertGe(recoverable, (victimAssets * 999) / 1000, "victim lost principal to inflation");
    }
}
