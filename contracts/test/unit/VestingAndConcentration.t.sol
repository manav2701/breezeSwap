// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../src/access/BreezeAccessControl.sol";
import "../../src/vault/BreezeLiquidityVault.sol";
import "../../src/vault/JuniorTranche.sol";

contract VcToken is ERC20 {
    constructor() ERC20("Mock USDT", "mUSDT") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Two fixes that both come down to a constraint being enforced from one
/// side only.
///
/// The vesting clock reset on every absorb, so profit already part-way through
/// recognition had its full period restarted — anyone could defer LP profit
/// indefinitely with trivial absorbs.
///
/// The single-market concentration cap was checked when reserving and nowhere
/// else, so a market could pass it and then drift above its limit as LPs withdrew.
contract VestingAndConcentrationTest is Test {
    BreezeAccessControl accessControl;
    VcToken token;
    BreezeLiquidityVault vault;
    JuniorTranche junior;

    address admin = address(this);
    address alice = address(0xA11CE);
    address juniorLp = address(0x104E);
    address market = address(0x1EA5E);
    address market2 = address(0x2EA5E);

    function setUp() public {
        vm.warp(1_700_000_000);
        accessControl = new BreezeAccessControl(admin);
        token = new VcToken();
        vault = new BreezeLiquidityVault(token, address(accessControl), "Breeze LP", "bLP");
        junior = new JuniorTranche(token, address(accessControl), "Breeze Junior", "bJNR");

        vault.setMarketAuthorization(market, true);

        address[4] memory actors = [alice, juniorLp, market, admin];
        for (uint256 i = 0; i < actors.length; i++) {
            token.mint(actors[i], 10_000_000e18);
            vm.startPrank(actors[i]);
            token.approve(address(vault), type(uint256).max);
            token.approve(address(junior), type(uint256).max);
            vm.stopPrank();
        }
    }

    function _absorb(uint256 amount) internal {
        vm.prank(market);
        vault.absorbProfit(amount);
    }

    // =================================================================
    // Vesting clock
    // =================================================================

    /// The griefing vector, stated as a test: many small absorbs must not push the
    /// unlock further out than one honest absorb would have.
    function test_repeated_dust_absorbs_cannot_defer_recognition() public {
        vm.prank(alice);
        vault.deposit(100_000e18, alice);

        _absorb(10_000e18);
        uint256 honestUnlockEnd = vault.unlockEnd();

        // A griefer triggers 50 trivial absorbs spread across the vesting window.
        for (uint256 i = 0; i < 50; i++) {
            vm.warp(block.timestamp + 1 hours);
            _absorb(1e15); // 0.001 tokens against 10,000
        }

        // The deadline is value-weighted, so dust carries almost no weight. Allow a
        // little drift, but nothing like the 50 hours a reset per absorb would add.
        assertLt(
            vault.unlockEnd(),
            honestUnlockEnd + 2 hours,
            "dust absorbs deferred recognition - the clock still resets"
        );
    }

    /// Under the old model this was the whole exploit: absorb, wait almost the full
    /// period, absorb again, and the original profit is unvested once more.
    function test_a_late_absorb_does_not_unvest_earlier_profit() public {
        vm.prank(alice);
        vault.deposit(100_000e18, alice);

        _absorb(10_000e18);
        vm.warp(block.timestamp + 6 days); // 6 of 7 days elapsed

        uint256 recognisedBefore = vault.totalAssets();
        _absorb(10e18); // small, late

        // Recognition must not go backwards. The level is continuous across an
        // absorb, and the newly added amount is the only thing still locked.
        assertGe(
            vault.totalAssets(),
            recognisedBefore,
            "a later absorb un-recognised profit that had already vested"
        );
    }

    /// Continuity: adding profit must not instantly recognise part of it, which a
    /// naive value-weighted deadline without a stored span would do.
    function test_absorbing_does_not_instantly_recognise_the_new_amount() public {
        vm.prank(alice);
        vault.deposit(100_000e18, alice);

        _absorb(10_000e18);
        vm.warp(block.timestamp + 3 days);

        uint256 assetsBefore = vault.totalAssets();
        uint256 remainingBefore = vault.lockedProfitRemaining();

        _absorb(5_000e18);

        assertEq(vault.totalAssets(), assetsBefore, "new profit was recognised on arrival");
        assertEq(
            vault.lockedProfitRemaining(),
            remainingBefore + 5_000e18,
            "locked level is not continuous across an absorb"
        );
    }

    /// And it must still fully vest — a schedule that never completes is its own bug.
    function test_profit_still_fully_vests() public {
        vm.prank(alice);
        vault.deposit(100_000e18, alice);
        _absorb(10_000e18);

        vm.warp(block.timestamp + vault.profitUnlockPeriod() + 1);

        assertEq(vault.lockedProfitRemaining(), 0, "profit never finished vesting");
        assertEq(vault.totalAssets(), 110_000e18);
    }

    /// A claim consumes unrecognised profit but must not extend the schedule for
    /// what is left.
    function test_covering_a_loss_does_not_extend_the_vesting_deadline() public {
        vm.prank(alice);
        vault.deposit(100_000e18, alice);
        _absorb(10_000e18);

        uint256 endBefore = vault.unlockEnd();
        vm.warp(block.timestamp + 1 days);

        vm.prank(market);
        vault.coverLoss(3_000e18);

        assertEq(vault.unlockEnd(), endBefore, "a claim moved the vesting deadline");
    }

    /// The junior tranche duplicated the pattern, so it needs the same guarantee.
    function test_junior_tranche_vesting_also_resists_dust_absorbs() public {
        vault.setJuniorTranche(address(junior));
        junior.setSeniorVault(address(vault));

        vm.prank(alice);
        vault.deposit(100_000e18, alice);
        vm.prank(juniorLp);
        junior.deposit(100_000e18, juniorLp);

        _absorb(10_000e18);
        uint256 honestUnlockEnd = junior.unlockEnd();
        assertGt(honestUnlockEnd, block.timestamp, "junior received no profit - test is vacuous");

        for (uint256 i = 0; i < 50; i++) {
            vm.warp(block.timestamp + 1 hours);
            _absorb(1e15);
        }

        assertLt(
            junior.unlockEnd(),
            honestUnlockEnd + 2 hours,
            "junior clock still resets on every absorb"
        );
    }

    // =================================================================
    // Concentration cap, enforced continuously
    // =================================================================

    /// The defect: `reserve()` capped one market at 50% of the pool, then LPs could
    /// withdraw until that same market held 80% of it.
    function test_withdrawals_cannot_push_a_market_past_its_concentration_cap() public {
        vm.prank(alice);
        vault.deposit(100_000e18, alice);

        vm.prank(market);
        vault.reserve(30_000e18);

        // Drain everything the vault will release.
        vm.prank(alice);
        vault.requestWithdrawal();
        vm.warp(block.timestamp + vault.withdrawalCooldown());
        uint256 free = vault.availableLiquidity();
        vm.prank(alice);
        vault.withdraw(free, alice, alice);

        uint256 share = (vault.marketReserved(market) * 10000) / vault.totalBackingAssets();
        assertLe(
            share,
            vault.MAX_SINGLE_MARKET_BPS(),
            "one market ended up holding more of the pool than its cap allows"
        );
    }

    /// The concentration floor binds only while it is the tighter of the two. With
    /// several markets sharing the reservation, the aggregate cap takes over.
    function test_aggregate_floor_binds_when_no_single_market_is_concentrated() public {
        vault.setMarketAuthorization(market2, true);

        vm.prank(alice);
        vault.deposit(100_000e18, alice);

        // 40k each: neither market exceeds 50%, so the aggregate 80% cap governs.
        vm.prank(market);
        vault.reserve(40_000e18);
        vm.prank(market2);
        vault.reserve(40_000e18);

        assertEq(vault.largestMarketReserved(), 40_000e18);
        // Aggregate: 80k/0.8 = 100k. Concentration: 40k/0.5 = 80k. Aggregate binds.
        assertEq(vault.minRequiredAssets(), 100_000e18);
        assertEq(vault.availableLiquidity(), 0);
    }

    function test_largest_market_reserved_tracks_the_maximum() public {
        vault.setMarketAuthorization(market2, true);

        vm.prank(alice);
        vault.deposit(200_000e18, alice);

        vm.prank(market);
        vault.reserve(30_000e18);
        assertEq(vault.largestMarketReserved(), 30_000e18);

        vm.prank(market2);
        vault.reserve(50_000e18);
        assertEq(vault.largestMarketReserved(), 50_000e18);

        vm.prank(market2);
        vault.release(50_000e18);
        assertEq(vault.largestMarketReserved(), 30_000e18, "max not recomputed after release");
    }

    /// The loop over markets must be bounded by governance, not by anything a user
    /// can inflate — that is the mistake the obligations loop made.
    function test_authorized_market_count_is_capped() public {
        uint256 cap = vault.MAX_AUTHORIZED_MARKETS();
        // One market is already authorised in setUp.
        for (uint256 i = vault.authorizedMarketCount(); i < cap; i++) {
            vault.setMarketAuthorization(address(uint160(0x50000 + i)), true);
        }
        assertEq(vault.authorizedMarketCount(), cap);

        vm.expectRevert(
            abi.encodeWithSelector(BreezeLiquidityVault.TooManyMarkets.selector, cap)
        );
        vault.setMarketAuthorization(address(0xDEAD), true);
    }

    function test_deauthorizing_frees_a_slot() public {
        uint256 before = vault.authorizedMarketCount();
        vault.setMarketAuthorization(market, false);
        assertEq(vault.authorizedMarketCount(), before - 1);

        vault.setMarketAuthorization(market2, true);
        assertEq(vault.authorizedMarketCount(), before);
    }

    /// Re-authorising an existing market must not consume a second slot.
    function test_reauthorizing_the_same_market_is_idempotent() public {
        uint256 before = vault.authorizedMarketCount();
        vault.setMarketAuthorization(market, true);
        assertEq(vault.authorizedMarketCount(), before);
    }
}
