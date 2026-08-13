// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import "../src/core/BreezeMarketFactory.sol";
import "../src/core/BreezeMarket.sol";
import "../src/oracle/MockWeatherOracle.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DemoLifecycle is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        address factoryAddress = vm.envAddress("FACTORY_ADDRESS");
        address oracleAddress = vm.envAddress("ORACLE_ADDRESS");
        address usdtAddress = vm.envAddress("USDT_ADDRESS");

        console.log("=== BreezeSwap Coston2 Demo Lifecycle Script ===");
        console.log("Deployer / User:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        BreezeMarketFactory factory = BreezeMarketFactory(factoryAddress);
        MockWeatherOracle oracle = MockWeatherOracle(oracleAddress);
        IERC20 usdt = IERC20(usdtAddress);

        // Must match `regionIdFor` in weather-seed and `encodeRegionId` in the
        // SDK: keccak256("<REGION>_<VARIABLE>"). The variable is part of the id
        // because the oracle keys readings on region alone, so a city-only id
        // makes rainfall and temperature share one slot.
        bytes32 regionId = keccak256("TOKYO_RAINFALL");
        uint256 expiry = block.timestamp + 120; // 2 minutes expiry for live demo

        // 1. Create Market
        address marketAddr = factory.createMarket(
            regionId,
            BreezeMarket.WeatherVariable.RAINFALL,
            5000,
            15000,
            expiry,
            oracleAddress,
            usdtAddress,
            PayoffCalculator.PayoffType.CAPPED
        );
        console.log("Created BreezeMarket:", marketAddr);

        BreezeMarket market = BreezeMarket(marketAddr);
        usdt.approve(address(market.vault()), type(uint256).max);

        // 2. Mint LONG & SHORT positions
        uint256 longId = market.mintPosition(PositionToken.Side.LONG, 10 * 1e18);
        uint256 shortId = market.mintPosition(PositionToken.Side.SHORT, 10 * 1e18);
        console.log("Minted LONG position tokenId:", longId);
        console.log("Minted SHORT position tokenId:", shortId);

        // 3. Set Weather Reading
        oracle.setReading(regionId, expiry, 10000); // 50% midpoint
        console.log("Seeded Weather Oracle reading at 10000");

        vm.stopBroadcast();
    }
}
