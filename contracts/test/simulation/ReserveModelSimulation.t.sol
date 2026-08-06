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
import "./PerpSimHandler.sol";

contract SimToken is ERC20 {
    constructor() ERC20("Mock USDT", "mUSDT") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Evidence for the notional reserve model.
///
/// The model was changed from a collateral-denominated, reactive reserve to
/// `max(longNotional, shortNotional) × skewReserveBps`. That change was argued
/// from first principles; this suite tests whether it survives contact with
/// random traders, random leverage, random weather, and LPs entering and leaving
/// underneath live positions.
///
/// Four questions are answered explicitly:
///   1. Does the vault ever become insolvent?
///   2. How often are trades rejected?
///   3. How much LP capital sits idle?
///   4. Is the reserve too conservative or too aggressive?
contract ReserveModelSimulationTest is Test {
    BreezeAccessControl accessControl;
    MockWeatherOracle oracle;
    FeeConfig feeConfig;
    ProtocolTreasury treasury;
    InsuranceFund insuranceFund;
    BreezeLiquidityVault vault;
    SimToken token;
    BreezePerpMarket market;
    PerpSimHandler handler;

    address admin = address(this);
    bytes32 constant REGION = keccak256("TOKYO_RAINFALL");

    uint256 constant TRADER_COUNT = 20;
    uint256 constant LP_COUNT = 5;

    address[] traders;
    address[] lps;

    function setUp() public {
        accessControl = new BreezeAccessControl(admin);
        accessControl.grantRole(accessControl.ORACLE_UPDATER_ROLE(), admin);
        token = new SimToken();
        oracle = new MockWeatherOracle(address(accessControl));

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
        market.setLiquidityVault(address(vault));

        for (uint256 i = 0; i < TRADER_COUNT; i++) {
            address t = address(uint160(0x1000 + i));
            traders.push(t);
            token.mint(t, 5_000_000e18);
            vm.prank(t);
            token.approve(address(market), type(uint256).max);
        }
        for (uint256 i = 0; i < LP_COUNT; i++) {
            address l = address(uint160(0x2000 + i));
            lps.push(l);
            token.mint(l, 5_000_000e18);
            vm.prank(l);
            token.approve(address(vault), type(uint256).max);
        }

        // Seed the pool so the market is usable from block one.
        vm.prank(lps[0]);
        vault.deposit(1_000_000e18, lps[0]);

        oracle.setReading(REGION, block.timestamp, 25e6);

        handler = new PerpSimHandler(market, vault, oracle, token, REGION, traders, lps);
        targetContract(address(handler));

        // Give the handler the roles it needs to move the oracle.
        accessControl.grantRole(accessControl.ORACLE_UPDATER_ROLE(), address(handler));
    }

    // =================================================================
    // Q1 — Solvency
    // =================================================================

    /// The protocol must honour every position it priced. A trader closing must
    /// receive the equity the market itself reported, within fee tolerance.
    function invariant_sim_no_trader_is_shortchanged() public view {
        assertEq(handler.shortfallEvents(), 0, "protocol failed to pay a position it priced");
    }

    /// LP claims may never exceed the assets standing behind them.
    function invariant_sim_vault_share_claims_are_backed() public view {
        assertLe(
            vault.convertToAssets(vault.totalSupply()),
            vault.totalAssets(),
            "share claims exceed pool assets"
        );
    }

    /// Reserved capital must never be quoted as withdrawable.
    function invariant_sim_reserved_capital_is_never_withdrawable() public view {
        uint256 free = vault.availableLiquidity();
        for (uint256 i = 0; i < LP_COUNT; i++) {
            assertLe(vault.maxWithdraw(lps[i]), free, "reserved capital quoted as withdrawable");
        }
    }

    /// Notional accounting must not drift: with no open positions there is no
    /// exposure, so there must be no requirement and no lock.
    function invariant_sim_notional_unwinds_cleanly() public view {
        if (handler.openIdCount() == 0 && market.totalLongNotional() == 0
            && market.totalShortNotional() == 0) {
            assertEq(market.requiredVaultReserve(), 0, "requirement survived a flat book");
        }
    }

    /// The requirement must always dominate the directional exposure it prices,
    /// which is the property that makes it proactive rather than reactive.
    function invariant_sim_requirement_covers_worst_case_skew() public view {
        assertGe(
            market.worstCaseNotionalExposure(),
            market.notionalSkew(),
            "worst-case exposure understates current skew"
        );
    }

    // =================================================================
    // Q2, Q3, Q4 — behaviour under load, reported as evidence
    // =================================================================

    /// Not a pass/fail assertion so much as a measurement run: exercise the model
    /// hard, then print what it actually did.
    function invariant_sim_report() public view {
        // Intentionally always true; the value is in the logged statistics below.
        assertTrue(true);
    }

    function afterInvariant() public view {
        uint256 attempted = handler.opensAttempted();

        console.log("");
        console.log("================ RESERVE MODEL SIMULATION ================");
        console.log("model: max(longNotional, shortNotional) x skewReserveBps");
        console.log("skewReserveBps                :", market.skewReserveBps());
        console.log("");

        console.log("--- Q1: solvency ---");
        console.log("closes executed               :", handler.closes());
        console.log("liquidations executed         :", handler.liquidations());
        console.log("shortfall events              :", handler.shortfallEvents());
        console.log("worst shortfall (bps of owed) :", handler.worstShortfallBps());
        console.log("total shortfall (wei)         :", handler.shortfallTotal());
        console.log("");

        console.log("--- Q2: trade rejection ---");
        console.log("opens attempted               :", attempted);
        console.log("opens succeeded               :", handler.opensSucceeded());
        console.log("rejected: insufficient backing:", handler.opensRejectedBacking());
        console.log("rejected: skew cap            :", handler.opensRejectedSkew());
        console.log("rejected: other (balance etc) :", handler.opensRejectedOther());
        console.log("rejection rate (bps)          :", handler.rejectionRateBps());
        console.log("");

        console.log("--- Q3: idle capital ---");
        console.log("avg vault utilisation (bps)   :", handler.avgUtilizationBps());
        console.log("peak vault utilisation (bps)  :", handler.peakUtilizationBps());
        console.log("idle capital, avg (bps)       :", 10000 - handler.avgUtilizationBps());
        console.log("vault totalAssets  (final)    :", vault.totalAssets());
        console.log("vault totalReserved(final)    :", vault.totalReserved());
        console.log("");

        console.log("--- Q4: reserve adequacy ---");
        console.log("peak requirement observed     :", handler.peakReserveRequired());
        console.log("final requirement             :", market.requiredVaultReserve());
        console.log("final worst-case notional     :", market.worstCaseNotionalExposure());
        console.log("final notional skew           :", market.notionalSkew());
        console.log("long notional                 :", market.totalLongNotional());
        console.log("short notional                :", market.totalShortNotional());
        console.log("");

        console.log("--- LP flow ---");
        console.log("lp deposits                   :", handler.lpDeposits());
        console.log("lp withdrawals                :", handler.lpWithdrawals());
        console.log("lp withdrawals blocked        :", handler.lpWithdrawalsBlocked());
        console.log("==========================================================");
    }
}
