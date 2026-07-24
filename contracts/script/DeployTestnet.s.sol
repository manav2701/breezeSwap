// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import "../src/core/PositionToken.sol";
import "../src/core/BreezeMarketFactory.sol";
import "../src/oracle/MockWeatherOracle.sol";
import "../src/oracle/FtsoWeatherAdapter.sol";
import "../src/oracle/FdcWeatherAdapter.sol";
import "../src/periphery/FAssetsCollateralAdapter.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDT0Deploy is ERC20 {
    constructor() ERC20("Mock USDT", "mUSDT") {
        _mint(msg.sender, 1_000_000 * 1e18);
    }
}

contract DeployTestnet is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== BreezeSwap Coston2 Testnet Deployment ===");
        console.log("Deployer address:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Mock Stablecoin (mUSDT)
        MockUSDT0Deploy usdt = new MockUSDT0Deploy();
        console.log("Deployed MockUSDT:", address(usdt));

        // 2. Deploy MockWeatherOracle
        MockWeatherOracle oracle = new MockWeatherOracle();
        console.log("Deployed MockWeatherOracle:", address(oracle));

        // 3. Deploy PositionToken
        PositionToken posToken = new PositionToken("https://breezeswap.io/api/metadata/{id}.json");
        console.log("Deployed PositionToken:", address(posToken));

        // 4. Deploy BreezeMarketFactory
        BreezeMarketFactory factory = new BreezeMarketFactory(address(posToken));
        console.log("Deployed BreezeMarketFactory:", address(factory));

        // Transfer PositionToken ownership to BreezeMarketFactory
        posToken.transferOwnership(address(factory));
        console.log("Transferred PositionToken ownership to Factory");

        // 5. Deploy FtsoWeatherAdapter
        bytes21 ftsoFeedId = bytes21(keccak256("FLARE_WEATHER_RAINFALL"));
        FtsoWeatherAdapter ftsoAdapter = new FtsoWeatherAdapter(address(0x8D5196522Ce25A95A344d9326eC06C9af9A92440), ftsoFeedId);
        console.log("Deployed FtsoWeatherAdapter:", address(ftsoAdapter));

        // 6. Deploy FdcWeatherAdapter
        bytes32 fdcAttestationType = keccak256("WEATHER_API_ATTESTATION");
        FdcWeatherAdapter fdcAdapter = new FdcWeatherAdapter(address(0x8D5196522Ce25A95A344d9326eC06C9af9A92440), fdcAttestationType);
        console.log("Deployed FdcWeatherAdapter:", address(fdcAdapter));

        // 7. Deploy FAssetsCollateralAdapter (FXRP)
        address fxrpToken = 0x0b6a8e49F600B4676570c99a38e6a68d5d813DC7; // Coston2 FTestXRP
        bytes21 fxrpFeedId = bytes21(keccak256("FXRP/USD"));
        FAssetsCollateralAdapter fassetsAdapter = new FAssetsCollateralAdapter(fxrpToken, address(0x8D5196522Ce25A95A344d9326eC06C9af9A92440), fxrpFeedId);
        console.log("Deployed FAssetsCollateralAdapter:", address(fassetsAdapter));

        vm.stopBroadcast();
    }
}
