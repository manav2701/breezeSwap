// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/governance/TimelockController.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../src/access/BreezeAccessControl.sol";
import "../src/core/BreezeMarket.sol";
import "../src/core/BreezeMarketFactory.sol";
import "../src/core/PositionToken.sol";
import "../src/fees/FeeConfig.sol";
import "../src/fees/ProtocolTreasury.sol";
import "../src/oracle/MockWeatherOracle.sol";
import "../src/oracle/StrikeProbabilityOracle.sol";
import "../src/perp/BreezePerpFactory.sol";
import "../src/perp/BreezePerpMarket.sol";
import "../src/perp/InsuranceFund.sol";
import "../src/perp/PerilExposureRegistry.sol";
import "../src/policy/WeatherPolicyMarket.sol";
import "../src/settlement/PayoffCalculator.sol";
import "../src/vault/BreezeLiquidityVault.sol";
import "../src/vault/FirstLossReserve.sol";
import "../src/vault/JuniorTranche.sol";

/// @notice Demo collateral. Only deployed when no real token address is configured.
contract BreezeDemoUSD is ERC20 {
    constructor(address mintTo) ERC20("Breeze USD Demo Token", "bUSDT") {
        _mint(mintTo, 10_000_000e18);
    }
}

/// @title BreezeDeployer
/// @notice The one place that knows how BreezeSwap is wired together.
///
/// The deployment scripts and the deployment TEST both call this, and that is the whole
/// point of it existing. The scripts under `script/` previously stood up the
/// pre-waterfall stack: no liquidity vault, no junior tranche, no first-loss reserve, no
/// peril registry, and no policy market. A deployment made from them would have run with
/// none of the capital structure the last two phases built — a safe default, since every
/// tier degrades to prior behaviour when unset, but it meant none of it was reachable.
///
/// Wiring is the part that is easy to get wrong and impossible to notice: every tier is
/// optional by design, so a missed `setJuniorTranche` produces a protocol that works
/// perfectly and silently has no junior tranche. Sharing one implementation with a test
/// that asserts every link is the only way that stays true.
contract BreezeDeployer {
    struct Config {
        /// Collateral token. Zero deploys a demo token — never do that on a real network.
        address collateralToken;
        /// Governance multisig. Zero leaves the deployer holding every role.
        address governanceMultisig;
        /// Timelock delay on parameter changes. Ignored when there is no multisig.
        uint256 timelockDelay;
        /// Address that keeps posting oracle readings. Zero leaves it with the deployer.
        address oracleUpdater;
        /// Regions to stand up perpetual markets for.
        bytes32[] perpRegions;
        /// Correlation bucket for each region, index-matched to `perpRegions`.
        bytes32[] perilGroups;
    }

    struct Deployment {
        BreezeAccessControl accessControl;
        IERC20 collateralToken;
        bool collateralIsDemoToken;
        MockWeatherOracle weatherOracle;
        StrikeProbabilityOracle pricingOracle;
        PositionToken positionToken;
        BreezeMarketFactory classicFactory;
        FeeConfig feeConfig;
        ProtocolTreasury treasury;
        InsuranceFund insuranceFund;
        FirstLossReserve firstLossReserve;
        BreezeLiquidityVault vault;
        JuniorTranche juniorTranche;
        PerilExposureRegistry perilRegistry;
        BreezePerpFactory perpFactory;
        WeatherPolicyMarket policyMarket;
        TimelockController timelock;
        address[] perpMarkets;
    }

    error RegionsAndGroupsMismatch(uint256 regions, uint256 groups);
    error NoRegions();

    /// @notice Deploy, fully wire, and hand over governance. One call, nothing left half done.
    ///
    /// @dev **This contract is the initial admin, not the deployer**, and getting that wrong
    /// is the first thing that breaks here. Every wiring call below is `onlyAdmin`, and
    /// `msg.sender` for those calls is THIS CONTRACT — not the externally owned account that
    /// invoked the script. Granting the initial roles to `deployer` produces a deployment
    /// that reverts on its first `setFirstLossFund`.
    ///
    /// So the builder holds every role for the duration, and gives all of them up before
    /// returning. `_handOverGovernance` is called from inside rather than left to the caller
    /// precisely because a two-step version can be stopped half way, leaving a protocol
    /// whose admin is a throwaway contract nobody controls.
    function deploy(Config memory cfg, address deployer) public returns (Deployment memory d) {
        if (cfg.perpRegions.length == 0) revert NoRegions();
        if (cfg.perpRegions.length != cfg.perilGroups.length) {
            revert RegionsAndGroupsMismatch(cfg.perpRegions.length, cfg.perilGroups.length);
        }

        d.accessControl = new BreezeAccessControl(address(this));
        // Not granted by the constructor, and needed to create the perp markets below.
        d.accessControl.grantRole(d.accessControl.MARKET_CREATOR_ROLE(), address(this));

        if (cfg.collateralToken == address(0)) {
            // Minted to the deployer, not to this throwaway builder, or the demo supply
            // would be stranded at an address nobody holds a key for.
            d.collateralToken = IERC20(address(new BreezeDemoUSD(deployer)));
            d.collateralIsDemoToken = true;
        } else {
            d.collateralToken = IERC20(cfg.collateralToken);
        }

        _deployOracles(d);
        _deployClassic(d);
        _deployFees(d);
        _deployCapitalStack(d);
        _deployMarkets(d, cfg);

        d.timelock = _handOverGovernance(d, cfg, deployer);

        return d;
    }

    // ---------------------------------------------------------------------
    // Stages
    // ---------------------------------------------------------------------

    function _deployOracles(Deployment memory d) internal {
        d.weatherOracle = new MockWeatherOracle(address(d.accessControl));
        d.pricingOracle = new StrikeProbabilityOracle(address(d.accessControl));
    }

    function _deployClassic(Deployment memory d) internal {
        d.positionToken = new PositionToken("https://breezeswap.io/api/metadata/{id}.json");
        d.classicFactory = new BreezeMarketFactory(
            address(d.positionToken), address(d.accessControl)
        );
        // The factory grants minter status to each market it deploys, so it has to own the
        // shared token.
        d.positionToken.transferOwnership(address(d.classicFactory));
        d.classicFactory.setPricingOracle(address(d.pricingOracle));
    }

    function _deployFees(Deployment memory d) internal {
        d.feeConfig = new FeeConfig(address(d.accessControl));
        d.treasury = new ProtocolTreasury(address(d.collateralToken), address(d.accessControl));
        d.insuranceFund = new InsuranceFund(
            address(d.collateralToken), address(d.accessControl)
        );
    }

    function _deployCapitalStack(Deployment memory d) internal {
        d.firstLossReserve = new FirstLossReserve(
            address(d.collateralToken), address(d.accessControl)
        );
        d.vault = new BreezeLiquidityVault(
            d.collateralToken, address(d.accessControl), "Breeze Senior LP", "bLP"
        );
        d.juniorTranche = new JuniorTranche(
            d.collateralToken, address(d.accessControl), "Breeze Junior LP", "bJNR"
        );
        d.perilRegistry = new PerilExposureRegistry(
            address(d.accessControl), address(d.vault)
        );

        // The waterfall, both directions. The vault holds interfaces to the tiers above it;
        // the junior tranche needs the senior vault to ask what backing is free before it
        // lets anyone out. Missing either side leaves a tier that exists and is never used.
        d.vault.setFirstLossFund(address(d.firstLossReserve));
        d.vault.setJuniorTranche(address(d.juniorTranche));
        d.juniorTranche.setSeniorVault(address(d.vault));

        // Tier 1 is drawn by the vault and by nothing else. Authorising a market here would
        // rebuild the shared-pot contention `FirstLossReserve` exists to remove.
        d.firstLossReserve.setDrawerAuthorization(address(d.vault), true);
    }

    function _deployMarkets(Deployment memory d, Config memory cfg) internal {
        d.perpFactory = new BreezePerpFactory(
            address(d.accessControl),
            address(d.insuranceFund),
            address(d.feeConfig),
            address(d.treasury)
        );
        d.perpFactory.setPricingOracle(address(d.pricingOracle));

        d.policyMarket = new WeatherPolicyMarket(
            address(d.accessControl),
            address(d.weatherOracle),
            address(d.pricingOracle),
            address(d.vault),
            address(d.collateralToken)
        );
        d.vault.setMarketAuthorization(address(d.policyMarket), true);

        d.perpMarkets = new address[](cfg.perpRegions.length);
        for (uint256 i = 0; i < cfg.perpRegions.length; i++) {
            d.perpMarkets[i] = _deployPerpMarket(d, cfg.perpRegions[i], cfg.perilGroups[i]);
        }
    }

    /// @dev One market, and every link it needs. Six calls, all of them silent if omitted:
    /// a market with no vault pays winners only out of posted collateral, a market with no
    /// first-loss reserve folds that fee leg into the liquidation backstop, and a market
    /// with no peril registry is bounded only by its own capacity.
    function _deployPerpMarket(Deployment memory d, bytes32 region, bytes32 group)
        internal
        returns (address market)
    {
        // Reserves imply a mark of collateral/weather = 25, i.e. a 25mm index at 6dp.
        market = d.perpFactory.createPerpMarket(
            region,
            2_000_000e18,
            80_000e18,
            address(d.weatherOracle),
            address(d.collateralToken)
        );

        d.insuranceFund.setMarketAuthorization(market, true);
        d.vault.setMarketAuthorization(market, true);

        BreezePerpMarket(market).setLiquidityVault(address(d.vault));
        BreezePerpMarket(market).setFirstLossReserve(address(d.firstLossReserve));
        BreezePerpMarket(market).setPerilRegistry(address(d.perilRegistry));

        d.perilRegistry.setPerilGroup(region, group);
        d.perilRegistry.setMarketRegistration(market, true);
    }

    // ---------------------------------------------------------------------
    // Governance
    // ---------------------------------------------------------------------

    /// @notice Move parameter control behind a timelock, and hand emergency and operational
    /// control to addresses that can act immediately.
    ///
    /// @dev The split is the point, and it is not "put everything behind the timelock":
    ///
    ///   - `ADMIN_ROLE` and `DEFAULT_ADMIN_ROLE` go to the timelock. These are the
    ///     economically potent knobs — coverage ratios, fee splits, layer bands, exposure
    ///     caps, oracle scales — and every one of them benefits from being visible for the
    ///     delay before it takes effect.
    ///   - `PAUSER_ROLE` goes to the multisig DIRECTLY. A pause that takes two days to land
    ///     is not an emergency control. This is the role that has to be fast, and it is the
    ///     one whose worst case is bounded: pausing can never trap funds, because
    ///     withdrawals, settlement, closes and liquidations are all deliberately not
    ///     pausable.
    ///   - `ORACLE_UPDATER_ROLE` goes to an operational key. Readings are posted
    ///     continuously; a timelock would stop the protocol resolving anything.
    ///   - `MARKET_CREATOR_ROLE` goes to the timelock. Listing a market with mis-set initial
    ///     reserves is exactly what the climatology check guards against, so a delay before
    ///     a new market goes live is a feature rather than friction.
    ///
    /// With no multisig configured, everything goes to the deployer instead — a testnet
    /// deployment, and the script says so loudly rather than pretending otherwise.
    ///
    /// The builder renounces last, and `DEFAULT_ADMIN_ROLE` last of all: it is the role that
    /// grants the others, so releasing it first would strand the sequence half done with
    /// this throwaway contract still holding admin.
    function _handOverGovernance(Deployment memory d, Config memory cfg, address deployer)
        internal
        returns (TimelockController timelock)
    {
        BreezeAccessControl ac = d.accessControl;

        if (cfg.governanceMultisig == address(0)) {
            ac.grantRole(ac.ADMIN_ROLE(), deployer);
            ac.grantRole(ac.MARKET_CREATOR_ROLE(), deployer);
            ac.grantRole(ac.PAUSER_ROLE(), deployer);
            ac.grantRole(ac.ORACLE_UPDATER_ROLE(), deployer);
            ac.grantRole(ac.DEFAULT_ADMIN_ROLE(), deployer);
        } else {
            address[] memory proposers = new address[](1);
            proposers[0] = cfg.governanceMultisig;
            address[] memory executors = new address[](1);
            executors[0] = cfg.governanceMultisig;

            // `admin = address(0)` makes the timelock self-administered: its delay and role
            // set can only be changed through a proposal that serves the delay. Passing an
            // admin here would leave a key able to shorten the delay to zero, which is the
            // same as having no timelock at all.
            timelock = new TimelockController(cfg.timelockDelay, proposers, executors, address(0));

            ac.grantRole(ac.ADMIN_ROLE(), address(timelock));
            ac.grantRole(ac.MARKET_CREATOR_ROLE(), address(timelock));
            ac.grantRole(ac.DEFAULT_ADMIN_ROLE(), address(timelock));

            // Immediate, not timelocked. See the note above.
            ac.grantRole(ac.PAUSER_ROLE(), cfg.governanceMultisig);

            address updater =
                cfg.oracleUpdater == address(0) ? cfg.governanceMultisig : cfg.oracleUpdater;
            ac.grantRole(ac.ORACLE_UPDATER_ROLE(), updater);
        }

        ac.renounceRole(ac.ADMIN_ROLE(), address(this));
        ac.renounceRole(ac.MARKET_CREATOR_ROLE(), address(this));
        ac.renounceRole(ac.PAUSER_ROLE(), address(this));
        ac.renounceRole(ac.ORACLE_UPDATER_ROLE(), address(this));
        ac.renounceRole(ac.DEFAULT_ADMIN_ROLE(), address(this));

        return timelock;
    }
}
