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

    /// @dev These asserted `isStale == false`, which was a dead feed claiming to be fresh.
    /// The two functions have to agree: every consumer guards on staleness, so reporting
    /// "fresh" meant a caller concluded the feed was usable and then hit an unhandled revert
    /// on the read. `WeatherPolicyMarket.settlePolicy` checks in exactly that order. A stub
    /// should fail the way an outage fails — through the normal guard.
    function test_FtsoAdapterRevertsWithClearError() public {
        vm.expectRevert(FtsoWeatherAdapter.FtsoFeedNotYetLive.selector);
        ftsoAdapter.getReading(regionId, expiryTimestamp);

        assertTrue(ftsoAdapter.isStale(regionId, 86400), "a feed that cannot be read is not fresh");
    }

    function test_FdcAdapterRevertsWithClearError() public {
        vm.expectRevert(FdcWeatherAdapter.FdcAttestationTypeNotYetLive.selector);
        fdcAdapter.getReading(regionId, expiryTimestamp);

        assertTrue(fdcAdapter.isStale(regionId, 86400), "a feed that cannot be read is not fresh");
    }

    /// The consequence that matters: a market pointed at a stub refuses to settle through its
    /// staleness guard, rather than reverting somewhere deeper with an opaque error.
    function test_a_market_on_a_stub_adapter_refuses_to_settle_cleanly() public {
        BreezeMarket market = new BreezeMarket(
            regionId,
            BreezeMarket.WeatherVariable.RAINFALL,
            5000,
            10000,
            expiryTimestamp,
            address(ftsoAdapter),
            address(collateral),
            address(positionToken),
            PayoffCalculator.PayoffType.BINARY,
            address(accessControl),
            address(0) // no pricing oracle: these tests predate fair-odds pricing
        );

        vm.warp(expiryTimestamp + 1);
        // `getReading` is consulted first and reverts with the adapter's own error, so the
        // failure is attributable to the missing feed rather than to the market.
        vm.expectRevert(FtsoWeatherAdapter.FtsoFeedNotYetLive.selector);
        market.settle();
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
            address(accessControl),
            address(0) // no pricing oracle: these tests predate fair-odds pricing
        );

        vm.warp(expiryTimestamp + 1);

        // Attempting to settle market with FtsoAdapter reverts cleanly with InvalidOracleData / FtsoFeedNotYetLive
        vm.expectRevert();
        market.settle();
    }
}
