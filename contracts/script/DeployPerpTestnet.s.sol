// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import "../src/access/BreezeAccessControl.sol";
import "../src/perp/InsuranceFund.sol";
import "../src/perp/BreezePerpFactory.sol";
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

        // 2. Deploy InsuranceFund
        InsuranceFund insuranceFund = new InsuranceFund(mockUsdtAddr, accessControlAddr);
        console.log("Deployed InsuranceFund:", address(insuranceFund));

        // 2. Deploy BreezePerpFactory
        BreezePerpFactory perpFactory = new BreezePerpFactory(accessControlAddr, address(insuranceFund));
        console.log("Deployed BreezePerpFactory:", address(perpFactory));

        // 3. Create initial perpetual weather markets
        // Tokyo Rainfall vAMM: Initial reserves 1,000,000 USD / 40,000 mm (Mark price = 25.0 mm)
        address tokyoPerp = perpFactory.createPerpMarket(
            REGION_TOKYO,
            1_000_000 * 1e18,
            40_000 * 1e18,
            oracleAddr,
            mockUsdtAddr
        );
        insuranceFund.setMarketAuthorization(tokyoPerp, true);
        console.log("Deployed Tokyo Perp Market:", tokyoPerp);

        // Seoul Rainfall vAMM: Initial reserves 1,000,000 USD / 50,000 mm (Mark price = 20.0 mm)
        address seoulPerp = perpFactory.createPerpMarket(
            REGION_SEOUL,
            1_000_000 * 1e18,
            50_000 * 1e18,
            oracleAddr,
            mockUsdtAddr
        );
        insuranceFund.setMarketAuthorization(seoulPerp, true);
        console.log("Deployed Seoul Perp Market:", seoulPerp);

        // Dubai Temperature vAMM: Initial reserves 1,000,000 USD / 25,000 deg (Mark price = 40.0 C)
        address dubaiPerp = perpFactory.createPerpMarket(
            REGION_DUBAI,
            1_000_000 * 1e18,
            25_000 * 1e18,
            oracleAddr,
            mockUsdtAddr
        );
        insuranceFund.setMarketAuthorization(dubaiPerp, true);
        console.log("Deployed Dubai Perp Market:", dubaiPerp);

        vm.stopBroadcast();
    }
}
