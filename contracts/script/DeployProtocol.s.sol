// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import "./BreezeDeployer.sol";

/// @title DeployProtocol
/// @notice Canonical BreezeSwap deployment: the full capital stack, wired.
///
/// Configuration comes from the environment so the same script serves testnet and a real
/// network without a code change:
///
///   PRIVATE_KEY            required — deployer key
///   COLLATERAL_TOKEN       optional — real collateral. UNSET DEPLOYS A DEMO TOKEN.
///   GOVERNANCE_MULTISIG    optional — hands admin to a timelock and renounces the deployer
///   TIMELOCK_DELAY         optional — seconds, default 2 days
///   ORACLE_UPDATER         optional — keeps posting readings after the handover
///
/// Every optional value defaults to the *demo* behaviour, and each one that does logs a
/// warning. That direction is deliberate: a missing variable produces a loud testnet
/// deployment rather than a quiet production one.
contract DeployProtocol is Script {
    uint256 constant DEFAULT_TIMELOCK_DELAY = 2 days;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        BreezeDeployer.Config memory cfg = _config();

        console.log("=== BreezeSwap deployment ===");
        console.log("deployer            :", deployer);
        console.log("chain id            :", block.chainid);

        vm.startBroadcast(deployerKey);

        // Library call, inlined. No builder contract is deployed: as a contract it embedded
        // the creation bytecode of every protocol contract and came to 133,883 bytes,
        // against a 24,576 byte chain limit.
        BreezeDeployer.Deployment memory d = BreezeDeployer.deploy(cfg, deployer);

        vm.stopBroadcast();

        _report(d, cfg);
    }

    function _config() internal view returns (BreezeDeployer.Config memory cfg) {
        cfg.collateralToken = vm.envOr("COLLATERAL_TOKEN", address(0));
        cfg.governanceMultisig = vm.envOr("GOVERNANCE_MULTISIG", address(0));
        cfg.timelockDelay = vm.envOr("TIMELOCK_DELAY", DEFAULT_TIMELOCK_DELAY);
        cfg.oracleUpdater = vm.envOr("ORACLE_UPDATER", address(0));

        // Two regions in one peril group, because that is the configuration the aggregate
        // cap exists for: correlated rainfall markets that must not each fill their own
        // allowance against the same weather event.
        //
        // Both regions must be ones the climatology seeder actually covers. This used to
        // list OSAKA_RAINFALL, which `weather-seed` has never had in its region set, so that
        // market deployed with no expected level and no readings behind it. Nothing failed:
        // `_checkInitialMark` deliberately skips an unpriced region rather than blocking a
        // listing, so the market simply existed with its opening mark unchecked and no
        // oracle data to settle against. Seoul is seeded, and East Asian rainfall is
        // genuinely correlated with Tokyo's through the same monsoon and typhoon tracks,
        // which is what the peril group is asserting.
        cfg.perpRegions = new bytes32[](2);
        cfg.perpRegions[0] = keccak256("TOKYO_RAINFALL");
        cfg.perpRegions[1] = keccak256("SEOUL_RAINFALL");

        cfg.perilGroups = new bytes32[](2);
        cfg.perilGroups[0] = keccak256("PERIL_EAST_ASIA_RAINFALL");
        cfg.perilGroups[1] = keccak256("PERIL_EAST_ASIA_RAINFALL");
    }

    function _report(BreezeDeployer.Deployment memory d, BreezeDeployer.Config memory cfg)
        internal
        view
    {
        console.log("");
        console.log("-- shared --");
        console.log("BreezeAccessControl     :", address(d.accessControl));
        console.log("CollateralToken         :", address(d.collateralToken));
        console.log("MockWeatherOracle       :", address(d.weatherOracle));
        console.log("StrikeProbabilityOracle :", address(d.pricingOracle));
        console.log("FeeConfig               :", address(d.feeConfig));
        console.log("ProtocolTreasury        :", address(d.treasury));

        console.log("");
        console.log("-- capital stack --");
        console.log("InsuranceFund   (liq)   :", address(d.insuranceFund));
        console.log("FirstLossReserve (t1)   :", address(d.firstLossReserve));
        console.log("JuniorTranche    (t2)   :", address(d.juniorTranche));
        console.log("LiquidityVault   (t3)   :", address(d.vault));
        console.log("PerilExposureRegistry   :", address(d.perilRegistry));

        console.log("");
        console.log("-- markets --");
        console.log("ClassicFactory          :", address(d.classicFactory));
        console.log("PositionToken           :", address(d.positionToken));
        console.log("PerpFactory             :", address(d.perpFactory));
        console.log("WeatherPolicyMarket     :", address(d.policyMarket));
        for (uint256 i = 0; i < d.perpMarkets.length; i++) {
            console.log("PerpMarket              :", d.perpMarkets[i]);
        }

        console.log("");
        console.log("-- governance --");
        if (address(d.timelock) != address(0)) {
            console.log("TimelockController      :", address(d.timelock));
            console.log("Multisig (pauser)       :", cfg.governanceMultisig);
            console.log("Timelock delay (s)      :", cfg.timelockDelay);
        } else {
            console.log("!! GOVERNANCE_MULTISIG unset - the deployer still holds ADMIN_ROLE.");
            console.log("!! Do not treat this as a production deployment.");
        }

        if (d.collateralIsDemoToken) {
            console.log("");
            console.log("!! COLLATERAL_TOKEN unset - a DEMO token was deployed and minted to");
            console.log("!! the deployer. This is not real collateral.");
        }

        console.log("");
        console.log("Next: post climatology (weather-seed) before relying on the pricing gates.");
    }
}
