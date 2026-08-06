// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../src/access/BreezeAccessControl.sol";
import "../../src/vault/BreezeLiquidityVault.sol";
import "./VaultHandler.sol";

contract InvToken is ERC20 {
    constructor() ERC20("Mock USDT", "mUSDT") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract VaultInvariantsTest is Test {
    BreezeAccessControl accessControl;
    InvToken token;
    BreezeLiquidityVault vault;
    VaultHandler handler;

    address admin = address(this);

    address[3] lps = [address(0xA1), address(0xA2), address(0xA3)];
    address[2] markets = [address(0xB1), address(0xB2)];

    function setUp() public {
        accessControl = new BreezeAccessControl(admin);
        token = new InvToken();
        vault = new BreezeLiquidityVault(token, address(accessControl), "Breeze LP", "bLP");

        for (uint256 i = 0; i < markets.length; i++) {
            vault.setMarketAuthorization(markets[i], true);
            token.mint(markets[i], 5_000_000e18);
            vm.prank(markets[i]);
            token.approve(address(vault), type(uint256).max);
        }

        for (uint256 i = 0; i < lps.length; i++) {
            token.mint(lps[i], 5_000_000e18);
            vm.prank(lps[i]);
            token.approve(address(vault), type(uint256).max);
        }

        handler = new VaultHandler(vault, token, lps, markets);
        targetContract(address(handler));
    }

    /// Per-market reservations must always sum to the global counter, or the
    /// withdrawal limit is computed from a figure nothing backs.
    function invariant_totalReserved_equals_sum_of_market_reservations() public view {
        assertEq(vault.totalReserved(), handler.marketReservedSum());
    }

    /// Available liquidity is the assets above the floor the utilisation cap
    /// requires the pool to retain, not merely the unreserved assets.
    function invariant_available_liquidity_matches_definition() public view {
        uint256 assets = vault.totalAssets();
        uint256 floorAssets = vault.minRequiredAssets();
        uint256 expected = assets > floorAssets ? assets - floorAssets : 0;
        assertEq(vault.availableLiquidity(), expected);
    }

    /// Withdrawing everything on offer must never push reserved capital past the
    /// utilisation cap — the cap has to hold from both directions, not just when
    /// capital is being reserved.
    function invariant_withdrawing_all_available_keeps_utilization_in_bounds() public view {
        // A realised loss shrinks assets without releasing reservations, so the
        // pool can legitimately sit above the cap. What must hold is that nothing
        // is offered for withdrawal while it does.
        if (vault.availableLiquidity() == 0) return;

        uint256 remaining = vault.totalAssets() - vault.availableLiquidity();
        if (remaining == 0) {
            assertEq(vault.totalReserved(), 0, "reserved capital with nothing behind it");
            return;
        }
        uint256 utilization = (vault.totalReserved() * 10000) / remaining;
        assertLe(utilization, vault.maxUtilizationBps(), "cap breached by withdrawal");
    }

    /// LPs collectively cannot hold claims worth more than the pool holds.
    /// This is the vault's solvency property: shares are a claim on real assets.
    function invariant_share_claims_never_exceed_assets() public view {
        uint256 claims = vault.convertToAssets(vault.totalSupply());
        assertLe(claims, vault.totalAssets(), "share claims exceed pool assets");
    }

    /// No LP may ever be quoted a withdrawal larger than the pool has free.
    function invariant_maxWithdraw_never_exceeds_available() public view {
        uint256 free = vault.availableLiquidity();
        for (uint256 i = 0; i < lps.length; i++) {
            assertLe(vault.maxWithdraw(lps[i]), free, "maxWithdraw exceeds available liquidity");
        }
    }

    /// maxRedeem must be redeemable in practice: the assets it converts to
    /// cannot exceed what the pool can actually pay out.
    function invariant_maxRedeem_is_actually_redeemable() public view {
        uint256 free = vault.availableLiquidity();
        for (uint256 i = 0; i < lps.length; i++) {
            uint256 shares = vault.maxRedeem(lps[i]);
            assertLe(vault.previewRedeem(shares), free, "maxRedeem not payable");
            assertLe(shares, vault.balanceOf(lps[i]), "maxRedeem exceeds balance");
        }
    }

    /// Shares outstanding with no assets behind them would mean LP claims on an
    /// empty pool survive as a permanent liability against future depositors.
    function invariant_no_shares_without_assets() public view {
        if (vault.totalAssets() == 0) {
            assertEq(vault.convertToAssets(vault.totalSupply()), 0, "claims outlive assets");
        }
    }
}
