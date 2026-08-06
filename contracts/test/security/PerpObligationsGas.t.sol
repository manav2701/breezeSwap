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

contract ObToken is ERC20 {
    constructor() ERC20("Mock USDT", "mUSDT") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice `openPositionObligations()` must not get more expensive as the market
/// accumulates history.
///
/// It used to loop over `nextPositionId` — every position ever created — and run a
/// vAMM quote on each, skipping closed ones only *after* paying to load them. The
/// loop therefore grew monotonically and never shrank, so `sweepSurplus()` was
/// guaranteed to exceed the block gas limit eventually and stay there. Realised
/// trader losses that belong to LPs would have been stranded permanently, and LP
/// yield would have silently stopped.
///
/// That is a liveness failure on a timer. No existing test could catch it, because
/// catching it requires opening and closing far more positions than any functional
/// test has reason to. This suite exists specifically to close that gap.
contract PerpObligationsGasTest is Test {
    BreezeAccessControl accessControl;
    MockWeatherOracle oracle;
    FeeConfig feeConfig;
    ProtocolTreasury treasury;
    InsuranceFund insuranceFund;
    BreezeLiquidityVault vault;
    ObToken token;
    BreezePerpMarket market;

    address admin = address(this);
    address trader = address(0x7AAD);
    address lp = address(0x11B);
    bytes32 constant REGION = keccak256("TOKYO_RAINFALL");

    function setUp() public {
        vm.warp(1_700_000_000);
        accessControl = new BreezeAccessControl(admin);
        accessControl.grantRole(accessControl.ORACLE_UPDATER_ROLE(), admin);
        oracle = new MockWeatherOracle(address(accessControl));
        token = new ObToken();

        feeConfig = new FeeConfig(address(accessControl));
        feeConfig.setTradingFeeBps(feeConfig.MIN_FEE_BPS());
        treasury = new ProtocolTreasury(address(token), address(accessControl));
        insuranceFund = new InsuranceFund(address(token), address(accessControl));
        vault = new BreezeLiquidityVault(token, address(accessControl), "Breeze LP", "bLP");

        market = new BreezePerpMarket(
            VirtualAMM.Reserves({collateralReserve: 50_000_000e18, weatherReserve: 2_000_000e18}),
            address(oracle),
            address(insuranceFund),
            address(feeConfig),
            address(treasury),
            address(accessControl),
            address(token),
            REGION
        );

        insuranceFund.setMarketAuthorization(address(market), true);
        vault.setMarketAuthorization(address(market), true);
        // No vault and no skew cap for the gas tests: capacity refusals would cap
        // how many positions can be opened, which is the opposite of what these
        // tests need to stress.
        market.setMaxSkew(0);

        token.mint(trader, 100_000_000e18);
        token.mint(lp, 10_000_000e18);
        vm.prank(trader);
        token.approve(address(market), type(uint256).max);
        vm.prank(lp);
        token.approve(address(vault), type(uint256).max);

        oracle.setReading(REGION, block.timestamp, 25e6);
    }

    function _open() internal returns (uint256) {
        vm.prank(trader);
        return market.openPosition(true, 100e18, 1);
    }

    function _close(uint256 id) internal {
        vm.prank(trader);
        market.closePosition(id);
    }

    function _obligationsGas() internal view returns (uint256) {
        uint256 before = gasleft();
        market.openPositionObligations();
        return before - gasleft();
    }

    // -----------------------------------------------------------------
    // The regression that matters
    // -----------------------------------------------------------------

    /// Churn 200 positions through open-and-close, then measure again with the same
    /// number open as before. Cost must be governed by what is OPEN, not by what has
    /// ever existed. Under the old loop this grew by roughly 40x.
    function test_obligations_gas_does_not_grow_with_closed_positions() public {
        uint256[] memory keep = new uint256[](5);
        for (uint256 i = 0; i < 5; i++) keep[i] = _open();

        uint256 gasWithHistoryEmpty = _obligationsGas();

        for (uint256 i = 0; i < 200; i++) {
            uint256 id = _open();
            _close(id);
        }

        // Same five positions open as at the first measurement.
        assertEq(market.openPositionCount(), 5, "open set did not return to five");
        uint256 gasAfterChurn = _obligationsGas();

        emit log_named_uint("obligations gas, 5 open, no history", gasWithHistoryEmpty);
        emit log_named_uint("obligations gas, 5 open, 200 closed", gasAfterChurn);
        emit log_named_uint("nextPositionId (lifetime count)   ", market.nextPositionId());

        // Allow noise, but nothing like proportional growth.
        assertLt(
            gasAfterChurn,
            (gasWithHistoryEmpty * 12) / 10,
            "obligations cost still scales with lifetime position count"
        );
    }

    /// The consequence the gas growth would have had: surplus becomes unremittable.
    /// This asserts the actual economic outcome, not just the gas number.
    function test_sweep_surplus_still_works_after_heavy_churn() public {
        vm.prank(lp);
        vault.deposit(1_000_000e18, lp);
        market.setLiquidityVault(address(vault));

        for (uint256 i = 0; i < 200; i++) {
            uint256 id = _open();
            _close(id);
        }
        assertEq(market.openPositionCount(), 0);

        // Churn alone leaves nothing behind: a constant-product round trip with no
        // intervening trade returns to the same point on the curve, so the price
        // impact reverses and only integer rounding is lost. Realised surplus comes
        // from traders being WRONG, which other suites cover. Here the surplus is
        // placed directly, so this test measures the one thing it is about —
        // that `sweepSurplus` still functions after heavy history.
        token.mint(address(market), 5_000e18);
        uint256 held = token.balanceOf(address(market));
        assertGt(held, 0, "no surplus to sweep - test is vacuous");

        uint256 vaultTokensBefore = token.balanceOf(address(vault));
        uint256 vaultAssetsBefore = vault.totalAssets();
        uint256 swept = market.sweepSurplus();

        assertEq(swept, held, "surplus not fully remitted");
        assertEq(token.balanceOf(address(market)), 0, "market retained swept funds");
        assertEq(
            token.balanceOf(address(vault)) - vaultTokensBefore,
            held,
            "vault did not receive the surplus"
        );

        // `totalAssets` deliberately does NOT move yet — swept profit arrives as
        // `lockedProfit` and vests over `profitUnlockPeriod`, so an LP cannot deposit
        // just before a sweep and capture it. Recognition follows once it vests.
        assertEq(vault.totalAssets(), vaultAssetsBefore, "swept profit recognised instantly");

        vm.warp(block.timestamp + vault.profitUnlockPeriod());
        assertEq(
            vault.totalAssets() - vaultAssetsBefore,
            held,
            "swept profit never became LP value"
        );
    }

    /// Obligations must be exactly zero once nothing is open, however much history
    /// exists. A stale entry would understate the surplus available to LPs, or
    /// overstate obligations forever.
    function test_obligations_are_zero_when_nothing_is_open() public {
        for (uint256 i = 0; i < 20; i++) {
            uint256 id = _open();
            _close(id);
        }
        assertEq(market.openPositionCount(), 0);
        assertEq(market.openPositionObligations(), 0);
    }

    // -----------------------------------------------------------------
    // Open-set bookkeeping
    // -----------------------------------------------------------------

    function test_open_set_tracks_opens_and_closes() public {
        uint256 a = _open();
        uint256 b = _open();
        assertEq(market.openPositionCount(), 2);

        _close(a);
        assertEq(market.openPositionCount(), 1);
        assertEq(market.openPositionAt(0), b, "wrong id left in the set");

        _close(b);
        assertEq(market.openPositionCount(), 0);
    }

    /// Liquidation is the other exit path and must maintain the set identically —
    /// otherwise a liquidated position is counted as owed forever.
    function test_liquidation_removes_from_the_open_set() public {
        vm.prank(trader);
        uint256 id = market.openPosition(true, 10_000e18, PerpConstants.MAX_LEVERAGE);
        assertEq(market.openPositionCount(), 1);

        // Drive funding hard against the long until it is liquidatable.
        for (uint256 k = 0; k < 60 && !market.isLiquidatable(id); k++) {
            vm.warp(block.timestamp + market.fundingInterval());
            oracle.setReading(REGION, block.timestamp, 1e6);
            market.settleFunding();
        }
        assertTrue(market.isLiquidatable(id), "position never became liquidatable");

        market.liquidate(id);
        assertEq(market.openPositionCount(), 0, "liquidated position left in the open set");
        assertEq(market.openPositionObligations(), 0);
    }

    function test_slots_remaining_decrements_with_open_positions() public {
        uint256 cap = market.MAX_OPEN_POSITIONS();
        assertEq(market.openPositionSlotsRemaining(), cap);

        uint256 id = _open();
        assertEq(market.openPositionSlotsRemaining(), cap - 1);

        _close(id);
        assertEq(market.openPositionSlotsRemaining(), cap);
    }

    // -----------------------------------------------------------------
    // Dust filter
    // -----------------------------------------------------------------

    /// Without a floor, the open-position cap could be filled for almost nothing,
    /// turning a gas bound into a cheap denial of service. Dust is also
    /// unliquidatable in practice, since a 2% reward on a trivial position does not
    /// cover the gas to claim it.
    function test_dust_positions_are_refused() public {
        uint256 min = market.minCollateral();
        vm.prank(trader);
        vm.expectRevert(
            abi.encodeWithSelector(BreezePerpMarket.BelowMinCollateral.selector, min - 1, min)
        );
        market.openPosition(true, min - 1, 1);
    }

    function test_exactly_minimum_collateral_is_accepted() public {
        uint256 min = market.minCollateral();
        vm.prank(trader);
        uint256 id = market.openPosition(true, min, 1);
        (,,,,,,, bool isOpen) = market.positions(id);
        assertTrue(isOpen);
    }

    function test_min_collateral_is_admin_settable_within_bounds() public {
        market.setMinCollateral(500e18);
        assertEq(market.minCollateral(), 500e18);

        uint256 ceiling = market.MAX_MIN_COLLATERAL();
        vm.expectRevert(BreezePerpMarket.InvalidParameter.selector);
        market.setMinCollateral(ceiling + 1);

        vm.expectRevert(BreezePerpMarket.InvalidParameter.selector);
        market.setMinCollateral(0);
    }

    /// The dust filter must not become an access control that prices ordinary users
    /// out of the market entirely.
    function test_min_collateral_is_bounded() public view {
        assertLe(market.MAX_MIN_COLLATERAL(), 10_000e18);
    }

    function test_only_admin_can_set_min_collateral() public {
        vm.prank(trader);
        vm.expectRevert(BreezePerpMarket.UnauthorizedCaller.selector);
        market.setMinCollateral(2e18);
    }
}
