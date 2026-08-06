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
import "../../src/vault/JuniorTranche.sol";

contract NmToken is ERC20 {
    constructor() ERC20("Mock USDT", "mUSDT") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Deterministic worst-case scenarios.
///
/// Monte Carlo samples the middle of the distribution. It runs thousands of
/// plausible histories and, precisely because they are plausible, it almost never
/// constructs the specific adversarial arrangement that breaks something — every
/// trader on one side, every LP leaving on the same block, every position
/// liquidatable at once. Those are the states an attacker builds on purpose, and
/// they have to be written down rather than waited for.
///
/// Each scenario below states the property that must survive it. Where a scenario
/// is expected to be REFUSED, the refusal itself is the pass: a protocol that
/// accepts unlimited one-sided risk has not survived scenario 1, it has failed it
/// quietly.
contract NightmareScenariosTest is Test {
    BreezeAccessControl accessControl;
    MockWeatherOracle oracle;
    FeeConfig feeConfig;
    ProtocolTreasury treasury;
    InsuranceFund insuranceFund;
    BreezeLiquidityVault vault;
    JuniorTranche junior;
    NmToken token;
    BreezePerpMarket market;

    address admin = address(this);
    bytes32 constant REGION = keccak256("TOKYO_RAINFALL");

    uint256 constant TRADER_COUNT = 100;
    uint256 constant LP_COUNT = 8;

    address[] traders;
    address[] lps;

    function setUp() public {
        vm.warp(1_700_000_000);

        accessControl = new BreezeAccessControl(admin);
        accessControl.grantRole(accessControl.ORACLE_UPDATER_ROLE(), admin);

        token = new NmToken();
        oracle = new MockWeatherOracle(address(accessControl));
        feeConfig = new FeeConfig(address(accessControl));
        treasury = new ProtocolTreasury(address(token), address(accessControl));
        insuranceFund = new InsuranceFund(address(token), address(accessControl));
        vault = new BreezeLiquidityVault(token, address(accessControl), "Breeze LP", "bLP");
        junior = new JuniorTranche(token, address(accessControl), "Breeze Junior", "bJNR");

        market = new BreezePerpMarket(
            VirtualAMM.Reserves({collateralReserve: 2_000_000e18, weatherReserve: 80_000e18}),
            address(oracle),
            address(insuranceFund),
            address(feeConfig),
            address(treasury),
            address(accessControl),
            address(token),
            REGION
        );

        insuranceFund.setMarketAuthorization(address(market), true);
        insuranceFund.setMarketAuthorization(address(vault), true);
        vault.setMarketAuthorization(address(market), true);
        market.setLiquidityVault(address(vault));
        // These scenarios exist to test adversarial behaviour under the WORST
        // parameters the protocol permits, so they adopt the demo preset
        // deliberately rather than the production default.
        market.setFundingParams(
            PerpConstants.FUNDING_INTERVAL, PerpConstants.MAX_FUNDING_RATE_PER_PERIOD
        );

        // Full waterfall wired.
        vault.setFirstLossFund(address(insuranceFund));
        vault.setJuniorTranche(address(junior));
        junior.setSeniorVault(address(vault));

        for (uint256 i = 0; i < TRADER_COUNT; i++) {
            address t = address(uint160(0x100000 + i));
            traders.push(t);
            token.mint(t, 2_000_000e18);
            vm.prank(t);
            token.approve(address(market), type(uint256).max);
        }
        for (uint256 i = 0; i < LP_COUNT; i++) {
            address l = address(uint160(0x200000 + i));
            lps.push(l);
            token.mint(l, 2_000_000e18);
            vm.startPrank(l);
            token.approve(address(vault), type(uint256).max);
            token.approve(address(junior), type(uint256).max);
            vm.stopPrank();
        }

        // 8 senior LPs x 100k, plus a 200k junior tranche.
        for (uint256 i = 0; i < LP_COUNT; i++) {
            vm.prank(lps[i]);
            vault.deposit(100_000e18, lps[i]);
        }
        address jlp = address(uint160(0x300001));
        token.mint(jlp, 200_000e18);
        vm.startPrank(jlp);
        token.approve(address(junior), type(uint256).max);
        junior.deposit(200_000e18, jlp);
        vm.stopPrank();

        oracle.setReading(REGION, block.timestamp, 25e6);
    }

    // -----------------------------------------------------------------
    // Shared invariant checks
    // -----------------------------------------------------------------

    /// The two structural properties that must hold in every scenario, whatever
    /// else happened.
    function _assertCoreSolvency(string memory ctx) internal view {
        assertLe(
            vault.convertToAssets(vault.totalSupply()),
            vault.totalAssets(),
            string.concat(ctx, ": senior share claims exceed senior assets")
        );
        uint256 backing = vault.totalBackingAssets();
        if (backing > 0) {
            uint256 util = (vault.totalReserved() * 10000) / backing;
            assertLe(util, vault.maxUtilizationBps(), string.concat(ctx, ": utilisation above cap"));
        } else {
            assertEq(vault.totalReserved(), 0, string.concat(ctx, ": reserved against nothing"));
        }
    }

    // =================================================================
    // S1 — 100 traders, all maximum leverage, all the same direction
    // =================================================================

    /// The canonical failure mode for a weather derivative: hedging demand is
    /// structurally one-sided, so "everyone wants the same side" is the base case,
    /// not the tail. Unlimited acceptance here is what turns an LP pool into a
    /// counterparty to a bet it cannot cover.
    function test_S1_one_hundred_traders_all_max_long() public {
        uint256 accepted;
        uint256 refused;
        uint256[] memory ids = new uint256[](TRADER_COUNT);

        for (uint256 i = 0; i < TRADER_COUNT; i++) {
            vm.prank(traders[i]);
            try market.openPosition(true, 50_000e18, PerpConstants.MAX_LEVERAGE) returns (uint256 id) {
                ids[accepted++] = id;
            } catch {
                refused += 1;
            }
            _assertCoreSolvency("S1");
        }

        console.log("S1 accepted / refused         :", accepted, refused);
        console.log("S1 worst-case notional        :", market.worstCaseNotionalExposure());
        console.log("S1 notional capacity          :", market.maxNotionalCapacity());
        console.log("S1 required reserve           :", market.requiredVaultReserve());
        console.log("S1 vault reserved             :", vault.totalReserved());

        // Refusal is the pass condition. 100 traders at 150k notional each is 15m
        // of one-sided exposure against a 1m pool; anything approaching full
        // acceptance would mean the cap is not doing its job.
        assertGt(refused, 0, "protocol accepted unlimited one-sided risk");

        // Exposure must be inside what the backing supports.
        assertLe(
            market.worstCaseNotionalExposure(),
            market.maxNotionalCapacity(),
            "exposure exceeds stated capacity"
        );

        // Everything accepted must remain exitable. A position the protocol agreed
        // to open and cannot close is strictly worse than one it refused.
        for (uint256 i = 0; i < accepted; i++) {
            (address trader,,,,,,, bool isOpen) = market.positions(ids[i]);
            if (!isOpen) continue;
            vm.prank(trader);
            market.closePosition(ids[i]);
        }
        _assertCoreSolvency("S1 post-unwind");
        assertEq(market.totalLongNotional(), 0, "notional not fully released");
    }

    // =================================================================
    // S2 — every LP exits at the first legally permitted moment
    // =================================================================

    /// A bank run executed perfectly: no LP hesitates, none waits longer than the
    /// contract forces them to. The cooldown cannot prevent this — it is not meant
    /// to. What must hold is that the utilisation floor still binds, so live
    /// positions are never left backed by nothing.
    function test_S2_all_lps_exit_at_first_legal_opportunity() public {
        // Live risk on the book first, so there is something to strand.
        uint256[] memory ids = new uint256[](6);
        for (uint256 i = 0; i < 6; i++) {
            vm.prank(traders[i]);
            ids[i] = market.openPosition(i % 2 == 0, 40_000e18, 2);
        }
        uint256 reservedBefore = vault.totalReserved();
        assertGt(reservedBefore, 0, "no capital reserved - scenario is vacuous");

        // Everyone requests on the same block.
        for (uint256 i = 0; i < LP_COUNT; i++) {
            vm.prank(lps[i]);
            vault.requestWithdrawal();
        }
        address jlp = address(uint160(0x300001));
        vm.prank(jlp);
        junior.requestWithdrawal();

        // Each tranche exits the instant ITS OWN cooldown matures — that is what
        // "first legal opportunity" means, and the two cooldowns differ.
        //
        // An earlier version warped straight to the junior cooldown (7 days) and
        // reported zero senior exits, which looked like the floor holding. It was
        // not: senior matures at 3 days and its request LAPSES 2 days later, so
        // every senior LP had simply missed the window. The scenario proved nothing
        // and passed anyway.
        vm.warp(block.timestamp + vault.withdrawalCooldown());

        uint256 exited;
        for (uint256 i = 0; i < LP_COUNT; i++) {
            uint256 max = vault.maxRedeem(lps[i]);
            if (max == 0) continue;
            vm.prank(lps[i]);
            vault.redeem(max, lps[i], lps[i]);
            exited += 1;
            _assertCoreSolvency("S2 senior run");
        }
        assertGt(exited, 0, "no senior LP could exit at all - scenario is vacuous");

        // Junior's cooldown is longer, so it comes out later.
        vm.warp(block.timestamp + junior.withdrawalCooldown() - vault.withdrawalCooldown());
        uint256 jmax = junior.maxRedeem(jlp);
        if (jmax > 0) {
            vm.prank(jlp);
            junior.redeem(jmax, jlp, jlp);
        }

        console.log("S2 senior LPs that exited     :", exited, "of", LP_COUNT);
        console.log("S2 backing remaining          :", vault.totalBackingAssets());
        console.log("S2 still reserved             :", vault.totalReserved());

        _assertCoreSolvency("S2 post-run");

        // The floor must have retained capital against the live book.
        assertGe(
            vault.totalBackingAssets(),
            vault.minRequiredAssets(),
            "run drained backing below the utilisation floor"
        );

        // And the positions must still be closable afterwards.
        for (uint256 i = 0; i < 6; i++) {
            (address trader,,,,,,, bool isOpen) = market.positions(ids[i]);
            if (!isOpen) continue;
            vm.prank(trader);
            market.closePosition(ids[i]);
        }
        _assertCoreSolvency("S2 post-unwind");
    }

    // =================================================================
    // S3 — the largest weather move the oracle can express
    // =================================================================

    /// Funding is driven by the mark/index gap, and the index comes straight from
    /// an oracle whose range the protocol does not control. The rate must saturate
    /// at the documented cap rather than propagating an unbounded number into
    /// every open position's PnL.
    function test_S3_largest_weather_jump_the_oracle_allows() public {
        uint256[] memory ids = new uint256[](4);
        for (uint256 i = 0; i < 4; i++) {
            vm.prank(traders[i]);
            ids[i] = market.openPosition(i % 2 == 0, 30_000e18, 2);
        }

        // Floor to ceiling in a single reading.
        vm.warp(block.timestamp + 16 minutes);
        oracle.setReading(REGION, block.timestamp, 1);
        market.settleFunding();
        int256 afterFloor = market.cumulativeFundingIndex();

        vm.warp(block.timestamp + 16 minutes);
        oracle.setReading(REGION, block.timestamp, type(int128).max);
        market.settleFunding();
        int256 afterCeiling = market.cumulativeFundingIndex();

        int256 step = afterCeiling - afterFloor;
        console.log("S3 funding index after floor  :", afterFloor);
        console.log("S3 funding index after ceiling:", afterCeiling);

        int256 cap = int256(market.maxFundingRateBps());
        assertLe(step, cap, "single-interval funding move exceeded the cap");
        assertGe(step, -cap, "single-interval funding move exceeded the cap");

        // An extreme index must not make positions unexitable.
        for (uint256 i = 0; i < 4; i++) {
            (address trader,,,,,,, bool isOpen) = market.positions(ids[i]);
            if (!isOpen) continue;
            vm.prank(trader);
            market.closePosition(ids[i]);
        }
        _assertCoreSolvency("S3");
    }

    /// A negative reading must be refused outright. Casting it would wrap to
    /// ~2^256, read as an astronomically high index, and pin funding at the cap in
    /// the wrong direction — a silent catastrophe rather than a loud failure.
    function test_S3b_negative_reading_is_refused_not_wrapped() public {
        vm.warp(block.timestamp + 16 minutes);
        oracle.setReading(REGION, block.timestamp, -500);

        vm.expectRevert(
            abi.encodeWithSelector(BreezePerpMarket.NonPositiveIndexPrice.selector, int256(-500))
        );
        market.settleFunding();
    }

    // =================================================================
    // S4 — every position becomes liquidatable in the same update
    // =================================================================

    /// Mass liquidation is where perps historically break: the keeper path is the
    /// only thing keeping the book solvent, so it is the one path that must never
    /// be blocked — not by a thin market balance, not by an exhausted insurance
    /// fund, not by a paused contract.
    function test_S4_all_liquidations_in_one_update() public {
        uint256 n = 10;
        uint256[] memory ids = new uint256[](n);
        uint256 opened;
        for (uint256 i = 0; i < n; i++) {
            vm.prank(traders[i]);
            try market.openPosition(true, 30_000e18, PerpConstants.MAX_LEVERAGE) returns (uint256 id) {
                ids[opened++] = id;
            } catch {}
        }
        assertGt(opened, 0, "no positions opened - scenario is vacuous");

        // Drive funding hard against every long, in one direction, until the book
        // is underwater. Index far BELOW mark makes the rate positive: longs pay.
        for (uint256 k = 0; k < 60; k++) {
            vm.warp(block.timestamp + 16 minutes);
            oracle.setReading(REGION, block.timestamp, 1e6);
            market.settleFunding();
        }

        uint256 liquidatable;
        for (uint256 i = 0; i < opened; i++) {
            if (market.isLiquidatable(ids[i])) liquidatable += 1;
        }
        console.log("S4 liquidatable positions     :", liquidatable, "of", opened);
        assertGt(liquidatable, 0, "funding never pushed anything underwater");

        // Pause the market. A pause must not block liquidation — it is the one
        // path that keeps the book solvent, so it is exempt by design.
        accessControl.grantRole(accessControl.PAUSER_ROLE(), admin);
        market.pauseOpens();

        uint256 liquidated;
        for (uint256 i = 0; i < opened; i++) {
            if (!market.isLiquidatable(ids[i])) continue;
            vm.prank(traders[TRADER_COUNT - 1]);
            market.liquidate(ids[i]); // must NOT revert
            liquidated += 1;
            _assertCoreSolvency("S4 cascade");
        }

        console.log("S4 liquidated                  :", liquidated);
        assertEq(liquidated, liquidatable, "a liquidatable position could not be liquidated");

        // Nothing may be left both open and liquidatable.
        for (uint256 i = 0; i < opened; i++) {
            (,,,,,,, bool isOpen) = market.positions(ids[i]);
            if (isOpen) {
                assertFalse(
                    market.isLiquidatable(ids[i]),
                    "position left open while liquidatable"
                );
            }
        }
        _assertCoreSolvency("S4 post-cascade");
    }

    // =================================================================
    // S5 — largest possible position opened immediately before settlement
    // =================================================================

    /// The adverse-selection play: size up to the limit in the last block before a
    /// funding settlement whose direction is already known, collect, and leave. It
    /// must not be profitable beyond what the funding rate itself pays, and it
    /// must not be able to extract more than the protocol reserved against it.
    function test_S5_largest_position_opened_immediately_before_settlement() public {
        // Move to the last moment before funding is settleable.
        vm.warp(market.lastFundingSettledAt() + PerpConstants.FUNDING_INTERVAL - 1);

        // Index far above mark, so the coming settlement pays longs. Published
        // before the trade — that visibility is the whole premise of the attack.
        oracle.setReading(REGION, block.timestamp, 400e6);

        // Take the largest position the cap will allow, in the favoured direction.
        uint256 room = market.availableNotional(true);
        uint256 collateral = room / PerpConstants.MAX_LEVERAGE;
        if (collateral > 400_000e18) collateral = 400_000e18;
        assertGt(collateral, 0, "no room to open - scenario is vacuous");

        address whale = traders[0];
        uint256 balBefore = token.balanceOf(whale);

        vm.prank(whale);
        uint256 id = market.openPosition(true, collateral, PerpConstants.MAX_LEVERAGE);

        console.log("S5 whale collateral            :", collateral);
        console.log("S5 notional capacity           :", market.maxNotionalCapacity());
        console.log("S5 worst-case exposure         :", market.worstCaseNotionalExposure());

        // Exposure must still be inside capacity even for a single maximal trade.
        assertLe(
            market.worstCaseNotionalExposure(),
            market.maxNotionalCapacity(),
            "a single maximal trade escaped the capacity cap"
        );

        // Settlement lands, then the whale leaves immediately. The reading has to
        // be republished at the new timestamp: `getReading` reports invalid when
        // the latest reading predates the requested time.
        vm.warp(block.timestamp + 1);
        oracle.setReading(REGION, block.timestamp, 400e6);
        market.settleFunding();
        vm.prank(whale);
        market.closePosition(id);

        uint256 balAfter = token.balanceOf(whale);
        int256 pnl = int256(balAfter) - int256(balBefore);
        console.log("S5 whale net (negative = loss) :", pnl);

        // One interval of funding is capped at this market's own rate ceiling
        // applied to notional. Profit beyond that would mean value came from
        // somewhere the funding maths does not account for.
        uint256 notional = collateral * PerpConstants.MAX_LEVERAGE;
        int256 ceiling =
            (int256(notional) * int256(market.maxFundingRateBps())) / 10000;
        assertLe(pnl, ceiling, "extracted more than one interval of funding could pay");

        _assertCoreSolvency("S5");
    }

    /// The same play run repeatedly: open before each settlement, close after.
    /// A single round trip being bounded is not enough if the loop is a pump.
    ///
    /// This test FOUND that it was a pump. Before funding epochs, 20 rounds of the
    /// sandwich extracted 434,752 from a 1,000,000 pool — 43% — because a position
    /// received a full interval of capped funding no matter how briefly it had been
    /// open. Continuous time-weighted accrual removes the free interval — a position
    /// held for one second of a 900-second interval earns one second of funding — so
    /// the loop is no longer self-financing.
    ///
    /// Note what this test does NOT claim. Holding through a full interval on the
    /// favourable side of funding *is* profitable, and should be: that is the
    /// mechanism working, and the pool is the counterparty to a one-sided book by
    /// design. What must not be profitable is collecting an interval's funding
    /// without bearing an interval's exposure.
    function test_S5b_repeated_settlement_sandwich_is_not_profitable() public {
        address whale = traders[1];
        uint256 balBefore = token.balanceOf(whale);
        uint256 seniorBefore = vault.totalAssets();
        uint256 backingBefore = vault.totalBackingAssets();

        uint256 rounds;
        for (uint256 k = 0; k < 20; k++) {
            // Sit at the LAST moment before settlement is permitted, so the position
            // exists for one second of the interval. Warping a full interval here
            // instead would make this a legitimate full-interval hold — which earns
            // funding, correctly, and would not be a sandwich at all.
            vm.warp(market.lastFundingSettledAt() + PerpConstants.FUNDING_INTERVAL - 1);
            oracle.setReading(REGION, block.timestamp, 400e6);

            uint256 room = market.availableNotional(true);
            uint256 collateral = room / PerpConstants.MAX_LEVERAGE;
            if (collateral > 150_000e18) collateral = 150_000e18;
            if (collateral == 0) break;

            vm.prank(whale);
            uint256 id = market.openPosition(true, collateral, PerpConstants.MAX_LEVERAGE);

            vm.warp(block.timestamp + 1);
            oracle.setReading(REGION, block.timestamp, 400e6);
            market.settleFunding();

            vm.prank(whale);
            market.closePosition(id);
            rounds += 1;
            _assertCoreSolvency("S5b");
        }
        assertGt(rounds, 15, "sandwich loop barely ran - test is vacuous");

        int256 whalePnl = int256(token.balanceOf(whale)) - int256(balBefore);
        console.log("S5b whale net over 20 rounds   :", whalePnl);
        console.log("S5b backing before             :", backingBefore);
        console.log("S5b backing after              :", vault.totalBackingAssets());

        _assertCoreSolvency("S5b final");

        // The sandwich must be a losing strategy. The whale pays fees and slippage on
        // every round trip and, with time-weighted accrual, collects only the funding
        // its one second of exposure earned — so it comes out behind.
        assertLt(whalePnl, 0, "settlement sandwich is profitable - funding is being farmed");

        // And the pool must not have been drained by it.
        assertGe(
            vault.totalBackingAssets(),
            backingBefore,
            "repeated sandwiching drained the pool"
        );

        // Ordering still has to hold if senior did lose anything.
        if (vault.totalAssets() < seniorBefore) {
            assertEq(
                junior.backingAssets(),
                0,
                "senior lost value while junior still had capital to lose"
            );
        }
    }
}
