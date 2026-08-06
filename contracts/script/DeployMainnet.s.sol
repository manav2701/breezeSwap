// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import "./BreezeDeployer.sol";

/// @title DeployMainnet
/// @notice Production deployment. Same wiring as `DeployProtocol`, with the demo defaults
/// removed.
///
/// This script used to carry its own copy of the wiring, and that copy had drifted: it stood
/// up the pre-waterfall stack with no liquidity vault, no junior tranche, no first-loss
/// reserve, no peril registry and no policy market. It also deployed a token called
/// `MockUSDT0DeployMainnet` and minted ten million of it to the deployer, in a script named
/// for mainnet. Both are the same class of mistake — a demo default that nothing forced you
/// to notice.
///
/// So it delegates to `BreezeDeployer` like everything else, and refuses to run without the
/// two values that distinguish a real deployment from a demo:
///
///   COLLATERAL_TOKEN      required — a real token. No fallback.
///   GOVERNANCE_MULTISIG   required — admin moves behind a timelock and the deployer
///                                     renounces every role.
///   TIMELOCK_DELAY        optional — seconds, default 2 days, floor 1 day
///   ORACLE_UPDATER        optional — defaults to the multisig
///
/// Nothing here broadcasts until `--broadcast` is passed. Run it without that flag first and
/// read the address list.
contract DeployMainnet is Script {
    uint256 constant DEFAULT_TIMELOCK_DELAY = 2 days;

    /// @dev A delay shorter than this is not governance, it is a formality.
    uint256 constant MIN_TIMELOCK_DELAY = 1 days;

    error CollateralTokenRequired();
    error GovernanceMultisigRequired();
    error TimelockDelayTooShort(uint256 given, uint256 minimum);

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        BreezeDeployer.Config memory cfg;
        cfg.collateralToken = vm.envOr("COLLATERAL_TOKEN", address(0));
        cfg.governanceMultisig = vm.envOr("GOVERNANCE_MULTISIG", address(0));
        cfg.timelockDelay = vm.envOr("TIMELOCK_DELAY", DEFAULT_TIMELOCK_DELAY);
        cfg.oracleUpdater = vm.envOr("ORACLE_UPDATER", address(0));

        if (cfg.collateralToken == address(0)) revert CollateralTokenRequired();
        if (cfg.governanceMultisig == address(0)) revert GovernanceMultisigRequired();
        if (cfg.timelockDelay < MIN_TIMELOCK_DELAY) {
            revert TimelockDelayTooShort(cfg.timelockDelay, MIN_TIMELOCK_DELAY);
        }

        cfg.perpRegions = new bytes32[](2);
        cfg.perpRegions[0] = keccak256("TOKYO_RAINFALL");
        cfg.perpRegions[1] = keccak256("OSAKA_RAINFALL");
        cfg.perilGroups = new bytes32[](2);
        cfg.perilGroups[0] = keccak256("PERIL_JAPAN_RAINFALL");
        cfg.perilGroups[1] = keccak256("PERIL_JAPAN_RAINFALL");

        console.log("=== BreezeSwap production deployment ===");
        console.log("chain id          :", block.chainid);
        console.log("deployer          :", deployer);
        console.log("collateral        :", cfg.collateralToken);
        console.log("governance        :", cfg.governanceMultisig);
        console.log("timelock delay (s):", cfg.timelockDelay);

        vm.startBroadcast(deployerKey);
        BreezeDeployer builder = new BreezeDeployer();
        BreezeDeployer.Deployment memory d = builder.deploy(cfg, deployer);
        vm.stopBroadcast();

        console.log("");
        console.log("BreezeAccessControl     :", address(d.accessControl));
        console.log("MockWeatherOracle       :", address(d.weatherOracle));
        console.log("StrikeProbabilityOracle :", address(d.pricingOracle));
        console.log("FeeConfig               :", address(d.feeConfig));
        console.log("ProtocolTreasury        :", address(d.treasury));
        console.log("InsuranceFund           :", address(d.insuranceFund));
        console.log("FirstLossReserve        :", address(d.firstLossReserve));
        console.log("JuniorTranche           :", address(d.juniorTranche));
        console.log("BreezeLiquidityVault    :", address(d.vault));
        console.log("PerilExposureRegistry   :", address(d.perilRegistry));
        console.log("PositionToken           :", address(d.positionToken));
        console.log("BreezeMarketFactory     :", address(d.classicFactory));
        console.log("BreezePerpFactory       :", address(d.perpFactory));
        console.log("WeatherPolicyMarket     :", address(d.policyMarket));
        console.log("TimelockController      :", address(d.timelock));
        for (uint256 i = 0; i < d.perpMarkets.length; i++) {
            console.log("PerpMarket              :", d.perpMarkets[i]);
        }

        console.log("");
        console.log("The deployer key now holds NO roles. Parameter changes go through the");
        console.log("timelock; pausing and oracle updates do not.");
        console.log("");
        console.log("!! The only live weather oracle is MockWeatherOracle. FTSO and FDC");
        console.log("!! adapters revert on getReading - see SECURITY.md. Settlement is");
        console.log("!! trusted input until a real feed exists.");
    }
}
