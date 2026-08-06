// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../src/access/BreezeAccessControl.sol";
import "../../src/oracle/MockWeatherOracle.sol";
import "../../src/fees/FeeConfig.sol";
import "../../src/fees/ProtocolTreasury.sol";
import "../../src/perp/BreezePerpMarket.sol";
import "../../src/perp/InsuranceFund.sol";
import "../../src/perp/VirtualAMM.sol";

contract MockPerpUSDTInt is ERC20 {
    constructor() ERC20("Mock USDT", "mUSDT") {
        _mint(msg.sender, 10_000_000 * 1e18);
    }
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract PerpFullLifecycleTest is Test {
    BreezeAccessControl accessControl;
    MockWeatherOracle oracle;
    FeeConfig feeConfig;
    ProtocolTreasury treasury;
    InsuranceFund insuranceFund;
    MockPerpUSDTInt collateralToken;
    BreezePerpMarket perpMarket;

    address admin = address(this);
    address alice = address(0x2222);
    address bob = address(0x3333);
    address charlie = address(0x4444);

    bytes32 constant REGION_ID = keccak256("TOKYO_RAINFALL");

    function setUp() public {
        accessControl = new BreezeAccessControl(admin);
        accessControl.grantRole(accessControl.ORACLE_UPDATER_ROLE(), admin);
        oracle = new MockWeatherOracle(address(accessControl));
        collateralToken = new MockPerpUSDTInt();

        feeConfig = new FeeConfig(address(accessControl));
        treasury = new ProtocolTreasury(address(collateralToken), address(accessControl));
        insuranceFund = new InsuranceFund(address(collateralToken), address(accessControl));

        VirtualAMM.Reserves memory initialReserves = VirtualAMM.Reserves({
            collateralReserve: 1_000_000 * 1e18,
            weatherReserve: 40_000 * 1e18
        });

        perpMarket = new BreezePerpMarket(
            initialReserves,
            address(oracle),
            address(insuranceFund),
            address(feeConfig),
            address(treasury),
            address(accessControl),
            address(collateralToken),
            REGION_ID
        );

        insuranceFund.setMarketAuthorization(address(perpMarket), true);

        // Seed insurance fund
        collateralToken.mint(address(this), 100_000 * 1e18);
        collateralToken.approve(address(insuranceFund), 100_000 * 1e18);
        insuranceFund.deposit(100_000 * 1e18);

        collateralToken.mint(alice, 100_000 * 1e18);
        collateralToken.mint(bob, 100_000 * 1e18);
        collateralToken.mint(charlie, 100_000 * 1e18);

        vm.prank(alice);
        collateralToken.approve(address(perpMarket), type(uint256).max);

        vm.prank(bob);
        collateralToken.approve(address(perpMarket), type(uint256).max);

        vm.prank(charlie);
        collateralToken.approve(address(perpMarket), type(uint256).max);
    }

    function test_perp_full_lifecycle_end_to_end() public {
        // 1. Alice opens LONG position (10,000 USD, 2x leverage)
        vm.prank(alice);
        uint256 alicePos = perpMarket.openPosition(true, 10_000 * 1e18, 2);

        // 2. Bob opens SHORT position (5,000 USD, 3x leverage)
        vm.prank(bob);
        uint256 bobPos = perpMarket.openPosition(false, 5_000 * 1e18, 3);

        // 3. Fast forward one funding interval & set oracle reading. Warping the
        // market's own interval rather than a literal keeps this correct whichever
        // funding preset the market is configured with.
        vm.warp(block.timestamp + perpMarket.fundingInterval());
        vm.prank(admin);
        oracle.setReading(REGION_ID, block.timestamp, 26_000_000); // 26.0 mm

        perpMarket.settleFunding();

        // 4. Charlie opens a large LONG position, pushing price up
        vm.prank(charlie);
        uint256 charliePos = perpMarket.openPosition(true, 50_000 * 1e18, 2);

        // 5. Alice closes position in profit
        uint256 aliceBalBefore = collateralToken.balanceOf(alice);
        vm.prank(alice);
        int256 alicePnl = perpMarket.closePosition(alicePos);

        assertTrue(alicePnl > 0);
        assertTrue(collateralToken.balanceOf(alice) > aliceBalBefore);

        // 6. Charlie closes position
        vm.prank(charlie);
        perpMarket.closePosition(charliePos);

        // 7. Bob closes position
        vm.prank(bob);
        perpMarket.closePosition(bobPos);

        // Verify open interest is back to zero
        assertEq(perpMarket.totalLongOpenInterest(), 0);
        assertEq(perpMarket.totalShortOpenInterest(), 0);
    }
}
