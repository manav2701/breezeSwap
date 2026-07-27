// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import "../src/access/BreezeAccessControl.sol";
import "../src/core/PositionToken.sol";
import "../src/core/BreezeMarketFactory.sol";
import "../src/core/BreezeMarket.sol";
import "../src/settlement/PayoffCalculator.sol";
import "../src/oracle/MockWeatherOracle.sol";
import "../src/oracle/FtsoWeatherAdapter.sol";
import "../src/oracle/FdcWeatherAdapter.sol";
import "../src/periphery/FAssetsCollateralAdapter.sol";
import "../src/fees/FeeConfig.sol";
import "../src/fees/ProtocolTreasury.sol";
import "../src/perp/InsuranceFund.sol";
import "../src/perp/BreezePerpFactory.sol";
import "../src/perp/BreezePerpMarket.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDT0DeployMainnet is ERC20 {
    constructor() ERC20("Breeze USD Demo Token", "bUSDT") {
        _mint(msg.sender, 10_000_000 * 1e18);
    }
}

contract DeployMainnet is Script {
    bytes32 constant REGION_TOKYO = keccak256("TOKYO_RAINFALL");
    address constant FLARE_MAINNET_FTSO_V2 = address(uint160(0xaeeb335444A2D7412783Db641e8Ed5e21f2d61f6));
    bytes21 constant FXRP_USD_FEED = bytes21(0x01465852502f555344000000000000000000000000);

    struct MainnetSuite {
        BreezeAccessControl accessControl;
        MockUSDT0DeployMainnet usdt;
        MockWeatherOracle oracle;
        BreezeMarketFactory factory;
        FeeConfig feeConfig;
        ProtocolTreasury treasury;
        InsuranceFund insuranceFund;
        BreezePerpFactory perpFactory;
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== BreezeSwap Flare Mainnet Deployment ===");
        console.log("Deployer address:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        MainnetSuite memory suite = _deploySuite(deployer);
        _deployDemoMarkets(suite);

        vm.stopBroadcast();
    }

    function _deploySuite(address deployer) internal returns (MainnetSuite memory suite) {
        suite.accessControl = new BreezeAccessControl(deployer);
        suite.usdt = new MockUSDT0DeployMainnet();
        suite.oracle = new MockWeatherOracle(address(suite.accessControl));

        new FtsoWeatherAdapter(FLARE_MAINNET_FTSO_V2, FXRP_USD_FEED);
        new FdcWeatherAdapter(FLARE_MAINNET_FTSO_V2, bytes32(0));

        PositionToken posToken = new PositionToken("https://breezeswap.io/api/metadata/{id}.json");
        suite.factory = new BreezeMarketFactory(
            address(posToken),
            address(suite.accessControl)
        );
        posToken.transferOwnership(address(suite.factory));

        suite.feeConfig = new FeeConfig(address(suite.accessControl));
        suite.treasury = new ProtocolTreasury(address(suite.usdt), address(suite.accessControl));
        suite.insuranceFund = new InsuranceFund(address(suite.usdt), address(suite.accessControl));

        suite.perpFactory = new BreezePerpFactory(
            address(suite.accessControl),
            address(suite.insuranceFund),
            address(suite.feeConfig),
            address(suite.treasury)
        );

        suite.accessControl.grantRole(suite.accessControl.MARKET_CREATOR_ROLE(), deployer);

        console.log("AccessControl:", address(suite.accessControl));
        console.log("MockUSDT:", address(suite.usdt));
        console.log("Oracle:", address(suite.oracle));
        console.log("ClassicFactory:", address(suite.factory));
        console.log("FeeConfig:", address(suite.feeConfig));
        console.log("Treasury:", address(suite.treasury));
        console.log("InsuranceFund:", address(suite.insuranceFund));
        console.log("PerpFactory:", address(suite.perpFactory));
    }

    function _deployDemoMarkets(MainnetSuite memory suite) internal {
        address tokyoClassic = suite.factory.createMarket(
            REGION_TOKYO,
            BreezeMarket.WeatherVariable.RAINFALL,
            10 * 1e6,
            50 * 1e6,
            block.timestamp + 30 days,
            address(suite.oracle),
            address(suite.usdt),
            PayoffCalculator.PayoffType.BINARY
        );

        address tokyoPerp = suite.perpFactory.createPerpMarket(
            REGION_TOKYO,
            1_000_000 * 1e18,
            40_000 * 1e18,
            address(suite.oracle),
            address(suite.usdt)
        );
        suite.insuranceFund.setMarketAuthorization(tokyoPerp, true);

        console.log("TokyoClassic:", tokyoClassic);
        console.log("TokyoPerp:", tokyoPerp);
    }
}
