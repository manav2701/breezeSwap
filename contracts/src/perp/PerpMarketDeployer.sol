// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./BreezePerpMarket.sol";
import "./VirtualAMM.sol";

/// @title PerpMarketDeployer
/// @notice Deploys `BreezePerpMarket` instances on behalf of `BreezePerpFactory`.
///
/// @dev This library exists for one reason: EIP-170.
///
/// `new BreezePerpMarket(...)` compiles the market's ENTIRE creation bytecode into whatever
/// contract contains the expression. `BreezePerpMarket` is 21.6 KB of initcode, so the
/// factory that created it carried all of that plus its own logic and reached 26,527 bytes
/// against a 24,576 byte on-chain limit. The factory could not be deployed to any EVM
/// chain, and nothing caught it because Foundry does not enforce the limit in tests.
///
/// Declaring the function `public` rather than `internal` is the whole mechanism. An
/// internal library function is inlined into the caller and would move nothing; a public
/// one makes the library a separately deployed contract that the factory reaches by
/// `DELEGATECALL`, so the market bytecode lives here and the factory drops to roughly 5 KB.
/// The link is resolved at deploy time, which is why the deployment scripts must deploy
/// this library first.
///
/// Because the call is a `DELEGATECALL`, `new` executes in the FACTORY's context: the
/// deployed market's creator is the factory, exactly as before. Nothing about the market's
/// address derivation, ownership or behaviour changes.
///
/// The size headroom matters as much as the fix. `BreezePerpMarket` has grown once already
/// (peril registry, utilisation surcharge, first-loss reserve) and pushed the factory
/// through the ceiling. With the bytecode isolated here, the factory no longer grows when
/// the market does.
library PerpMarketDeployer {
    /// @notice Everything a market needs, in one memory struct.
    ///
    /// @dev A struct rather than eight parameters, and not for tidiness: passing them
    /// individually put the factory's `createPerpMarket` frame over the EVM's 16-slot
    /// reachable stack and the compiler refused it with "stack too deep". A memory struct
    /// costs one slot regardless of how many fields it carries.
    struct MarketParams {
        VirtualAMM.Reserves reserves;
        address oracle;
        address insuranceFund;
        address feeConfig;
        address treasury;
        address accessControl;
        address collateralToken;
        bytes32 regionId;
    }

    /// @notice Deploy one perpetual market.
    /// @dev `public`, deliberately. See the note above: `internal` would inline into the
    /// factory and undo the entire point of this library.
    function deploy(MarketParams memory p) public returns (address market) {
        return address(
            new BreezePerpMarket(
                p.reserves,
                p.oracle,
                p.insuranceFund,
                p.feeConfig,
                p.treasury,
                p.accessControl,
                p.collateralToken,
                p.regionId
            )
        );
    }
}
