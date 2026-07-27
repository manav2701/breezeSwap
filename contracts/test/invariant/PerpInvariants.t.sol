// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../src/access/BreezeAccessControl.sol";
import "../../src/oracle/MockWeatherOracle.sol";
import "../../src/perp/BreezePerpMarket.sol";
import "../../src/perp/InsuranceFund.sol";
import "../../src/perp/VirtualAMM.sol";
import "./PerpHandler.sol";

contract MockPerpUSDTInv is ERC20 {
    constructor() ERC20("Mock USDT", "mUSDT") {
        _mint(msg.sender, 10_000_000 * 1e18);
    }
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract PerpInvariantsTest is Test {
    using VirtualAMM for VirtualAMM.Reserves;

    BreezeAccessControl accessControl;
    MockWeatherOracle oracle;
    InsuranceFund insuranceFund;
    MockPerpUSDTInv collateralToken;
    BreezePerpMarket perpMarket;
    PerpHandler handler;

    uint256 initialK;

    bytes32 constant REGION_ID = keccak256("TOKYO_RAINFALL");

    function setUp() public {
        accessControl = new BreezeAccessControl(address(this));
        oracle = new MockWeatherOracle(address(accessControl));
        collateralToken = new MockPerpUSDTInv();
        insuranceFund = new InsuranceFund(address(collateralToken), address(accessControl));

        VirtualAMM.Reserves memory initialReserves = VirtualAMM.Reserves({
            collateralReserve: 1_000_000 * 1e18,
            weatherReserve: 40_000 * 1e18
        });

        initialK = initialReserves.k();

        perpMarket = new BreezePerpMarket(
            initialReserves,
            address(oracle),
            address(insuranceFund),
            address(accessControl),
            address(collateralToken),
            REGION_ID
        );

        insuranceFund.setMarketAuthorization(address(perpMarket), true);

        // Top up insurance fund
        collateralToken.mint(address(this), 100_000 * 1e18);
        collateralToken.approve(address(insuranceFund), 100_000 * 1e18);
        insuranceFund.deposit(100_000 * 1e18);

        handler = new PerpHandler(perpMarket, collateralToken, oracle);

        // Mint collateral to handler traders
        for (uint256 i = 0; i < 3; i++) {
            collateralToken.mint(handler.traders(i), 500_000 * 1e18);
        }

        targetContract(address(handler));
    }

    function invariant_openInterestConsistent() public view {
        uint256 sumLong = 0;
        uint256 sumShort = 0;
        uint256 count = perpMarket.nextPositionId();

        for (uint256 i = 0; i < count; i++) {
            (, bool isLong, uint256 collateral, , , , , bool isOpen) = perpMarket.positions(i);
            if (isOpen) {
                if (isLong) sumLong += collateral;
                else sumShort += collateral;
            }
        }

        assertEq(perpMarket.totalLongOpenInterest(), sumLong);
        assertEq(perpMarket.totalShortOpenInterest(), sumShort);
    }

    function invariant_kPreserved() public view {
        (uint256 cRes, uint256 wRes) = perpMarket.reserves();
        uint256 currentK = cRes * wRes;
        assertApproxEqRel(currentK, initialK, 1e12); // K preserved within integer rounding tolerance
    }
}
