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
import "../../src/vault/FirstLossReserve.sol";

contract FlToken is ERC20 {
    constructor() ERC20("Mock USDT", "mUSDT") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice The waterfall's first tier used to be `InsuranceFund`, which the perp
/// market ALSO draws directly to clear liquidation bad debt. One balance, two
/// unrelated consumers, no ordering — so the vault could drain the reserve
/// liquidation depends on.
///
/// `WaterfallMonteCarloTest` measured the consequence: enabling the shared fund as
/// tier 1 left senior LPs worse off on 2 of 5 seeds than having no tier 1 at all.
/// That is a priority inversion, because the two failures are not symmetric —
/// liquidation failing to clear bad debt leaves the deficit on the market's balance,
/// which starves other closing positions, which produces further vault draws. It
/// compounds. Senior capital absorbing a loss does not.
///
/// The claim here is comparative, so the test is comparative: the same drain, the
/// same liquidation, run through a shared pot and through separated reserves.
contract FirstLossIsolationTest is Test {
    BreezeAccessControl accessControl;
    MockWeatherOracle oracle;
    FeeConfig feeConfig;
    ProtocolTreasury treasury;
    InsuranceFund insuranceFund;
    FirstLossReserve firstLossReserve;
    BreezeLiquidityVault vault;
    FlToken token;
    BreezePerpMarket market;

    address admin = address(this);
    address alice = address(0x2222);
    address bob = address(0x3333);
    address liquidator = address(0x4444);
    address seniorLp = address(0x5555);

    bytes32 constant REGION = keccak256("TOKYO_RAINFALL");

    uint256 constant RESERVE_SEED = 50_000e18;

    function setUp() public {
        _deploy();
    }

    function _deploy() internal {
        accessControl = new BreezeAccessControl(admin);
        oracle = new MockWeatherOracle(address(accessControl));
        token = new FlToken();
        feeConfig = new FeeConfig(address(accessControl));
        treasury = new ProtocolTreasury(address(token), address(accessControl));
        insuranceFund = new InsuranceFund(address(token), address(accessControl));
        firstLossReserve = new FirstLossReserve(address(token), address(accessControl));
        vault = new BreezeLiquidityVault(token, address(accessControl), "Breeze LP", "bLP");

        market = new BreezePerpMarket(
            VirtualAMM.Reserves({collateralReserve: 1_000_000e18, weatherReserve: 40_000e18}),
            address(oracle),
            address(insuranceFund),
            address(feeConfig),
            address(treasury),
            address(accessControl),
            address(token),
            REGION
        );

        insuranceFund.setMarketAuthorization(address(market), true);

        // Seed the liquidation backstop.
        token.mint(address(this), RESERVE_SEED);
        token.approve(address(insuranceFund), RESERVE_SEED);
        insuranceFund.deposit(RESERVE_SEED);

        token.mint(alice, 200_000e18);
        token.mint(bob, 2_000_000e18);
        token.mint(seniorLp, 1_000_000e18);

        vm.prank(alice);
        token.approve(address(market), type(uint256).max);
        vm.prank(bob);
        token.approve(address(market), type(uint256).max);
        vm.prank(seniorLp);
        token.approve(address(vault), type(uint256).max);
    }

    // =================================================================
    // The reserve contract itself
    // =================================================================

    function test_only_authorized_drawers_can_draw() public {
        token.mint(address(this), 10_000e18);
        token.approve(address(firstLossReserve), 10_000e18);
        firstLossReserve.deposit(10_000e18);

        // Admin is not a drawer. There is no path by which protocol-owned
        // first-loss capital leaves this contract except to a tier that has been
        // explicitly authorised to absorb loss with it.
        vm.expectRevert(FirstLossReserve.UnauthorizedCaller.selector);
        firstLossReserve.coverShortfall(1_000e18);

        firstLossReserve.setDrawerAuthorization(address(vault), true);
        vm.prank(address(vault));
        uint256 drawn = firstLossReserve.coverShortfall(1_000e18);
        assertEq(drawn, 1_000e18);
        assertEq(token.balanceOf(address(vault)), 1_000e18);
    }

    /// The market funds tier 1 but must never be able to draw it — that is the
    /// entire distinction between this reserve and the liquidation backstop.
    function test_market_is_not_a_drawer() public {
        market.setFirstLossReserve(address(firstLossReserve));

        vm.prank(address(market));
        vm.expectRevert(FirstLossReserve.UnauthorizedCaller.selector);
        firstLossReserve.coverShortfall(1);

        assertFalse(firstLossReserve.authorizedDrawers(address(market)));
    }

    function test_draw_is_clamped_to_balance_and_never_reverts_when_empty() public {
        firstLossReserve.setDrawerAuthorization(address(this), true);

        // Empty: a partial (here zero) fill is the normal signal that the tier is
        // exhausted. Reverting would trap positions on the close path.
        assertEq(firstLossReserve.coverShortfall(5_000e18), 0);

        token.mint(address(this), 1_000e18);
        token.approve(address(firstLossReserve), 1_000e18);
        firstLossReserve.deposit(1_000e18);

        assertEq(firstLossReserve.coverShortfall(5_000e18), 1_000e18);
        assertEq(firstLossReserve.balance(), 0);
    }

    function test_lifetime_counters_track_both_directions() public {
        firstLossReserve.setDrawerAuthorization(address(this), true);
        token.mint(address(this), 8_000e18);
        token.approve(address(firstLossReserve), 8_000e18);
        firstLossReserve.deposit(8_000e18);
        firstLossReserve.coverShortfall(3_000e18);

        assertEq(firstLossReserve.totalDeposited(), 8_000e18);
        assertEq(firstLossReserve.totalCovered(), 3_000e18);
        assertEq(firstLossReserve.balance(), 5_000e18);
    }

    function test_funding_ratio_reports_the_gap_to_target() public {
        assertEq(firstLossReserve.fundingRatioBps(), 10000, "no target cannot be unmet");
        assertTrue(firstLossReserve.isFunded());

        firstLossReserve.setTargetSize(10_000e18);
        assertEq(firstLossReserve.fundingRatioBps(), 0);
        assertFalse(firstLossReserve.isFunded());

        token.mint(address(this), 2_500e18);
        token.approve(address(firstLossReserve), 2_500e18);
        firstLossReserve.deposit(2_500e18);
        assertEq(firstLossReserve.fundingRatioBps(), 2500);
    }

    // =================================================================
    // Fee funding: the tier has to actually fill
    // =================================================================

    function test_open_funds_the_reserve_from_its_own_fee_leg() public {
        market.setFirstLossReserve(address(firstLossReserve));

        (uint256 fee, uint256 ins, uint256 firstLoss, uint256 tre) =
            feeConfig.calculateFeeSplit(20_000e18);
        assertGt(firstLoss, 0, "fee split has no first-loss leg - test is vacuous");

        uint256 insBefore = insuranceFund.balance();
        uint256 treBefore = token.balanceOf(address(treasury));

        vm.prank(alice);
        market.openPosition(true, 20_000e18, 2);

        assertEq(firstLossReserve.balance(), firstLoss, "first-loss leg did not arrive");
        assertEq(insuranceFund.balance() - insBefore, ins);
        assertEq(token.balanceOf(address(treasury)) - treBefore, tre);
        assertEq(ins + firstLoss + tre, fee);
    }

    function test_close_also_funds_the_reserve() public {
        market.setFirstLossReserve(address(firstLossReserve));

        vm.prank(alice);
        uint256 id = market.openPosition(true, 20_000e18, 2);
        uint256 afterOpen = firstLossReserve.balance();

        vm.prank(alice);
        market.closePosition(id);

        assertGt(firstLossReserve.balance(), afterOpen, "close did not fund tier 1");
    }

    /// A market that was never wired to a reserve must behave exactly as before,
    /// not silently strand the first-loss leg in its own balance.
    function test_unwired_market_folds_the_leg_into_the_backstop() public {
        (uint256 fee,,,) = feeConfig.calculateFeeSplit(20_000e18);
        (, uint256 ins, uint256 firstLoss, uint256 tre) = feeConfig.calculateFeeSplit(20_000e18);

        uint256 insBefore = insuranceFund.balance();
        uint256 treBefore = token.balanceOf(address(treasury));

        vm.prank(alice);
        market.openPosition(true, 20_000e18, 2);

        assertEq(insuranceFund.balance() - insBefore, ins + firstLoss);
        assertEq(token.balanceOf(address(treasury)) - treBefore, tre);
        assertEq(ins + firstLoss + tre, fee);
        assertEq(firstLossReserve.balance(), 0);
    }

    // =================================================================
    // The measured defect, and its fix
    // =================================================================

    /// Drain tier 1 through the vault, then require a liquidation to clear bad
    /// debt. Whether the liquidation can be paid is the whole question.
    ///
    /// @param separate route the waterfall's tier 1 to the dedicated reserve
    /// @return required deficit plus liquidator reward — what the backstop is asked for
    /// @return backstopDraw what the liquidation backstop actually paid
    function _drainThenLiquidate(bool separate)
        internal
        returns (uint256 required, uint256 backstopDraw)
    {
        _deploy();

        // A stand-in market, so the vault draw is exercised directly rather than
        // through a trade whose size would then have to be reverse-engineered.
        vault.setMarketAuthorization(address(this), true);
        vm.prank(seniorLp);
        vault.deposit(100_000e18, seniorLp);

        if (separate) {
            // Fund the dedicated reserve with the same capital, so the two arms
            // hold identical protocol-owned first-loss capital and differ only in
            // whether it is shared with the liquidation backstop.
            token.mint(address(this), RESERVE_SEED);
            token.approve(address(firstLossReserve), RESERVE_SEED);
            firstLossReserve.deposit(RESERVE_SEED);

            vault.setFirstLossFund(address(firstLossReserve));
            firstLossReserve.setDrawerAuthorization(address(vault), true);
        } else {
            vault.setFirstLossFund(address(insuranceFund));
            insuranceFund.setMarketAuthorization(address(vault), true);
        }

        // The vault takes a loss and draws its first tier for the whole of it.
        vault.coverLoss(RESERVE_SEED);

        if (separate) {
            assertEq(firstLossReserve.balance(), 0, "vault did not draw the dedicated reserve");
            assertEq(insuranceFund.balance(), RESERVE_SEED, "backstop was touched by a vault draw");
        } else {
            assertEq(insuranceFund.balance(), 0, "vault did not drain the shared pot");
        }

        // Now force a liquidation that leaves bad debt.
        market.setMaxSkew(0);
        vm.prank(alice);
        uint256 id = market.openPosition(true, 1_000e18, 3);
        vm.prank(bob);
        market.openPosition(false, 250_000e18, 3);

        (, , uint256 collateral, , , , , ) = market.positions(id);
        int256 equity = int256(collateral) + market.calculateUnrealizedPnl(id);
        assertLt(equity, 0, "position is not in bad debt - scenario never ran");

        required =
            uint256(-equity) + (collateral * PerpConstants.LIQUIDATION_REWARD_BPS) / 10000;

        uint256 backstopBefore = insuranceFund.balance();
        vm.prank(liquidator);
        market.liquidate(id);
        backstopDraw = backstopBefore - insuranceFund.balance();
    }

    function test_shared_pot_lets_a_vault_draw_starve_liquidation() public {
        (uint256 required, uint256 backstopDraw) = _drainThenLiquidate(false);

        console.log("shared pot  : backstop asked for :", required);
        console.log("shared pot  : backstop paid      :", backstopDraw);

        // The inversion, stated as an assertion. The vault took its cover from the
        // shared pot, and what liquidation received afterwards is only the fees the
        // two trades in this scenario happened to pay back in — nowhere near the
        // deficit. Note that this is NOT zero: the pot refills from ordinary volume,
        // which is exactly why the defect is easy to miss in a busy market and
        // dangerous in a quiet one.
        assertLt(
            backstopDraw,
            required,
            "shared pot covered the deficit in full - the drain did not bite"
        );
    }

    function test_dedicated_reserve_leaves_liquidation_funded() public {
        (uint256 required, uint256 backstopDraw) = _drainThenLiquidate(true);

        console.log("separated   : backstop asked for :", required);
        console.log("separated   : backstop paid      :", backstopDraw);

        assertGt(required, 0);
        assertEq(
            backstopDraw,
            required,
            "liquidation was still short after separating the reserves"
        );
    }

    /// The comparison in one place, since the claim is relative and not absolute.
    function test_separation_strictly_improves_liquidation_coverage() public {
        (uint256 sharedRequired, uint256 sharedDraw) = _drainThenLiquidate(false);
        (uint256 sepRequired, uint256 sepDraw) = _drainThenLiquidate(true);

        // Same script, so the same deficit — otherwise the two arms are not
        // comparable and the difference in coverage means nothing.
        assertEq(sharedRequired, sepRequired, "the two arms did not face the same deficit");
        assertGt(sepDraw, sharedDraw, "separating the reserves did not improve coverage");
    }

    /// And the vault still gets its tier-1 cover in the separated arm — the fix
    /// must not simply move the starvation to the other consumer.
    function test_vault_still_gets_tier_one_cover_after_separation() public {
        vault.setMarketAuthorization(address(this), true);
        vm.prank(seniorLp);
        vault.deposit(100_000e18, seniorLp);

        token.mint(address(this), RESERVE_SEED);
        token.approve(address(firstLossReserve), RESERVE_SEED);
        firstLossReserve.deposit(RESERVE_SEED);
        vault.setFirstLossFund(address(firstLossReserve));
        firstLossReserve.setDrawerAuthorization(address(vault), true);

        uint256 seniorBefore = vault.totalAssets();
        vault.coverLoss(30_000e18);

        // Tier 1 paid the whole claim, so senior share value is untouched.
        assertEq(firstLossReserve.balance(), RESERVE_SEED - 30_000e18);
        assertEq(vault.totalAssets(), seniorBefore, "senior absorbed a loss tier 1 could cover");
    }
}
