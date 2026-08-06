// SPDX-License-Identifier: MIT
//
// SUPERSEDED. This script deploys a HISTORICAL SUBSET of the protocol and is kept only so
// the existing Coston2 addresses remain reproducible. It has no liquidity vault, no junior
// tranche, no first-loss reserve, no peril exposure registry and no policy market — every
// one of those tiers is optional by design, so a deployment from here works and silently
// has none of them.
//
// Use `DeployProtocol.s.sol` (any network) or `DeployMainnet.s.sol` (production, requires a
// real collateral token and a governance multisig). Both share one wiring implementation
// with `BreezeDeployer.sol`, which `test/integration/DeploymentWiring.t.sol` asserts link by
// link.
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import "../src/access/BreezeAccessControl.sol";
import "../src/fees/FeeConfig.sol";
import "../src/fees/ProtocolTreasury.sol";
import "../src/perp/InsuranceFund.sol";
import "../src/perp/BreezePerpFactory.sol";
import "../src/perp/BreezePerpMarket.sol";
import "../src/perp/PerpConstants.sol";
import "../src/perp/BreezePerpMarket.sol";
import "../src/perp/VirtualAMM.sol";

contract DeployPerpTestnet is Script {
    bytes32 constant REGION_TOKYO = keccak256("TOKYO_RAINFALL");
    bytes32 constant REGION_SEOUL = keccak256("SEOUL_RAINFALL");
    bytes32 constant REGION_DUBAI = keccak256("DUBAI_TEMPERATURE");

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== BreezeSwap Coston2 Perp Deployment ===");
        console.log("Deployer address:", deployer);

        // Pre-deployed Phase 7 contract addresses on Coston2
        address accessControlAddr = 0x3788420AB4Ef4D2c2dd22c151fd6CB93d2543853;
        address oracleAddr = 0x17EEF37738887b2a6f7149aA3af047D6144D6139;
        address mockUsdtAddr = 0x639b6b2a0195271557e543F51c0FA417265B2FAC;

        vm.startBroadcast(deployerPrivateKey);

        // 1. Grant MARKET_CREATOR_ROLE to deployer
        BreezeAccessControl ac = BreezeAccessControl(accessControlAddr);
        ac.grantRole(ac.MARKET_CREATOR_ROLE(), deployer);

        // 2. Deploy FeeConfig & ProtocolTreasury
        FeeConfig feeConfig = new FeeConfig(accessControlAddr);
        ProtocolTreasury treasury = new ProtocolTreasury(mockUsdtAddr, accessControlAddr);

        // 3. Deploy InsuranceFund
        InsuranceFund insuranceFund = new InsuranceFund(mockUsdtAddr, accessControlAddr);
        console.log("Deployed InsuranceFund:", address(insuranceFund));

        // 4. Deploy BreezePerpFactory
        BreezePerpFactory perpFactory = new BreezePerpFactory(
            accessControlAddr,
            address(insuranceFund),
            address(feeConfig),
            address(treasury)
        );
        console.log("Deployed BreezePerpFactory:", address(perpFactory));

        // 5. Create initial perpetual weather markets
        // Tokyo Rainfall vAMM
        address tokyoPerp = perpFactory.createPerpMarket(
            REGION_TOKYO,
            1_000_000 * 1e18,
            40_000 * 1e18,
            oracleAddr,
            mockUsdtAddr
        );
        insuranceFund.setMarketAuthorization(tokyoPerp, true);
        console.log("Deployed Tokyo Perp Market:", tokyoPerp);

        // Seoul Rainfall vAMM
        address seoulPerp = perpFactory.createPerpMarket(
            REGION_SEOUL,
            1_000_000 * 1e18,
            50_000 * 1e18,
            oracleAddr,
            mockUsdtAddr
        );
        insuranceFund.setMarketAuthorization(seoulPerp, true);
        console.log("Deployed Seoul Perp Market:", seoulPerp);

        // Dubai Temperature vAMM
        address dubaiPerp = perpFactory.createPerpMarket(
            REGION_DUBAI,
            1_000_000 * 1e18,
            25_000 * 1e18,
            oracleAddr,
            mockUsdtAddr
        );
        insuranceFund.setMarketAuthorization(dubaiPerp, true);
        console.log("Deployed Dubai Perp Market:", dubaiPerp);

        // Testnet markets adopt the DEMO funding preset explicitly. The contract
        // default is the production preset (8-hour interval, 0.75% cap), which is
        // correct for real capital but far too slow to demonstrate in a short
        // walkthrough. Making the demo values opt-in is the point: they can no
        // longer ship by accident.
        _applyDemoFunding(tokyoPerp);
        _applyDemoFunding(seoulPerp);
        _applyDemoFunding(dubaiPerp);

        vm.stopBroadcast();
    }

    function _applyDemoFunding(address perp) internal {
        BreezePerpMarket(perp).setFundingParams(
            PerpConstants.FUNDING_INTERVAL, PerpConstants.MAX_FUNDING_RATE_PER_PERIOD
        );
    }
}
