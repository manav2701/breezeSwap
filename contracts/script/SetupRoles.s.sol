// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import "../src/access/BreezeAccessControl.sol";

contract SetupRoles is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        address accessControlAddr = vm.envAddress("ACCESS_CONTROL_ADDRESS");
        BreezeAccessControl ac = BreezeAccessControl(accessControlAddr);

        console.log("=== BreezeSwap Role Audit & Assignment ===");
        console.log("AccessControl contract:", accessControlAddr);
        console.log("Deployer address:", deployer);
        console.log("Deployer has ADMIN_ROLE:", ac.hasRole(ac.ADMIN_ROLE(), deployer));
        console.log("Deployer has PAUSER_ROLE:", ac.hasRole(ac.PAUSER_ROLE(), deployer));
        console.log("Deployer has ORACLE_UPDATER_ROLE:", ac.hasRole(ac.ORACLE_UPDATER_ROLE(), deployer));

        vm.stopBroadcast();
    }
}
