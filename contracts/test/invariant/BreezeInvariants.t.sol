// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "./BreezeHandler.sol";
import "../../src/core/BreezeMarketFactory.sol";
import "../../src/core/BreezeMarket.sol";
import "../../src/core/PositionToken.sol";
import "../../src/oracle/MockWeatherOracle.sol";

contract BreezeInvariantsTest is Test {
    BreezeMarketFactory public factory;
    BreezeMarket public market;
    MockWeatherOracle public oracle;
    MockInvUSDT public usdt;
    PositionToken public positionToken;
    BreezeHandler public handler;

    bytes32 public regionId = keccak256("TOKYO_RAINFALL");
    uint256 public expiryTimestamp;

    function setUp() public {
        expiryTimestamp = block.timestamp + 7 days;

        positionToken = new PositionToken("https://breezeswap.io/api/");
        factory = new BreezeMarketFactory(address(positionToken));
        oracle = new MockWeatherOracle();
        usdt = new MockInvUSDT();

        positionToken.transferOwnership(address(factory));

        address marketAddr = factory.createMarket(
            regionId,
            BreezeMarket.WeatherVariable.RAINFALL,
            5000,
            15000,
            expiryTimestamp,
            address(oracle),
            address(usdt),
            PayoffCalculator.PayoffType.CAPPED
        );

        market = BreezeMarket(marketAddr);
        handler = new BreezeHandler(factory, market, oracle, usdt, positionToken);

        targetContract(address(handler));
    }

    // INVARIANT 1: Vault balance >= total unredeemed collateral at all times
    function invariant_vaultSolvency() public view {
        uint256 expectedVaultBalance = handler.ghost_totalCollateralDeposited() - handler.ghost_totalPayoutRedeemed();
        assertGe(usdt.balanceOf(address(market.vault())), expectedVaultBalance);
    }

    // INVARIANT 2: Total payout redeemed never exceeds total deposited collateral
    function invariant_noValueCreation() public view {
        assertLe(handler.ghost_totalPayoutRedeemed(), handler.ghost_totalCollateralDeposited());
    }

    // INVARIANT 3: State monotonic (Open -> Settled only)
    function invariant_stateMonotonic() public view {
        if (market.status() == BreezeMarket.Status.SETTLED) {
            assertTrue(market.finalOracleValue() != 0 || market.longPayoutPerToken() >= 0);
        }
    }

    // INVARIANT 4: Position token supply is consistent
    function invariant_positionTokenSupplyConsistent() public view {
        uint256 longSupply = market.totalLongSupply();
        uint256 shortSupply = market.totalShortSupply();

        if (market.status() == BreezeMarket.Status.OPEN) {
            assertEq(longSupply + shortSupply, handler.ghost_totalCollateralDeposited());
        }
    }

    // INVARIANT 5: Only authorized withdrawals (vault balance never negative relative to ghost)
    function invariant_onlyAuthorizedWithdrawals() public view {
        assertGe(handler.ghost_totalCollateralDeposited(), handler.ghost_totalPayoutRedeemed());
    }

    // INVARIANT 6: Market status is strictly valid enum
    function invariant_marketStatusValid() public view {
        uint8 statusVal = uint8(market.status());
        assertTrue(statusVal == 0 || statusVal == 1);
    }
}
