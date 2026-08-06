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

contract McToken is ERC20 {
    constructor() ERC20("Mock USDT", "mUSDT") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Monte Carlo evidence for the notional reserve model.
///
/// Foundry's invariant runner resets state between runs, so per-run counters
/// only ever reflect the final short run. This drives one long continuous
/// simulation instead, so the statistics describe a single market's whole life
/// rather than a 64-call fragment.
///
/// Scale is chosen so utilisation is actually exercised: positions are sized
/// relative to the pool, not to an arbitrary constant, otherwise the reserve
/// model is never put under pressure and the run proves nothing.
contract ReserveMonteCarloTest is Test {
    BreezeAccessControl accessControl;
    MockWeatherOracle oracle;
    FeeConfig feeConfig;
    ProtocolTreasury treasury;
    InsuranceFund insuranceFund;
    BreezeLiquidityVault vault;
    McToken token;
    BreezePerpMarket market;

    address admin = address(this);
    bytes32 constant REGION = keccak256("TOKYO_RAINFALL");

    uint256 constant TRADERS = 40;
    uint256 constant LPS = 6;
    uint256 constant ACTIONS = 3000;

    address[] traders;
    address[] lps;
    uint256[] openIds;

    uint256 rng;

    // stats
    uint256 opensAttempted;
    uint256 opensSucceeded;
    uint256 rejBacking;
    uint256 rejSkew;
    uint256 rejOther;
    uint256 closes;
    uint256 liqs;
    uint256 shortfalls;
    uint256 worstShortfallBps;
    uint256 utilSamples;
    uint256 utilSum;
    uint256 peakUtil;
    uint256 peakRequirement;
    uint256 peakExposure;
    uint256 lpWithdrawBlocked;
    uint256 lpWithdrawOk;

    function _rand(uint256 mod) internal returns (uint256) {
        rng = uint256(keccak256(abi.encode(rng, block.timestamp)));
        return mod == 0 ? 0 : rng % mod;
    }

    function setUp() public {
        rng = 0xB6EEBE;
        opensAttempted = 0; opensSucceeded = 0; rejBacking = 0; rejSkew = 0; rejOther = 0;
        closes = 0; liqs = 0; shortfalls = 0; worstShortfallBps = 0;
        utilSamples = 0; utilSum = 0; peakUtil = 0; peakRequirement = 0; peakExposure = 0;
        lpWithdrawBlocked = 0; lpWithdrawOk = 0;
        delete openIds; delete traders; delete lps;
        accessControl = new BreezeAccessControl(admin);
        accessControl.grantRole(accessControl.ORACLE_UPDATER_ROLE(), admin);
        token = new McToken();
        oracle = new MockWeatherOracle(address(accessControl));

        feeConfig = new FeeConfig(address(accessControl));
        treasury = new ProtocolTreasury(address(token), address(accessControl));
        insuranceFund = new InsuranceFund(address(token), address(accessControl));
        vault = new BreezeLiquidityVault(token, address(accessControl), "Breeze LP", "bLP");

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
        vault.setMarketAuthorization(address(market), true);
        market.setLiquidityVault(address(vault));

        for (uint256 i = 0; i < TRADERS; i++) {
            address t = address(uint160(0x10000 + i));
            traders.push(t);
            token.mint(t, 1_000_000e18);
            vm.prank(t);
            token.approve(address(market), type(uint256).max);
        }
        for (uint256 i = 0; i < LPS; i++) {
            address l = address(uint160(0x20000 + i));
            lps.push(l);
            token.mint(l, 1_000_000e18);
            vm.prank(l);
            token.approve(address(vault), type(uint256).max);
        }

        vm.prank(lps[0]);
        vault.deposit(400_000e18, lps[0]);
        oracle.setReading(REGION, block.timestamp, 25e6);
    }

    function _sample() internal {
        uint256 a = vault.totalAssets();
        if (a > 0) {
            uint256 u = (vault.totalReserved() * 10000) / a;
            if (u > 10000) u = 10000;
            utilSum += u;
            utilSamples += 1;
            if (u > peakUtil) peakUtil = u;
        }
        uint256 req = market.requiredVaultReserve();
        if (req > peakRequirement) peakRequirement = req;
        uint256 exp_ = market.worstCaseNotionalExposure();
        if (exp_ > peakExposure) peakExposure = exp_;
    }

    function _open() internal {
        address t = traders[_rand(TRADERS)];
        uint256 collateral = 5_000e18 + _rand(60_000e18);
        uint256 lev = 1 + _rand(PerpConstants.MAX_LEVERAGE);
        bool isLong = _rand(2) == 0;
        if (token.balanceOf(t) < collateral) return;

        opensAttempted += 1;
        vm.prank(t);
        try market.openPosition(isLong, collateral, lev) returns (uint256 id) {
            opensSucceeded += 1;
            openIds.push(id);
        } catch (bytes memory reason) {
            bytes4 sel;
            if (reason.length >= 4) {
                assembly {
                    sel := mload(add(reason, 0x20))
                }
            }
            // `ExceedsNotionalCapacity` is the PREVENTIVE refusal and is now the
            // dominant one. Before it was counted here the sweep reported a 0%
            // rejection rate while a tenth of all opens were being refused — the
            // metric had gone blind to the mechanism it exists to measure.
            if (
                sel == BreezePerpMarket.InsufficientVaultBacking.selector ||
                sel == BreezePerpMarket.ExceedsNotionalCapacity.selector
            ) rejBacking += 1;
            else if (sel == BreezePerpMarket.SkewCapExceeded.selector) rejSkew += 1;
            else rejOther += 1;
        }
    }

    function _close() internal {
        if (openIds.length == 0) return;
        uint256 idx = _rand(openIds.length);
        uint256 id = openIds[idx];
        (address trader,, uint256 collateral,,,,, bool isOpen) = market.positions(id);
        if (!isOpen) {
            _drop(idx);
            return;
        }

        int256 equity = int256(collateral) + market.calculateUnrealizedPnl(id);
        uint256 owed = equity > 0 ? uint256(equity) : 0;

        uint256 before = token.balanceOf(trader);
        vm.prank(trader);
        try market.closePosition(id) {
            closes += 1;
            uint256 got = token.balanceOf(trader) - before;
            if (owed > 0 && got < (owed * 9900) / 10000) {
                shortfalls += 1;
                uint256 bps = ((owed - got) * 10000) / owed;
                if (bps > worstShortfallBps) worstShortfallBps = bps;
            }
            _drop(idx);
        } catch {}
    }

    function _liquidate() internal {
        if (openIds.length == 0) return;
        uint256 idx = _rand(openIds.length);
        uint256 id = openIds[idx];
        (,,,,,,, bool isOpen) = market.positions(id);
        if (!isOpen) {
            _drop(idx);
            return;
        }
        if (!market.isLiquidatable(id)) return;
        vm.prank(traders[_rand(TRADERS)]);
        try market.liquidate(id) {
            liqs += 1;
            _drop(idx);
        } catch {}
    }

    function _drop(uint256 idx) internal {
        openIds[idx] = openIds[openIds.length - 1];
        openIds.pop();
    }

    function _lpFlow() internal {
        address l = lps[_rand(LPS)];
        if (_rand(2) == 0) {
            uint256 amt = 10_000e18 + _rand(150_000e18);
            if (token.balanceOf(l) < amt) return;
            vm.prank(l);
            try vault.deposit(amt, l) {} catch {}
        } else {
            vm.prank(l);
            vault.requestWithdrawal();
            vm.warp(block.timestamp + vault.withdrawalCooldown());
            uint256 max = vault.maxRedeem(l);
            if (max == 0) {
                lpWithdrawBlocked += 1;
                return;
            }
            vm.prank(l);
            try vault.redeem(1 + _rand(max), l, l) {
                lpWithdrawOk += 1;
            } catch {
                lpWithdrawBlocked += 1;
            }
        }
    }

    function _weather() internal {
        vm.warp(block.timestamp + market.fundingInterval() + _rand(2 days));
        oracle.setReading(REGION, block.timestamp, int256(1e6 + _rand(400e6)));
        try market.settleFunding() {} catch {}
    }

    /// @dev Reserve sizing has to be calibrated against the WORST parameters the
    /// protocol permits, not the ones it expects. Insurance capital is sized on the
    /// tail. Under production funding (8-hour interval, 0.75% cap) the dominant loss
    /// channel is small enough that every coverage ratio survives, so that regime
    /// cannot discriminate between them — it says the protocol is comfortable, not
    /// that 30% is safe. The aggressive preset is the calibration-relevant case, and
    /// it remains reachable: `setFundingParams` allows it, and the demo deployment
    /// uses it.
    function _applyAggressiveFunding() internal {
        market.setFundingParams(
            PerpConstants.FUNDING_INTERVAL, PerpConstants.MAX_FUNDING_RATE_PER_PERIOD
        );
    }

    /// Sweep the coverage ratio to locate the solvency//capacity frontier.
    /// Reported, not asserted — the point is to find where the model actually
    /// sits, not to assume a parameter and hope.
    function test_sweep_coverage_ratio() public {
        _sweep(true);
    }

    /// The same sweep under production funding parameters, for comparison. Expected
    /// to be undiscriminating; recorded so the contrast with the stressed regime is
    /// visible rather than asserted from memory.
    function test_sweep_coverage_ratio_production_funding() public {
        _sweep(false);
    }

    /// Multi-seed sweep under the stressed regime.
    ///
    /// @dev The single-seed sweep is enough to show that 30% fails, because a
    /// failure on any path is a failure. It is NOT enough to justify *lowering* the
    /// coverage ratio: "zero shortfalls" on one path can be luck, and the earlier
    /// 50% run showed two shortfalls where this one shows none. The error is
    /// asymmetric — being wrong about capacity costs some rejected trades, being
    /// wrong about solvency means a trader is not paid — so the bar for lowering it
    /// is several paths agreeing.
    /// @dev Split one test per ratio so each gets its own gas budget. Run LENGTH
    /// matters as much as seed count: at 450 actions per seed every ratio including
    /// 30% showed zero shortfalls, while at 900 the 30% setting fails. A short run
    /// simply has not accumulated enough exposure to stress the reserve, so a sweep
    /// that is too small reports safety it has not tested for.
    uint256 constant SWEEP_SEEDS = 3;
    uint256 constant SWEEP_ACTIONS = 900;

    function test_multi_seed_coverage_3000() public {
        _multiSeedAt(3000);
    }

    function test_multi_seed_coverage_5000() public {
        _multiSeedAt(5000);
    }

    function test_multi_seed_coverage_7500() public {
        _multiSeedAt(7500);
    }

    function test_multi_seed_coverage_10000() public {
        _multiSeedAt(10000);
    }

    function _multiSeedAt(uint16 ratio) internal {
        uint256 totalShortfalls;
        uint256 worstAny;
        uint256 rejSum;
        uint256 drained;

        for (uint256 s = 0; s < SWEEP_SEEDS; s++) {
            setUp();
            rng = uint256(keccak256(abi.encode("breeze-sweep", s)));
            _applyAggressiveFunding();
            market.setSkewReserveBps(ratio);
            _runN(SWEEP_ACTIONS);

            totalShortfalls += shortfalls;
            if (worstShortfallBps > worstAny) worstAny = worstShortfallBps;
            rejSum += opensAttempted == 0
                ? 0
                : ((rejBacking + rejSkew) * 10000) / opensAttempted;
            if (vault.totalAssets() < 50_000e18) drained += 1;
        }

        console.log("--------------------------------------------------");
        console.log("coverage ratio (bps)          :", ratio);
        console.log("  seeds / actions each        :", SWEEP_SEEDS, SWEEP_ACTIONS);
        console.log("  TOTAL shortfall events      :", totalShortfalls);
        console.log("  worst shortfall (bps)       :", worstAny);
        console.log("  mean rejection rate (bps)   :", rejSum / SWEEP_SEEDS);
        console.log("  seeds ending near-drained   :", drained);
    }

    function _sweep(bool aggressive) internal {
        console.log(aggressive ? "=== SWEEP: aggressive funding ===" : "=== SWEEP: production funding ===");
        uint16[4] memory ratios = [3000, 5000, 7500, 10000];
        for (uint256 i = 0; i < ratios.length; i++) {
            setUp();
            if (aggressive) _applyAggressiveFunding();
            market.setSkewReserveBps(ratios[i]);
            _runN(1200);
            uint256 avgUtil = utilSamples == 0 ? 0 : utilSum / utilSamples;
            uint256 rejRate =
                opensAttempted == 0 ? 0 : ((rejBacking + rejSkew) * 10000) / opensAttempted;

            console.log("--------------------------------------------------");
            console.log("coverage ratio (bps)          :", ratios[i]);
            console.log("  closes                      :", closes);
            console.log("  SHORTFALL EVENTS            :", shortfalls);
            console.log("  worst shortfall (bps)       :", worstShortfallBps);
            console.log("  opens attempted             :", opensAttempted);
            console.log("  opens succeeded             :", opensSucceeded);
            console.log("  rejection rate (bps)        :", rejRate);
            console.log("  avg utilisation (bps)       :", avgUtil);
            console.log("  final vault assets          :", vault.totalAssets());
        }
    }

    function _run() internal {
        _runN(ACTIONS);
    }

    function _runN(uint256 n) internal {
        for (uint256 i = 0; i < n; i++) {
            uint256 roll = _rand(100);
            if (roll < 34) _open();
            else if (roll < 60) _close();
            else if (roll < 70) _liquidate();
            else if (roll < 85) _lpFlow();
            else _weather();

            _sample();

            // Solvency must hold continuously, not just at the end.
            assertLe(
                vault.convertToAssets(vault.totalSupply()),
                vault.totalAssets(),
                "share claims exceeded assets mid-run"
            );
        }
    }

    function test_monte_carlo_reserve_model() public {
        _run();

        uint256 avgUtil = utilSamples == 0 ? 0 : utilSum / utilSamples;
        uint256 rejRate = opensAttempted == 0
            ? 0
            : ((rejBacking + rejSkew) * 10000) / opensAttempted;

        console.log("");
        console.log("=========== MONTE CARLO: NOTIONAL RESERVE MODEL ===========");
        console.log("actions simulated             :", ACTIONS);
        console.log("traders / LPs                 :", TRADERS, LPS);
        console.log("skewReserveBps                :", market.skewReserveBps());
        console.log("");
        console.log("--- Q1: solvency ---");
        console.log("closes                        :", closes);
        console.log("liquidations                  :", liqs);
        console.log("shortfall events              :", shortfalls);
        console.log("worst shortfall (bps of owed) :", worstShortfallBps);
        console.log("");
        console.log("--- Q2: trade rejection ---");
        console.log("opens attempted               :", opensAttempted);
        console.log("opens succeeded               :", opensSucceeded);
        console.log("rejected: backing             :", rejBacking);
        console.log("rejected: skew cap            :", rejSkew);
        console.log("rejected: other               :", rejOther);
        console.log("rejection rate (bps)          :", rejRate);
        console.log("");
        console.log("--- Q3: idle capital ---");
        console.log("avg utilisation (bps)         :", avgUtil);
        console.log("peak utilisation (bps)        :", peakUtil);
        console.log("idle capital avg (bps)        :", 10000 - avgUtil);
        console.log("");
        console.log("--- Q4: reserve adequacy ---");
        console.log("peak notional exposure        :", peakExposure);
        console.log("peak reserve requirement      :", peakRequirement);
        console.log("final vault assets            :", vault.totalAssets());
        console.log("final reserved                :", vault.totalReserved());
        console.log("");
        console.log("--- LP flow ---");
        console.log("lp withdrawals ok             :", lpWithdrawOk);
        console.log("lp withdrawals blocked        :", lpWithdrawBlocked);
        console.log("==========================================================");

        // The one hard assertion: the protocol never failed to pay a position
        // it had itself priced.
        assertEq(shortfalls, 0, "protocol failed to honour a position it priced");
    }
}
