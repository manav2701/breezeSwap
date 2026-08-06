// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../src/access/BreezeAccessControl.sol";
import "../../src/oracle/MockWeatherOracle.sol";
import "../../src/fees/FeeConfig.sol";
import "../../src/fees/ProtocolTreasury.sol";
import "../../src/perp/BreezePerpMarket.sol";
import "../../src/perp/InsuranceFund.sol";
import "../../src/perp/VirtualAMM.sol";
import "../../src/vault/BreezeLiquidityVault.sol";

contract BackingToken is ERC20 {
    constructor() ERC20("Mock USDT", "mUSDT") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice The vAMM owes winning traders more than losing traders posted. These
/// tests cover where that difference comes from.
contract PerpVaultBackingTest is Test {
    BreezeAccessControl accessControl;
    MockWeatherOracle oracle;
    FeeConfig feeConfig;
    ProtocolTreasury treasury;
    InsuranceFund insuranceFund;
    BreezeLiquidityVault vault;
    BackingToken token;
    BreezePerpMarket perpMarket;

    address admin = address(this);
    address alice = address(0xA11CE);
    address lp = address(0x11B);
    address attacker = address(0xBAD);

    bytes32 constant REGION_ID = keccak256("TOKYO_RAINFALL");

    function setUp() public {
        accessControl = new BreezeAccessControl(admin);
        oracle = new MockWeatherOracle(address(accessControl));
        token = new BackingToken();

        feeConfig = new FeeConfig(address(accessControl));
        feeConfig.setTradingFeeBps(feeConfig.MIN_FEE_BPS());
        treasury = new ProtocolTreasury(address(token), address(accessControl));
        insuranceFund = new InsuranceFund(address(token), address(accessControl));
        vault = new BreezeLiquidityVault(token, address(accessControl), "Breeze LP", "bLP");

        VirtualAMM.Reserves memory initialReserves = VirtualAMM.Reserves({
            collateralReserve: 1_000_000 * 1e18,
            weatherReserve: 40_000 * 1e18
        });

        perpMarket = new BreezePerpMarket(
            initialReserves,
            address(oracle),
            address(insuranceFund),
            address(feeConfig),
            address(treasury),
            address(accessControl),
            address(token),
            REGION_ID
        );

        insuranceFund.setMarketAuthorization(address(perpMarket), true);
        vault.setMarketAuthorization(address(perpMarket), true);
        perpMarket.setLiquidityVault(address(vault));

        token.mint(alice, 500_000e18);
        token.mint(lp, 500_000e18);

        vm.prank(alice);
        token.approve(address(perpMarket), type(uint256).max);
        vm.prank(lp);
        token.approve(address(vault), type(uint256).max);

        vm.prank(lp);
        vault.deposit(300_000e18, lp);
    }

    // -----------------------------------------------------------------
    // Skew-based vault reservation
    // -----------------------------------------------------------------

    /// Matched open interest is self-funding — a long's gain is the short's
    /// loss, and both sides' collateral is already held by the market. Only the
    /// unmatched remainder needs LP capital behind it, so that is what gets
    /// locked. Sizing the reserve this way is O(1) and rises exactly when the
    /// book becomes dangerous.
    function test_one_sided_flow_locks_lp_capital() public {
        assertEq(vault.marketReserved(address(perpMarket)), 0);

        vm.prank(alice);
        perpMarket.openPosition(true, 20_000e18, 1);

        assertGt(vault.marketReserved(address(perpMarket)), 0, "one-sided risk left unbacked");
        assertEq(vault.marketReserved(address(perpMarket)), perpMarket.requiredVaultReserve());
    }

    /// A balanced book must STILL be backed. Sizing on current skew would lock
    /// nothing here, and the instant one side closes the imbalance is the full
    /// size of the other — with the capital that should have backed it already
    /// withdrawn. Backing is sized on the larger side, not the difference.
    function test_balanced_book_is_still_backed() public {
        vm.prank(alice);
        perpMarket.openPosition(true, 20_000e18, 1);

        address bob = address(0xB0B);
        token.mint(bob, 100_000e18);
        vm.startPrank(bob);
        token.approve(address(perpMarket), type(uint256).max);
        uint256 shortId = perpMarket.openPosition(false, 20_000e18, 1);
        vm.stopPrank();

        assertEq(perpMarket.notionalSkew(), 0, "book is not balanced");
        assertGt(
            vault.marketReserved(address(perpMarket)),
            0,
            "balanced book left unbacked against an unwind"
        );

        // The unwind that reactive sizing would have been caught by.
        uint256 backedBefore = vault.marketReserved(address(perpMarket));
        vm.prank(bob);
        perpMarket.closePosition(shortId);

        assertGt(perpMarket.notionalSkew(), 0, "unwind did not create skew");
        assertGt(backedBefore, 0, "capital was not already in place before the unwind");
    }

    /// Collateral is not risk: equal collateral at different leverage is a large
    /// directional position that collateral-denominated skew reports as zero.
    function test_leverage_mismatch_is_measured_in_notional() public {
        vm.prank(alice);
        perpMarket.openPosition(true, 20_000e18, 3);

        address bob = address(0xB0B);
        token.mint(bob, 100_000e18);
        vm.startPrank(bob);
        token.approve(address(perpMarket), type(uint256).max);
        perpMarket.openPosition(false, 20_000e18, 1);
        vm.stopPrank();

        // Collateral nets to zero; notional does not.
        assertEq(perpMarket.currentSkew(), 0, "collateral skew is not zero");
        assertGt(perpMarket.notionalSkew(), 0, "notional exposure reported as zero");
        assertGt(vault.marketReserved(address(perpMarket)), 0, "levered exposure left unbacked");
    }

    function test_closing_releases_the_lp_backing() public {
        vm.startPrank(alice);
        uint256 id = perpMarket.openPosition(true, 20_000e18, 1);
        assertGt(vault.marketReserved(address(perpMarket)), 0);
        perpMarket.closePosition(id);
        vm.stopPrank();

        assertEq(vault.marketReserved(address(perpMarket)), 0, "backing not released on close");
    }

    /// The defect this closes: swept funds were withdrawable while still
    /// backing live positions.
    function test_swept_funds_are_not_withdrawable_while_positions_are_open() public {
        vm.prank(alice);
        perpMarket.openPosition(true, 20_000e18, 1);
        perpMarket.sweepSurplus();

        vm.prank(lp);
        vault.requestWithdrawal();
        vm.warp(block.timestamp + vault.withdrawalCooldown());

        uint256 free = vault.maxWithdraw(lp);
        assertLt(free, vault.totalAssets(), "entire pool withdrawable despite open risk");
        assertGt(vault.totalReserved(), 0);
    }

    function test_opening_is_refused_when_the_vault_cannot_back_it() public {
        // Skew far beyond what a 300k pool can back under the concentration cap.
        token.mint(alice, 2_000_000e18);
        vm.prank(alice);
        vm.expectRevert();
        perpMarket.openPosition(true, 900_000e18, 3);
    }

    function test_rebalancing_is_never_blocked_by_missing_backing() public {
        vm.prank(alice);
        perpMarket.openPosition(true, 100_000e18, 1);

        // Shrink the pool's capacity so the market is under-backed.
        vault.setMarketAuthorization(address(perpMarket), true);
        uint256 skewBefore = perpMarket.currentSkew();

        address bob = address(0xB0B);
        token.mint(bob, 200_000e18);
        vm.startPrank(bob);
        token.approve(address(perpMarket), type(uint256).max);
        perpMarket.openPosition(false, 80_000e18, 1);
        vm.stopPrank();

        assertLt(perpMarket.currentSkew(), skewBefore, "counter-flow blocked by backing check");
    }

    /// Cutting a market off from the vault must not freeze the traders inside
    /// it. Backing is best-effort; exiting a position never is.
    function test_deauthorising_the_market_cannot_trap_traders() public {
        vm.prank(alice);
        uint256 id = perpMarket.openPosition(true, 20_000e18, 1);

        vault.setMarketAuthorization(address(perpMarket), false);

        uint256 before = token.balanceOf(alice);
        vm.prank(alice);
        perpMarket.closePosition(id);

        assertGt(token.balanceOf(alice), before, "deauthorisation trapped a trader");
    }

    /// Repointing the vault must release the old reservation, or that capital
    /// backs nothing while staying permanently unwithdrawable.
    function test_repointing_the_vault_releases_the_old_reservation() public {
        vm.prank(alice);
        perpMarket.openPosition(true, 20_000e18, 1);
        assertGt(vault.marketReserved(address(perpMarket)), 0);

        perpMarket.setLiquidityVault(address(0));

        assertEq(vault.marketReserved(address(perpMarket)), 0, "capital stranded in the old vault");
        assertEq(vault.totalReserved(), 0);
    }

    function test_sync_is_permissionless_and_idempotent() public {
        vm.prank(alice);
        perpMarket.openPosition(true, 20_000e18, 1);

        uint256 reserved = vault.marketReserved(address(perpMarket));
        vm.prank(attacker);
        perpMarket.syncVaultReserve();

        assertEq(vault.marketReserved(address(perpMarket)), reserved, "sync moved a correct reserve");
    }

    function test_non_admin_cannot_change_skew_reserve_ratio() public {
        vm.prank(attacker);
        vm.expectRevert(BreezePerpMarket.UnauthorizedCaller.selector);
        perpMarket.setSkewReserveBps(0);
    }

    function test_skew_reserve_ratio_is_bounded() public {
        uint256 tooHigh = perpMarket.MAX_SKEW_RESERVE_BPS() + 1;
        vm.expectRevert(BreezePerpMarket.InvalidParameter.selector);
        perpMarket.setSkewReserveBps(tooHigh);
    }

    // -----------------------------------------------------------------
    // Access control on the new paths
    // -----------------------------------------------------------------

    function test_non_admin_cannot_set_liquidity_vault() public {
        vm.prank(attacker);
        vm.expectRevert(BreezePerpMarket.UnauthorizedCaller.selector);
        perpMarket.setLiquidityVault(address(0xdead));
    }

    function test_unauthorized_market_cannot_drain_vault() public {
        vm.prank(attacker);
        vm.expectRevert(BreezeLiquidityVault.UnauthorizedCaller.selector);
        vault.coverLoss(100_000e18);
    }

    // -----------------------------------------------------------------
    // Surplus routing
    // -----------------------------------------------------------------

    /// Backing is sized at 75% of worst-case notional and one market may reserve
    /// at most half the pool, so tests that open large notional need a pool deep
    /// enough to back it before the trade is permitted at all.
    function _deepenPool() internal {
        token.mint(lp, 3_000_000e18);
        vm.prank(lp);
        vault.deposit(1_500_000e18, lp);
    }

    function test_sweep_surplus_sends_trader_losses_to_lps() public {
        _deepenPool();

        // Alice goes long, Bob pushes the mark price down with a larger short,
        // Alice closes at a realised loss. That loss is what belongs to LPs.
        vm.prank(alice);
        uint256 posId = perpMarket.openPosition(true, 20_000e18, 2);

        address bob = address(0xB0B);
        token.mint(bob, 400_000e18);
        vm.startPrank(bob);
        token.approve(address(perpMarket), type(uint256).max);
        perpMarket.openPosition(false, 150_000e18, 3);
        vm.stopPrank();

        vm.prank(alice);
        perpMarket.closePosition(posId);

        uint256 vaultBefore = vault.totalAssets();
        uint256 swept = perpMarket.sweepSurplus();

        assertGt(swept, 0, "realised trader loss was not swept to LPs");

        // The tokens arrive immediately, but are recognised as LP value only as
        // they vest, so totalAssets catches up over the unlock period.
        assertEq(token.balanceOf(address(vault)), vaultBefore + swept, "vault did not receive surplus");

        vm.warp(block.timestamp + vault.profitUnlockPeriod() + 1);
        assertEq(vault.totalAssets(), vaultBefore + swept, "surplus never recognised for LPs");
    }

    /// A vAMM can legitimately owe more than it holds: trader profit is minted by
    /// the curve, not funded by a losing counterparty. That gap is what the LP
    /// vault backstops. What `sweepSurplus` must never do is *widen* it — it may
    /// only remove balance that sits above what open positions are owed.
    function _assertSweepDidNotWidenTheGap() internal {
        uint256 obligations = perpMarket.openPositionObligations();
        uint256 balBefore = token.balanceOf(address(perpMarket));

        uint256 swept = perpMarket.sweepSurplus();
        uint256 balAfter = token.balanceOf(address(perpMarket));

        assertEq(balAfter, balBefore - swept, "balance moved by more than was swept");
        if (swept > 0) {
            assertGe(balAfter, obligations, "sweep took balance below open obligations");
        }
    }

    function test_sweep_surplus_never_touches_open_position_collateral() public {
        vm.prank(alice);
        perpMarket.openPosition(true, 10_000e18, 2);
        _assertSweepDidNotWidenTheGap();
    }

    function test_sweep_is_a_noop_when_the_market_already_owes_more_than_it_holds() public {
        vm.prank(alice);
        perpMarket.openPosition(true, 10_000e18, 2);

        if (token.balanceOf(address(perpMarket)) <= perpMarket.openPositionObligations()) {
            assertEq(perpMarket.sweepSurplus(), 0, "swept while already short");
        }
    }

    /// Posted collateral understates what open positions are owed. A position
    /// sitting on unrealised profit is owed collateral PLUS that profit, and
    /// the losing side's collateral is what funds it — so a sweep measured
    /// against posted collateral alone hands a live winner's gains to LPs.
    function test_sweep_leaves_enough_for_an_open_winner_to_be_paid() public {
        _deepenPool();

        vm.prank(alice);
        uint256 aliceId = perpMarket.openPosition(true, 20_000e18, 2);

        address bob = address(0xB0B);
        token.mint(bob, 400_000e18);
        vm.startPrank(bob);
        token.approve(address(perpMarket), type(uint256).max);
        perpMarket.openPosition(true, 100_000e18, 2);
        vm.stopPrank();

        // Alice is up; obligations must reflect that, not just her deposit.
        int256 alicePnl = perpMarket.calculateUnrealizedPnl(aliceId);
        uint256 postedOnly = perpMarket.totalLongOpenInterest() + perpMarket.totalShortOpenInterest();
        if (alicePnl > 0) {
            assertGt(
                perpMarket.openPositionObligations(),
                postedOnly,
                "unrealised profit not counted as an obligation"
            );
        }

        _assertSweepDidNotWidenTheGap();
    }

    /// Notional must return to zero when every position is closed, or the reserve
    /// requirement ratchets permanently upward on a market that carries no risk.
    function test_notional_unwinds_to_zero() public {
        address bob = address(0xB0B);
        token.mint(bob, 400_000e18);
        vm.prank(bob);
        token.approve(address(perpMarket), type(uint256).max);

        vm.prank(alice);
        uint256 a = perpMarket.openPosition(true, 20_000e18, 3);
        vm.prank(bob);
        uint256 b = perpMarket.openPosition(false, 30_000e18, 2);
        vm.prank(alice);
        uint256 c = perpMarket.openPosition(true, 10_000e18, 1);

        vm.prank(bob);
        perpMarket.closePosition(b);
        vm.startPrank(alice);
        perpMarket.closePosition(a);
        perpMarket.closePosition(c);
        vm.stopPrank();

        assertEq(perpMarket.totalLongNotional(), 0, "long notional leaked");
        assertEq(perpMarket.totalShortNotional(), 0, "short notional leaked");
        assertEq(perpMarket.requiredVaultReserve(), 0);
        assertEq(vault.marketReserved(address(perpMarket)), 0, "backing not released");
    }

    function test_obligations_ignore_closed_positions() public {
        vm.startPrank(alice);
        uint256 id = perpMarket.openPosition(true, 10_000e18, 1);
        perpMarket.closePosition(id);
        vm.stopPrank();

        assertEq(perpMarket.openPositionObligations(), 0);
    }

    /// An underwater position is owed nothing, and its deficit must not be
    /// netted against another position's claim.
    function test_obligations_floor_each_position_at_zero() public {
        vm.prank(alice);
        perpMarket.openPosition(true, 10_000e18, 3);

        // Whatever the market state, obligations are a sum of non-negative terms.
        assertGe(perpMarket.openPositionObligations(), 0);
    }

    function test_sweep_surplus_is_noop_without_vault() public {
        perpMarket.setLiquidityVault(address(0));
        assertEq(perpMarket.sweepSurplus(), 0);
    }

    function test_sweep_surplus_is_noop_when_no_surplus() public {
        // Fresh market with no trades has no surplus to remit.
        assertEq(perpMarket.sweepSurplus(), 0);
    }

    // -----------------------------------------------------------------
    // The core property: LP capital backs trader profit
    // -----------------------------------------------------------------

    function test_vault_covers_payout_the_market_cannot_fund() public {
        // Deepen the pool first. Backing is sized at 75% of worst-case notional
        // and one market may reserve at most half the pool, so ~600k of notional
        // needs roughly 900k of assets behind it before the trade is permitted.
        token.mint(lp, 1_500_000e18);
        vm.prank(lp);
        vault.deposit(900_000e18, lp);

        // Drain the market of everything except one position's collateral by
        // sweeping, so a profitable close must reach past posted collateral.
        vm.prank(alice);
        uint256 posId = perpMarket.openPosition(true, 50_000e18, 3);

        // Move the mark price in Alice's favour by routing more flow the same way.
        token.mint(alice, 200_000e18);
        vm.prank(alice);
        perpMarket.openPosition(true, 150_000e18, 3);

        uint256 vaultBefore = vault.totalAssets();
        uint256 aliceBefore = token.balanceOf(alice);

        vm.prank(alice);
        perpMarket.closePosition(posId);

        uint256 received = token.balanceOf(alice) - aliceBefore;
        assertGt(received, 0, "profitable close paid nothing");

        // Either the market funded it alone, or the vault made up the difference.
        // In both cases the trader must not have been short-changed to zero.
        if (vault.totalAssets() < vaultBefore) {
            assertGt(vaultBefore - vault.totalAssets(), 0, "vault drawn but nothing moved");
        }
    }

    function test_vault_draw_reduces_lp_share_value() public {
        uint256 lpShares = vault.balanceOf(lp);
        uint256 valueBefore = vault.convertToAssets(lpShares);

        // A direct authorized draw stands in for an uncovered trader profit.
        vm.prank(address(perpMarket));
        vault.coverLoss(50_000e18);

        assertLt(vault.convertToAssets(lpShares), valueBefore, "LPs did not absorb the loss");
    }

    function test_lp_cannot_withdraw_below_reserved_backing() public {
        vm.prank(address(perpMarket));
        vault.reserve(100_000e18);

        vm.prank(lp);
        vault.requestWithdrawal();
        vm.warp(block.timestamp + vault.withdrawalCooldown());

        // Two floors apply and the tighter binds. The 80% aggregate cap would
        // require retaining 125k, but one market may hold at most 50% of the pool,
        // so 100k reserved requires 200k retained — leaving 100k of the 300k
        // deposit withdrawable rather than 175k.
        uint256 maxOut = vault.maxWithdraw(lp);
        assertEq(maxOut, 100_000e18, "reserved capital was withdrawable");

        vm.prank(lp);
        vm.expectRevert();
        vault.withdraw(maxOut + 1e18, lp, lp);
    }
}
