// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../src/access/BreezeAccessControl.sol";
import "../../src/oracle/MockWeatherOracle.sol";
import "../../src/core/PositionToken.sol";
import "../../src/core/BreezeMarketFactory.sol";
import "../../src/core/BreezeMarket.sol";
import "../../src/settlement/PayoffCalculator.sol";

contract MockRetrofitUSDT is ERC20 {
    constructor() ERC20("Mock USDT", "mUSDT") {
        _mint(msg.sender, 1_000_000 * 1e18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract AccessControlRetrofitTest is Test {
    BreezeAccessControl accessControl;
    MockWeatherOracle oracle;
    PositionToken positionToken;
    BreezeMarketFactory factory;
    MockRetrofitUSDT collateralToken;

    address admin = address(this);
    address pauser = address(0x1111222233334444555566667777888899990001);
    address oracleUpdater = address(0x1111222233334444555566667777888899990002);
    address alice = address(0x1111222233334444555566667777888899990003);
    address bob = address(0x1111222233334444555566667777888899990004);

    bytes32 constant REGION_ID = keccak256("LONDON_TEMP");

    function setUp() public {
        // 1. Deploy AccessControl shared registry
        accessControl = new BreezeAccessControl(admin);

        // 2. Grant roles
        accessControl.grantRole(accessControl.PAUSER_ROLE(), pauser);
        accessControl.grantRole(accessControl.ORACLE_UPDATER_ROLE(), oracleUpdater);

        // 3. Deploy oracle & collateral
        oracle = new MockWeatherOracle(address(accessControl));
        collateralToken = new MockRetrofitUSDT();

        // 4. Deploy position token & factory
        positionToken = new PositionToken("https://breezeswap.io/api/");
        factory = new BreezeMarketFactory(address(positionToken), address(accessControl));

        // 5. Transfer PositionToken ownership to Factory so it can set minter status on createMarket
        positionToken.transferOwnership(address(factory));

        // Mint collateral to users
        collateralToken.mint(alice, 1_000_000_000); // 1,000 mUSDT
        collateralToken.mint(bob, 1_000_000_000);
    }

    function test_only_admin_can_grant_roles() public {
        bytes32 pauserRole = accessControl.PAUSER_ROLE();

        vm.prank(alice);
        vm.expectRevert();
        accessControl.grantRole(pauserRole, alice);

        // Admin can grant role
        accessControl.grantRole(pauserRole, alice);
        assertTrue(accessControl.hasRole(pauserRole, alice));
    }

    function test_only_oracle_updater_can_set_reading() public {
        // Non-updater calling setReading reverts
        vm.prank(alice);
        vm.expectRevert("BreezeSwap: unauthorized");
        oracle.setReading(REGION_ID, block.timestamp + 1000, 25000000); // 25.0 °C

        // Authorized updater succeeds
        vm.prank(oracleUpdater);
        oracle.setReading(REGION_ID, block.timestamp + 1000, 25000000);
        
        MockWeatherOracle.Reading memory r = oracle.getReading(REGION_ID, block.timestamp + 1000);
        assertTrue(r.isValid);
        assertEq(r.value, 25000000);
    }

    function test_only_pauser_can_pause_factory() public {
        vm.prank(alice);
        vm.expectRevert("BreezeSwap: unauthorized");
        factory.pauseFactory();

        vm.prank(pauser);
        factory.pauseFactory();
        assertTrue(factory.paused());
    }

    function test_paused_factory_blocks_new_markets() public {
        uint256 expiry = block.timestamp + 86400;

        vm.prank(pauser);
        factory.pauseFactory();

        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        factory.createMarket(
            REGION_ID,
            BreezeMarket.WeatherVariable.TEMPERATURE,
            20000000,
            0,
            expiry,
            address(oracle),
            address(collateralToken),
            PayoffCalculator.PayoffType.BINARY
        );

        // Unpause restores market creation
        vm.prank(pauser);
        factory.unpauseFactory();

        address marketAddr = factory.createMarket(
            REGION_ID,
            BreezeMarket.WeatherVariable.TEMPERATURE,
            20000000,
            0,
            expiry,
            address(oracle),
            address(collateralToken),
            PayoffCalculator.PayoffType.BINARY
        );
        assertTrue(marketAddr != address(0));
    }

    function test_paused_market_blocks_minting() public {
        uint256 expiry = block.timestamp + 86400;
        address marketAddr = factory.createMarket(
            REGION_ID,
            BreezeMarket.WeatherVariable.TEMPERATURE,
            20000000,
            0,
            expiry,
            address(oracle),
            address(collateralToken),
            PayoffCalculator.PayoffType.BINARY
        );
        BreezeMarket market = BreezeMarket(marketAddr);

        // Approve collateral vault
        vm.startPrank(alice);
        collateralToken.approve(address(market.vault()), 10_000_000);
        vm.stopPrank();

        // Pause market
        vm.prank(pauser);
        market.pauseMarket();

        // Minting reverts while paused
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        market.mintPosition(PositionToken.Side.LONG, 10_000_000);
        vm.stopPrank();

        // Unpause restores minting
        vm.prank(pauser);
        market.unpauseMarket();

        vm.startPrank(alice);
        uint256 tokenId = market.mintPosition(PositionToken.Side.LONG, 10_000_000);
        assertTrue(tokenId > 0);
        vm.stopPrank();
    }

    function test_paused_market_still_allows_settle() public {
        uint256 expiry = block.timestamp + 1000;
        address marketAddr = factory.createMarket(
            REGION_ID,
            BreezeMarket.WeatherVariable.TEMPERATURE,
            20000000,
            0,
            expiry,
            address(oracle),
            address(collateralToken),
            PayoffCalculator.PayoffType.BINARY
        );
        BreezeMarket market = BreezeMarket(marketAddr);

        // Alice mints position before expiry
        vm.startPrank(alice);
        collateralToken.approve(address(market.vault()), 10_000_000);
        market.mintPosition(PositionToken.Side.LONG, 10_000_000);
        vm.stopPrank();

        // Set oracle reading & fast forward past expiry
        vm.prank(oracleUpdater);
        oracle.setReading(REGION_ID, expiry, 25000000);
        vm.warp(expiry + 1);

        // Pause the market
        vm.prank(pauser);
        market.pauseMarket();
        assertTrue(market.paused());

        // CRITICAL REQUIREMENT: Settle MUST succeed even when market is paused
        market.settle();
        assertEq(uint256(market.status()), uint256(BreezeMarket.Status.SETTLED));
    }

    function test_paused_market_still_allows_redeem() public {
        uint256 expiry = block.timestamp + 1000;
        address marketAddr = factory.createMarket(
            REGION_ID,
            BreezeMarket.WeatherVariable.TEMPERATURE,
            20000000,
            0,
            expiry,
            address(oracle),
            address(collateralToken),
            PayoffCalculator.PayoffType.BINARY
        );
        BreezeMarket market = BreezeMarket(marketAddr);

        // Alice mints LONG position
        vm.startPrank(alice);
        collateralToken.approve(address(market.vault()), 10_000_000);
        uint256 tokenId = market.mintPosition(PositionToken.Side.LONG, 10_000_000);
        vm.stopPrank();

        // Set oracle reading & warp
        vm.prank(oracleUpdater);
        oracle.setReading(REGION_ID, expiry, 25000000); // Winning LONG
        vm.warp(expiry + 1);

        // Settle market
        market.settle();

        // Pause market after settlement
        vm.prank(pauser);
        market.pauseMarket();
        assertTrue(market.paused());

        // CRITICAL REQUIREMENT: Redeem MUST succeed even when market is paused
        uint256 initialBal = collateralToken.balanceOf(alice);
        vm.prank(alice);
        uint256 payout = market.redeem(tokenId, 10_000_000);

        assertEq(payout, 10_000_000);
        assertEq(collateralToken.balanceOf(alice), initialBal + 10_000_000);
    }

    function test_role_revocation_takes_effect_immediately() public {
        bytes32 updaterRole = accessControl.ORACLE_UPDATER_ROLE();

        // Oracle updater can set reading
        vm.prank(oracleUpdater);
        oracle.setReading(REGION_ID, block.timestamp + 500, 22000000);

        // Admin revokes ORACLE_UPDATER_ROLE
        accessControl.revokeRole(updaterRole, oracleUpdater);

        // Oracle updater can no longer set reading
        vm.prank(oracleUpdater);
        vm.expectRevert("BreezeSwap: unauthorized");
        oracle.setReading(REGION_ID, block.timestamp + 600, 23000000);
    }
}
