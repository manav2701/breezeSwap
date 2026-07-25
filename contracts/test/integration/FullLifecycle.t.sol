// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../src/access/BreezeAccessControl.sol";
import "../../src/core/BreezeMarketFactory.sol";
import "../../src/core/BreezeMarket.sol";
import "../../src/core/PositionToken.sol";
import "../../src/oracle/MockWeatherOracle.sol";
import "../../src/vault/CollateralVault.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDT is ERC20 {
    constructor() ERC20("Tether USD", "USDT") {
        _mint(msg.sender, 1_000_000 * 1e18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract FullLifecycleIntegrationTest is Test {
    BreezeAccessControl public accessControl;
    BreezeMarketFactory public factory;
    PositionToken public positionToken;
    MockWeatherOracle public oracle;
    MockUSDT public usdt;

    address public alice = address(0x1111);
    address public bob = address(0x2222);

    bytes32 public regionId = keccak256("SEOUL_RAINFALL_JULY");
    uint256 public expiryTimestamp;
    int256 public thresholdLow = 5000;   // 50.00 mm
    int256 public thresholdHigh = 15000; // 150.00 mm

    function setUp() public {
        expiryTimestamp = block.timestamp + 14 days;
        accessControl = new BreezeAccessControl(address(this));

        positionToken = new PositionToken("https://breezeswap.io/metadata/");
        oracle = new MockWeatherOracle(address(accessControl));
        usdt = new MockUSDT();

        factory = new BreezeMarketFactory(address(positionToken), address(accessControl));
        positionToken.transferOwnership(address(factory));

        usdt.mint(alice, 10_000 * 1e18);
        usdt.mint(bob, 10_000 * 1e18);
    }

    function test_EndToEndLifecycleVaultDrainedToZero() public {
        // Step 1: Create Market via Factory
        address marketAddr = factory.createMarket(
            regionId,
            BreezeMarket.WeatherVariable.RAINFALL,
            thresholdLow,
            thresholdHigh,
            expiryTimestamp,
            address(oracle),
            address(usdt),
            PayoffCalculator.PayoffType.CAPPED
        );

        BreezeMarket market = BreezeMarket(marketAddr);
        CollateralVault vault = market.vault();

        // Step 2: Users approve Vault
        vm.startPrank(alice);
        usdt.approve(address(vault), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(bob);
        usdt.approve(address(vault), type(uint256).max);
        vm.stopPrank();

        // Step 3: Alice mints 2500 USDT Long, Bob mints 2500 USDT Short
        vm.prank(alice);
        uint256 aliceLongId = market.mintPosition(PositionToken.Side.LONG, 2500 * 1e18);

        vm.prank(bob);
        uint256 bobShortId = market.mintPosition(PositionToken.Side.SHORT, 2500 * 1e18);

        assertEq(usdt.balanceOf(address(vault)), 5000 * 1e18);
        assertEq(market.totalCollateral(), 5000 * 1e18);

        // Step 4: Fast-forward time past market expiry
        vm.warp(expiryTimestamp + 10);

        // Step 5: Oracle resolves rainfall reading at 10,000 (50% midpoint)
        oracle.setReading(regionId, expiryTimestamp, 10000);

        // Step 6: Permissionlessly settle market
        market.settle();
        assertTrue(market.status() == BreezeMarket.Status.SETTLED);

        // Step 7: Both Alice and Bob redeem their full position tokens
        uint256 alicePreBal = usdt.balanceOf(alice);
        vm.prank(alice);
        uint256 alicePayout = market.redeem(aliceLongId, 2500 * 1e18);

        uint256 bobPreBal = usdt.balanceOf(bob);
        vm.prank(bob);
        uint256 bobPayout = market.redeem(bobShortId, 2500 * 1e18);

        // Assert 1: Each received exact proportional 50% payout (2500 USDT each)
        assertEq(alicePayout, 2500 * 1e18);
        assertEq(bobPayout, 2500 * 1e18);
        assertEq(usdt.balanceOf(alice) - alicePreBal, 2500 * 1e18);
        assertEq(usdt.balanceOf(bob) - bobPreBal, 2500 * 1e18);

        // Assert 2: Core zero-dust invariant: Vault balance is fully drained to exactly 0
        assertEq(usdt.balanceOf(address(vault)), 0);
        assertEq(vault.totalDeposited(), 0);
    }
}
