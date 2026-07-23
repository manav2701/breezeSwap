// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PositionToken
 * @notice ERC1155 token representing parametric position claims (Long or Short) for BreezeSwap weather markets.
 * Token IDs are derived deterministically from keccak256(abi.encodePacked(marketAddress, side)).
 */
contract PositionToken is ERC1155, Ownable {
    enum Side { LONG, SHORT }

    /// @notice Authorized minter addresses (BreezeMarket instances)
    mapping(address => bool) public isMinter;

    /// @notice Token ID to underlying Market address mapping
    mapping(uint256 => address) private _tokenIdToMarket;

    /// @notice Token ID to Side mapping
    mapping(uint256 => Side) private _tokenIdToSide;

    event MinterSet(address indexed minter, bool status);

    error NotMinter();
    error InvalidMarketAddress();

    modifier onlyMinter() {
        if (!isMinter[msg.sender] && msg.sender != owner()) {
            revert NotMinter();
        }
        _;
    }

    constructor(string memory uri_) ERC1155(uri_) Ownable(msg.sender) {}

    /**
     * @notice Set minter authorization status for an address (e.g. BreezeMarket or Factory).
     */
    function setMinter(address minter, bool status) external onlyOwner {
        if (minter == address(0)) revert InvalidMarketAddress();
        isMinter[minter] = status;
        emit MinterSet(minter, status);
    }

    /**
     * @notice Derives deterministic token ID for a given market address and position side.
     */
    function getTokenId(address marketAddress, Side side) public pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(marketAddress, side)));
    }

    /**
     * @notice Returns the underlying market address for a given token ID.
     */
    function marketOf(uint256 tokenId) external view returns (address) {
        return _tokenIdToMarket[tokenId];
    }

    /**
     * @notice Returns the position side for a given token ID.
     */
    function sideOf(uint256 tokenId) external view returns (Side) {
        return _tokenIdToSide[tokenId];
    }

    /**
     * @notice Mint position tokens to a target address. Restricted to authorized minters.
     */
    function mint(
        address to,
        address marketAddress,
        Side side,
        uint256 amount
    ) external onlyMinter returns (uint256 tokenId) {
        if (marketAddress == address(0)) revert InvalidMarketAddress();
        tokenId = getTokenId(marketAddress, side);
        
        if (_tokenIdToMarket[tokenId] == address(0)) {
            _tokenIdToMarket[tokenId] = marketAddress;
            _tokenIdToSide[tokenId] = side;
        }

        _mint(to, tokenId, amount, "");
    }

    /**
     * @notice Burn position tokens from a target address. Restricted to authorized minters.
     */
    function burn(
        address from,
        uint256 tokenId,
        uint256 amount
    ) external onlyMinter {
        _burn(from, tokenId, amount);
    }
}
