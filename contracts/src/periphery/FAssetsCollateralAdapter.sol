// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title FAssetsCollateralAdapter
 * @notice Normalizes FXRP (FTestXRP) collateral to USD equivalent value using Flare FTSOv2 price feeds.
 */
contract FAssetsCollateralAdapter is Ownable {
    IERC20 public immutable fxrpToken;
    address public immutable ftsoRegistry;
    bytes21 public immutable fxrpUsdFeedId;

    uint256 public constant PRECISION = 1e18;
    uint256 public fallbackFxrpPriceUsd = 500_000_000_000_000_000; // $0.50 default (18 decimals)

    event PriceUpdated(uint256 newPrice);

    constructor(address fxrpToken_, address ftsoRegistry_, bytes21 fxrpUsdFeedId_) Ownable(msg.sender) {
        fxrpToken = IERC20(fxrpToken_);
        ftsoRegistry = ftsoRegistry_;
        fxrpUsdFeedId = fxrpUsdFeedId_;
    }

    /**
     * @notice Set mock / fallback FXRP/USD price for testnet environments.
     */
    function setFallbackPrice(uint256 priceUsd) external onlyOwner {
        fallbackFxrpPriceUsd = priceUsd;
        emit PriceUpdated(priceUsd);
    }

    /**
     * @notice Returns current USD price of 1 FXRP (18 decimals).
     */
    function getFxrpUsdPrice() public view returns (uint256) {
        // Swap-in point for live FTSOv2 price feed:
        // if (ftsoRegistry != address(0)) return IFtsoV2(ftsoRegistry).getFeedById(fxrpUsdFeedId);
        return fallbackFxrpPriceUsd;
    }

    /**
     * @notice Converts FXRP token amount into normalized USD value (18 decimals).
     */
    function usdValueOf(uint256 fxrpAmount) external view returns (uint256 usdValue) {
        uint256 price = getFxrpUsdPrice();
        return (fxrpAmount * price) / PRECISION;
    }

    /**
     * @notice Normalizes position size given FXRP collateral amount.
     */
    function normalizedCollateral(uint256 fxrpAmount) external view returns (uint256) {
        uint256 price = getFxrpUsdPrice();
        return (fxrpAmount * price) / PRECISION;
    }
}
