// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../src/core/PositionToken.sol";

contract PositionTokenTest is Test {
    PositionToken public positionToken;
    address public owner = address(this);
    address public minter = address(0x1111);
    address public alice = address(0x2222);
    address public market = address(0x3333);

    function setUp() public {
        positionToken = new PositionToken("https://breezeswap.io/api/metadata/{id}.json");
        positionToken.setMinter(minter, true);
    }

    function test_OnlyAuthorizedMinterCanMint() public {
        vm.prank(minter);
        uint256 tokenId = positionToken.mint(alice, market, PositionToken.Side.LONG, 100);

        assertEq(positionToken.balanceOf(alice, tokenId), 100);
        assertEq(positionToken.marketOf(tokenId), market);
        assertEq(uint8(positionToken.sideOf(tokenId)), uint8(PositionToken.Side.LONG));
    }

    function test_UnauthorizedCannotMint() public {
        vm.prank(alice);
        vm.expectRevert(PositionToken.NotMinter.selector);
        positionToken.mint(alice, market, PositionToken.Side.LONG, 100);
    }

    function test_OnlyAuthorizedMinterCanBurn() public {
        vm.prank(minter);
        uint256 tokenId = positionToken.mint(alice, market, PositionToken.Side.SHORT, 100);

        vm.prank(minter);
        positionToken.burn(alice, tokenId, 40);
        assertEq(positionToken.balanceOf(alice, tokenId), 60);
    }

    function test_UnauthorizedCannotBurn() public {
        vm.prank(minter);
        uint256 tokenId = positionToken.mint(alice, market, PositionToken.Side.SHORT, 100);

        vm.prank(alice);
        vm.expectRevert(PositionToken.NotMinter.selector);
        positionToken.burn(alice, tokenId, 40);
    }

    function test_TokenIdRoundTrip() public view {
        uint256 longId = positionToken.getTokenId(market, PositionToken.Side.LONG);
        uint256 shortId = positionToken.getTokenId(market, PositionToken.Side.SHORT);

        assertTrue(longId != shortId);
    }
}
