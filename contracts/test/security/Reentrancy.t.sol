// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../src/core/BreezeMarket.sol";
import "../../src/core/PositionToken.sol";
import "../../src/oracle/MockWeatherOracle.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockReentrancyUSDT is ERC20 {
    constructor() ERC20("Mock USD", "USDT") {
        _mint(msg.sender, 1_000_000 * 1e18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MaliciousERC1155Receiver is IERC1155Receiver {
    BreezeMarket public targetMarket;
    uint256 public attackTokenId;
    uint256 public attackAmount;
    bool public attacking;
    bool public reentrancyFailed;

    function setTarget(BreezeMarket market, uint256 tokenId, uint256 amount) external {
        targetMarket = market;
        attackTokenId = tokenId;
        attackAmount = amount;
    }

    function onERC1155Received(
        address,
        address,
        uint256 id,
        uint256 value,
        bytes calldata
    ) external override returns (bytes4) {
        if (!attacking && address(targetMarket) != address(0)) {
            attacking = true;
            try targetMarket.redeem(id, value) {
                // Should not succeed
            } catch {
                reentrancyFailed = true;
            }
        }
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external override returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId;
    }
}

contract ReentrancySecurityTest is Test {
    BreezeMarket public market;
    PositionToken public positionToken;
    MockWeatherOracle public oracle;
    MockReentrancyUSDT public usdt;
    MaliciousERC1155Receiver public attacker;
    address public counterparty = address(0x8888);

    bytes32 public regionId = keccak256("TOKYO_RAINFALL");
    uint256 public expiryTimestamp;

    function setUp() public {
        expiryTimestamp = block.timestamp + 7 days;

        positionToken = new PositionToken("https://breezeswap.io/api/");
        oracle = new MockWeatherOracle();
        usdt = new MockReentrancyUSDT();
        attacker = new MaliciousERC1155Receiver();

        market = new BreezeMarket(
            regionId,
            BreezeMarket.WeatherVariable.RAINFALL,
            5000,
            15000,
            expiryTimestamp,
            address(oracle),
            address(usdt),
            address(positionToken),
            PayoffCalculator.PayoffType.CAPPED
        );

        positionToken.setMinter(address(market), true);

        usdt.mint(address(attacker), 1000 * 1e18);
        usdt.mint(counterparty, 1000 * 1e18);

        vm.startPrank(address(attacker));
        usdt.approve(address(market.vault()), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(counterparty);
        usdt.approve(address(market.vault()), type(uint256).max);
        vm.stopPrank();
    }

    function test_reentrancy_redeem_fails() public {
        // 1. Attacker mints position
        vm.prank(address(attacker));
        uint256 tokenId = market.mintPosition(PositionToken.Side.LONG, 500 * 1e18);

        // Counterparty mints short
        vm.prank(counterparty);
        market.mintPosition(PositionToken.Side.SHORT, 500 * 1e18);

        // 2. Warp past expiry & settle
        vm.warp(expiryTimestamp + 1);
        oracle.setReading(regionId, expiryTimestamp, 10000);
        market.settle();

        // 3. Configure attacker callback target
        attacker.setTarget(market, tokenId, 500 * 1e18);

        // 4. Attacker redeems — onERC1155Received callback attempts reentrant redeem()
        vm.prank(address(attacker));
        uint256 payout = market.redeem(tokenId, 500 * 1e18);

        assertEq(payout, 500 * 1e18);
        assertEq(usdt.balanceOf(address(attacker)), 1000 * 1e18); // 500 remaining + 500 payout
    }
}
