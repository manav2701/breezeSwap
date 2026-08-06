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

contract CpToken is ERC20 {
    constructor() ERC20("Mock USDT", "mUSDT") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Capacity is now PRICED as well as capped.
///
/// The cap alone is a cliff: below it every trade costs the same, at it nothing gets
/// through. That neither discourages the marginal trade that fills the last of the
/// book nor pays LPs more for the tail exposure they take as it fills.
/// `WeatherPolicyMarket` already prices its capacity through `utilizationLoadBps`;
/// perps only rationed.
///
/// Two properties matter and are easy to conflate. The surcharge must be a genuine
/// scarcity price — zero on an empty book, rising with utilisation, and never charged
/// on flow that consumes no capacity. And it must reach LPs, since compensating them
/// for tail exposure is the whole point; it does so by being RETAINED, which puts the
/// market's balance above its obligations so the existing `sweepSurplus` remits it.
contract PerpCapacityPricingTest is Test {
    BreezeAccessControl accessControl;
    MockWeatherOracle oracle;
    FeeConfig feeConfig;
    ProtocolTreasury treasury;
    InsuranceFund insuranceFund;
    BreezeLiquidityVault vault;
    CpToken token;
    BreezePerpMarket market;

    address admin = address(this);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address lp = address(0x11B);

    bytes32 constant REGION = keccak256("TOKYO_RAINFALL");

    function setUp() public {
        accessControl = new BreezeAccessControl(admin);
        accessControl.grantRole(accessControl.ORACLE_UPDATER_ROLE(), admin);
        oracle = new MockWeatherOracle(address(accessControl));
        token = new CpToken();

        feeConfig = new FeeConfig(address(accessControl));
        treasury = new ProtocolTreasury(address(token), address(accessControl));
        insuranceFund = new InsuranceFund(address(token), address(accessControl));
        vault = new BreezeLiquidityVault(token, address(accessControl), "Breeze LP", "bLP");

        market = new BreezePerpMarket(
            VirtualAMM.Reserves({collateralReserve: 5_000_000e18, weatherReserve: 200_000e18}),
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

        // Skew cap off: two overlapping limits make it ambiguous which one refused a
        // trade, and these tests are about pricing rather than either limit.
        market.setMaxSkew(0);

        token.mint(alice, 5_000_000e18);
        token.mint(bob, 5_000_000e18);
        token.mint(lp, 5_000_000e18);
        vm.prank(alice);
        token.approve(address(market), type(uint256).max);
        vm.prank(bob);
        token.approve(address(market), type(uint256).max);
        vm.prank(lp);
        token.approve(address(vault), type(uint256).max);

        oracle.setReading(REGION, block.timestamp, 25e6);
    }

    function _fundVault(uint256 amount) internal {
        vm.prank(lp);
        vault.deposit(amount, lp);
        market.setLiquidityVault(address(vault));
    }

    function _open(address who, bool isLong, uint256 collateral, uint256 leverage)
        internal
        returns (uint256)
    {
        vm.prank(who);
        return market.openPosition(isLong, collateral, leverage);
    }

    function _netCollateral(uint256 id) internal view returns (uint256 c) {
        (, , c, , , , , ) = market.positions(id);
    }

    // =================================================================
    // The surcharge as a price
    // =================================================================

    /// A market with no vault has unbounded capacity, so it has no scarcity to price.
    /// Treating "no backing" as "completely full" would levy the maximum surcharge on
    /// the market with the least justification for one.
    function test_no_vault_means_no_surcharge() public {
        assertEq(market.maxNotionalCapacity(), type(uint256).max);
        assertEq(market.capacityUtilizationBps(), 0);
        assertEq(market.utilizationSurchargeBps(), 0);

        (uint256 fee,,,) = feeConfig.calculateFeeSplit(50_000e18);
        uint256 id = _open(alice, true, 50_000e18, 2);
        assertEq(_netCollateral(id), 50_000e18 - fee, "a surcharge was charged with no capacity to price");
    }

    /// Zero on an empty book: the first trade into an idle market pays nothing extra.
    function test_empty_book_pays_no_surcharge() public {
        _fundVault(2_000_000e18);

        assertEq(market.capacityUtilizationBps(), 0);
        assertEq(market.utilizationSurchargeBps(), 0);
        assertEq(market.effectiveOpenFeeBps(), feeConfig.tradingFeeBps());
    }

    /// And it rises as the book fills. This is the property the cap does not have.
    function test_surcharge_rises_with_utilisation() public {
        _fundVault(2_000_000e18);

        uint256 previous = 0;
        for (uint256 i = 0; i < 4; i++) {
            _open(alice, true, 100_000e18, 3);
            uint256 rate = market.utilizationSurchargeBps();
            console.log("utilisation bps / surcharge bps:", market.capacityUtilizationBps(), rate);
            assertGe(rate, previous, "surcharge did not rise as the book filled");
            previous = rate;
        }
        assertGt(previous, 0, "surcharge never became positive - test is vacuous");
    }

    /// The surcharge is exactly `utilizationFeeBps` scaled by utilisation, and it is
    /// what the trader actually pays.
    function test_surcharge_matches_the_published_rate() public {
        _fundVault(2_000_000e18);
        _open(alice, true, 300_000e18, 3);

        uint256 utilisation = market.capacityUtilizationBps();
        assertGt(utilisation, 0, "book is empty - test is vacuous");

        uint256 rate = market.utilizationSurchargeBps();
        assertEq(rate, (market.utilizationFeeBps() * utilisation) / 10000);

        uint256 collateral = 50_000e18;
        (uint256 fee,,,) = feeConfig.calculateFeeSplit(collateral);
        uint256 expectedSurcharge = (collateral * rate) / 10000;

        uint256 id = _open(alice, true, collateral, 2);
        assertEq(
            _netCollateral(id),
            collateral - fee - expectedSurcharge,
            "what the trader paid does not match the published rate"
        );
    }

    /// At full capacity the surcharge is (essentially) the whole configured amount.
    ///
    /// @dev "Essentially" because sizing a trade to exactly fill the book is not
    /// possible from outside: `availableNotional` reports the room, but the fee and the
    /// surcharge are deducted from collateral before notional is computed, so posting
    /// `room / leverage` lands just short. The residual is a fraction of a percent and
    /// erring short is the safe direction.
    function test_full_book_pays_almost_the_whole_surcharge() public {
        _fundVault(200_000e18);

        uint256 room = market.availableNotional(true);
        _open(alice, true, room / 3, 3);

        assertGe(market.capacityUtilizationBps(), 9900, "book did not reach capacity");
        assertGe(
            market.utilizationSurchargeBps(),
            (market.utilizationFeeBps() * 9900) / 10000,
            "a full book did not pay the configured surcharge"
        );
    }

    /// Balancing flow consumes no scarce capacity, so it must not pay for scarcity.
    /// The skew and notional caps already treat balancing trades this way; a blanket
    /// surcharge would have penalised exactly the flow the market wants.
    function test_balancing_flow_pays_no_surcharge() public {
        _fundVault(2_000_000e18);
        _open(alice, true, 300_000e18, 3);
        assertGt(market.utilizationSurchargeBps(), 0, "no surcharge in force - test is vacuous");

        uint256 collateral = 50_000e18;
        (uint256 fee,,,) = feeConfig.calculateFeeSplit(collateral);

        // Short is the smaller side, so growing it leaves worst-case exposure alone.
        uint256 id = _open(bob, false, collateral, 2);
        assertEq(
            _netCollateral(id),
            collateral - fee,
            "a trade that reduced imbalance was charged for scarcity"
        );
    }

    /// A trade that crosses from the smaller side to the larger does pay, because it
    /// raises worst-case exposure.
    function test_crossing_to_the_larger_side_pays() public {
        _fundVault(2_000_000e18);
        _open(alice, true, 100_000e18, 3);
        assertGt(market.utilizationSurchargeBps(), 0, "no surcharge in force - test is vacuous");

        uint256 collateral = 400_000e18;
        (uint256 fee,,,) = feeConfig.calculateFeeSplit(collateral);

        uint256 id = _open(bob, false, collateral, 3);
        assertLt(
            _netCollateral(id),
            collateral - fee,
            "a trade that overtook the other side escaped the surcharge"
        );
    }

    // =================================================================
    // The surcharge as LP compensation
    // =================================================================

    /// The surcharge is RETAINED, not routed. That is the mechanism by which it reaches
    /// LPs: the tokens stay in the market, so the balance sits above what open positions
    /// are owed, and the existing `sweepSurplus` remits the difference as LP profit.
    ///
    /// Asserted directly on the market's balance rather than via `openPositionObligations`.
    /// The market is DESIGNED to run a balance below its obligations — that is what the
    /// vault backstop is for — so "balance exceeds obligations" is not a property the
    /// surcharge can establish, and an earlier version of this test wrongly assumed it
    /// could.
    function test_surcharge_is_retained_in_the_market() public {
        _fundVault(2_000_000e18);
        _open(alice, true, 300_000e18, 3);

        uint256 rate = market.utilizationSurchargeBps();
        assertGt(rate, 0, "no surcharge in force - test is vacuous");

        uint256 collateral = 200_000e18;
        (uint256 fee,,,) = feeConfig.calculateFeeSplit(collateral);
        uint256 expectedSurcharge = (collateral * rate) / 10000;
        assertGt(expectedSurcharge, 0);

        uint256 marketBefore = token.balanceOf(address(market));
        uint256 id = _open(alice, true, collateral, 2);

        // Only the fee legs leave. Everything else stays, which means the market holds
        // the position's collateral PLUS the surcharge.
        assertEq(
            token.balanceOf(address(market)) - marketBefore,
            collateral - fee,
            "the surcharge left the market"
        );
        assertEq(
            token.balanceOf(address(market)) - marketBefore - _netCollateral(id),
            expectedSurcharge,
            "retained amount is not the surcharge"
        );
    }

    /// And it does reach LPs once positions are out of the way.
    function test_surcharge_reaches_lps_through_the_sweep() public {
        _fundVault(2_000_000e18);
        uint256 a = _open(alice, true, 300_000e18, 3);
        assertGt(market.utilizationSurchargeBps(), 0, "no surcharge in force - test is vacuous");
        uint256 b = _open(alice, true, 200_000e18, 2);

        vm.prank(alice);
        market.closePosition(b);
        vm.prank(alice);
        market.closePosition(a);
        assertEq(market.openPositionCount(), 0);

        uint256 vaultBefore = token.balanceOf(address(vault));
        uint256 swept = market.sweepSurplus();
        assertEq(token.balanceOf(address(vault)) - vaultBefore, swept);

        console.log("swept to LPs after unwind:", swept);
        assertGt(swept, 0, "nothing reached the vault");
    }

    /// Closing reduces exposure, so it is never surcharged. Charging an exit for
    /// scarcity would discourage the only action that relieves it.
    function test_closing_is_never_surcharged() public {
        _fundVault(2_000_000e18);
        uint256 id = _open(alice, true, 300_000e18, 3);
        assertGt(market.utilizationSurchargeBps(), 0, "no surcharge in force - test is vacuous");

        uint256 before = token.balanceOf(alice);
        vm.prank(alice);
        market.closePosition(id);
        uint256 payout = token.balanceOf(alice) - before;

        (, , , , , , , bool isOpen) = market.positions(id);
        assertFalse(isOpen);
        assertGt(payout, 0);

        // Exposure cleared with the position, so there is no scarcity left to price.
        assertEq(market.utilizationSurchargeBps(), 0, "exposure did not clear on close");
    }

    // =================================================================
    // Pricing does not replace rationing
    // =================================================================

    /// The cap is a solvency bound derived from backing that exists. The surcharge
    /// makes the approach to it expensive; it must not make the cap negotiable.
    function test_surcharge_does_not_let_a_trade_past_the_cap() public {
        _fundVault(100_000e18);

        uint256 cap = market.maxNotionalCapacity();
        uint256 tooBig = (cap / 3) * 2; // notional well beyond capacity at 3x

        vm.prank(alice);
        vm.expectRevert();
        market.openPosition(true, tooBig, 3);
    }

    /// And with the surcharge switched off the market behaves exactly as it did
    /// before capacity was priced.
    function test_zero_rate_restores_pure_rationing() public {
        market.setUtilizationFeeBps(0);
        _fundVault(2_000_000e18);
        _open(alice, true, 300_000e18, 3);

        assertGt(market.capacityUtilizationBps(), 0, "book is empty - test is vacuous");
        assertEq(market.utilizationSurchargeBps(), 0);

        uint256 collateral = 50_000e18;
        (uint256 fee,,,) = feeConfig.calculateFeeSplit(collateral);
        uint256 id = _open(alice, true, collateral, 2);
        assertEq(_netCollateral(id), collateral - fee);
    }

    // =================================================================
    // Administration
    // =================================================================

    function test_utilization_fee_is_bounded() public {
        // Read the constant BEFORE arming the revert expectation: a view call in the
        // argument list would consume it.
        uint256 max = market.MAX_UTILIZATION_FEE_BPS();

        vm.expectRevert(BreezePerpMarket.InvalidParameter.selector);
        market.setUtilizationFeeBps(max + 1);

        market.setUtilizationFeeBps(max);
        assertEq(market.utilizationFeeBps(), 200);
    }

    function test_only_admin_can_set_the_utilization_fee() public {
        vm.prank(alice);
        vm.expectRevert(BreezePerpMarket.UnauthorizedCaller.selector);
        market.setUtilizationFeeBps(100);
    }

    /// The total cost of an open must stay bounded even at the worst combination of
    /// both knobs, or "priced" turns into "refused by another name".
    function test_worst_case_total_fee_stays_bounded() public {
        feeConfig.setTradingFeeBps(feeConfig.MAX_FEE_BPS());
        market.setUtilizationFeeBps(market.MAX_UTILIZATION_FEE_BPS());
        _fundVault(200_000e18);

        uint256 room = market.availableNotional(true);
        _open(alice, true, room / 3, 3);
        assertGe(market.capacityUtilizationBps(), 9800);

        // 1% trading fee + up to 2% surcharge on a (near) full book. The ceiling is
        // what matters: at no utilisation can an open cost more than 3% of collateral.
        assertLe(market.effectiveOpenFeeBps(), 300, "total open cost exceeded its ceiling");
        assertGe(market.effectiveOpenFeeBps(), 295, "surcharge is not near its maximum");
    }
}
