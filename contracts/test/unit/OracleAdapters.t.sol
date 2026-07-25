// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../src/access/BreezeAccessControl.sol";
import "../../src/oracle/IWeatherOracle.sol";
import "../../src/oracle/FtsoWeatherAdapter.sol";
import "../../src/oracle/FdcWeatherAdapter.sol";
import "../../src/oracle/MockWeatherOracle.sol";
import "../../src/core/BreezeMarket.sol";
import "../../src/core/PositionToken.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDT0 is ERC20 {
    constructor() ERC20("Mock USD", "USDT0") {
        _mint(msg.sender, 1_000_000 * 1e18);
    }
}

contract OracleAdaptersTest is Test {
    BreezeAccessControl public accessControl;
    FtsoWeatherAdapter public ftsoAdapter;
    FdcWeatherAdapter public fdcAdapter;
    MockWeatherOracle public mockOracle;
    PositionToken public positionToken;
    MockUSDT0 public collateral;

    bytes32 public regionId = keccak256("TOKYO_RAINFALL");
    bytes21 public feedId = bytes21(keccak256("FLARE_WEATHER_FEED"));
    bytes32 public attestationType = keccak256("WEATHER_ATTESTATION");
    uint256 public expiryTimestamp;

    function setUp() public {
        expiryTimestamp = block.timestamp + 7 days;
        accessControl = new BreezeAccessControl(address(this));
        ftsoAdapter = new FtsoWeatherAdapter(address(0x1111), feedId);
        fdcAdapter = new FdcWeatherAdapter(address(0x2222), attestationType);
        mockOracle = new MockWeatherOracle(address(accessControl));

        positionToken = new PositionToken("https://breezeswap.io/api/");
        collateral = new MockUSDT0();
    }

    function test_FtsoAdapterRevertsWithClearError() public {
        vm.expectRevert(FtsoWeatherAdapter.FtsoFeedNotYetLive.selector);
        ftsoAdapter.getReading(regionId, expiryTimestamp);

        assertFalse(ftsoAdapter.isStale(regionId, 86400));
    }

    function test_FdcAdapterRevertsWithClearError() public {
        vm.expectRevert(FdcWeatherAdapter.FdcAttestationTypeNotYetLive.selector);
        fdcAdapter.getReading(regionId, expiryTimestamp);

        assertFalse(fdcAdapter.isStale(regionId, 86400));
    }

    function test_MarketSwapsOracleToFtsoAdapterGracefully() public {
        BreezeMarket market = new BreezeMarket(
            regionId,
            BreezeMarket.WeatherVariable.RAINFALL,
            5000,
            15000,
            expiryTimestamp,
            address(ftsoAdapter),
            address(collateral),
            address(positionToken),
            PayoffCalculator.PayoffType.CAPPED,
            address(accessControl)
        );

        vm.warp(expiryTimestamp + 1);

        // Attempting to settle market with FtsoAdapter reverts cleanly with InvalidOracleData / FtsoFeedNotYetLive
        vm.expectRevert();
        market.settle();
    }
}
