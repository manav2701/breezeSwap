// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../script/BreezeDeployer.sol";

/// @notice Does a fresh deployment actually have everything connected?
///
/// This is the test the project most needed and did not have. Every tier of the capital
/// stack is optional by design — the waterfall degrades cleanly to a single tranche, a perp
/// market with no vault pays winners only out of posted collateral, a market with no peril
/// registry is bounded only by its own capacity. That is the right behaviour for a partial
/// configuration and it is exactly what makes a missed wiring call invisible: the protocol
/// works, and silently has no junior tranche.
///
/// The deployment scripts had in fact drifted this far. They stood up the pre-waterfall
/// stack: no liquidity vault, no junior tranche, no first-loss reserve, no peril registry
/// and no policy market. Two phases of capital-structure work were unreachable from any
/// deployment path, and nothing failed.
///
/// So the scripts and this test share one wiring implementation, and this asserts each link
/// individually rather than checking that the deployment "succeeded".
contract DeploymentWiringTest is Test {
    address deployer = address(0xDE9);
    address multisig = address(0x115);
    address updater = address(0x0BAC);

    bytes32 constant TOKYO = keccak256("TOKYO_RAINFALL");
    bytes32 constant OSAKA = keccak256("OSAKA_RAINFALL");
    bytes32 constant JAPAN_RAIN = keccak256("PERIL_JAPAN_RAINFALL");

    function setUp() public {
        vm.warp(1_700_000_000);
    }

    function _config() internal pure returns (BreezeDeployer.Config memory cfg) {
        cfg.perpRegions = new bytes32[](2);
        cfg.perpRegions[0] = TOKYO;
        cfg.perpRegions[1] = OSAKA;
        cfg.perilGroups = new bytes32[](2);
        cfg.perilGroups[0] = JAPAN_RAIN;
        cfg.perilGroups[1] = JAPAN_RAIN;
    }

    /// @dev Pranked as `deployer` throughout, and that is not incidental. The library is
    /// inlined into whoever calls it, so `msg.sender` for every wiring call is this test
    /// contract unless told otherwise — which would make `deployer` a bystander and let a
    /// deployment pass here that reverts under `forge script`, where the signer really is a
    /// separate externally owned account. Pranking models the script faithfully.
    function _deployAs(BreezeDeployer.Config memory cfg)
        internal
        returns (BreezeDeployer.Deployment memory d)
    {
        vm.startPrank(deployer);
        d = BreezeDeployer.deploy(cfg, deployer);
        vm.stopPrank();
    }

    function _deploy() internal returns (BreezeDeployer.Deployment memory) {
        return _deployAs(_config());
    }

    function _deployGoverned() internal returns (BreezeDeployer.Deployment memory) {
        BreezeDeployer.Config memory cfg = _config();
        cfg.governanceMultisig = multisig;
        cfg.timelockDelay = 2 days;
        cfg.oracleUpdater = updater;
        return _deployAs(cfg);
    }

    // =================================================================
    // Everything exists
    // =================================================================

    function test_every_contract_is_deployed() public {
        BreezeDeployer.Deployment memory d = _deploy();

        assertTrue(address(d.accessControl) != address(0), "accessControl");
        assertTrue(address(d.collateralToken) != address(0), "collateralToken");
        assertTrue(address(d.weatherOracle) != address(0), "weatherOracle");
        assertTrue(address(d.pricingOracle) != address(0), "pricingOracle");
        assertTrue(address(d.positionToken) != address(0), "positionToken");
        assertTrue(address(d.classicFactory) != address(0), "classicFactory");
        assertTrue(address(d.feeConfig) != address(0), "feeConfig");
        assertTrue(address(d.treasury) != address(0), "treasury");
        assertTrue(address(d.insuranceFund) != address(0), "insuranceFund");
        assertTrue(address(d.firstLossReserve) != address(0), "firstLossReserve");
        assertTrue(address(d.vault) != address(0), "vault");
        assertTrue(address(d.juniorTranche) != address(0), "juniorTranche");
        assertTrue(address(d.perilRegistry) != address(0), "perilRegistry");
        assertTrue(address(d.perpFactory) != address(0), "perpFactory");
        assertTrue(address(d.policyMarket) != address(0), "policyMarket");
        assertEq(d.perpMarkets.length, 2, "perp markets");
    }

    // =================================================================
    // The loss waterfall
    // =================================================================

    /// Both directions. The vault holds interfaces to the tiers above it; the junior tranche
    /// needs the senior vault to ask what backing is free before releasing anyone. One side
    /// alone leaves a tier that exists and is never consulted.
    function test_waterfall_is_wired_in_both_directions() public {
        BreezeDeployer.Deployment memory d = _deploy();

        assertEq(address(d.vault.firstLossFund()), address(d.firstLossReserve), "tier 1 unset");
        assertEq(address(d.vault.juniorTranche()), address(d.juniorTranche), "tier 2 unset");
        assertEq(address(d.juniorTranche.seniorVault()), address(d.vault), "junior has no senior");
    }

    /// Tier 1 is drawn by the vault and nothing else. A market authorised here would rebuild
    /// the shared-pot contention the dedicated reserve exists to remove.
    function test_only_the_vault_can_draw_tier_one() public {
        BreezeDeployer.Deployment memory d = _deploy();

        assertTrue(d.firstLossReserve.authorizedDrawers(address(d.vault)), "vault cannot draw");
        for (uint256 i = 0; i < d.perpMarkets.length; i++) {
            assertFalse(
                d.firstLossReserve.authorizedDrawers(d.perpMarkets[i]),
                "a market can draw tier 1 directly"
            );
        }
        assertFalse(d.firstLossReserve.authorizedDrawers(deployer), "deployer can draw tier 1");
    }

    /// The waterfall has to be able to actually run, not merely be configured. This is the
    /// end-to-end check: deposit, take a loss, and confirm tier 1 absorbed it.
    function test_a_loss_flows_through_the_configured_waterfall() public {
        BreezeDeployer.Deployment memory d = _deploy();

        // Fund tier 1 and the senior pool.
        vm.startPrank(deployer);
        d.collateralToken.approve(address(d.firstLossReserve), 50_000e18);
        d.firstLossReserve.deposit(50_000e18);
        d.collateralToken.approve(address(d.vault), 100_000e18);
        d.vault.deposit(100_000e18, deployer);

        // Stand in for a market so the draw can be exercised directly.
        d.accessControl.grantRole(d.accessControl.ADMIN_ROLE(), address(this));
        vm.stopPrank();
        d.vault.setMarketAuthorization(address(this), true);

        uint256 seniorBefore = d.vault.totalAssets();
        uint256 covered = d.vault.coverLoss(30_000e18);

        assertEq(covered, 30_000e18, "loss not covered");
        assertEq(d.firstLossReserve.balance(), 20_000e18, "tier 1 did not absorb");
        assertEq(d.vault.totalAssets(), seniorBefore, "senior paid while tier 1 had capital");
    }

    // =================================================================
    // Markets
    // =================================================================

    function test_every_perp_market_is_fully_wired() public {
        BreezeDeployer.Deployment memory d = _deploy();

        for (uint256 i = 0; i < d.perpMarkets.length; i++) {
            BreezePerpMarket m = BreezePerpMarket(d.perpMarkets[i]);

            assertEq(address(m.liquidityVault()), address(d.vault), "no vault backstop");
            assertEq(
                address(m.firstLossReserve()), address(d.firstLossReserve), "no first-loss leg"
            );
            assertEq(address(m.perilRegistry()), address(d.perilRegistry), "no peril registry");

            assertTrue(d.vault.authorizedMarkets(address(m)), "vault does not authorise market");
            assertTrue(
                d.insuranceFund.authorizedMarkets(address(m)), "backstop does not authorise market"
            );
            assertTrue(d.perilRegistry.isRegistered(address(m)), "market not in the registry");
        }
    }

    /// Correlated markets have to actually land in one bucket, or the aggregate cap is a
    /// tighter per-market limit wearing a correlation costume.
    function test_correlated_markets_share_a_peril_group() public {
        BreezeDeployer.Deployment memory d = _deploy();

        bytes32 g0 = d.perilRegistry.perilGroupOfMarket(d.perpMarkets[0]);
        bytes32 g1 = d.perilRegistry.perilGroupOfMarket(d.perpMarkets[1]);

        assertEq(g0, JAPAN_RAIN, "region not declared");
        assertEq(g1, g0, "correlated markets ended up in separate groups");
        assertTrue(g0 != bytes32(0), "fell back to the catch-all group");
    }

    function test_policy_market_can_draw_on_the_vault() public {
        BreezeDeployer.Deployment memory d = _deploy();
        assertTrue(
            d.vault.authorizedMarkets(address(d.policyMarket)),
            "policy market cannot reserve or claim"
        );
        assertEq(address(d.policyMarket.liquidityVault()), address(d.vault));
        assertEq(address(d.policyMarket.pricingOracle()), address(d.pricingOracle));
    }

    /// Both factories must consult the climatology, or markets can be created at odds
    /// unrelated to it — the defect Phase C closed.
    function test_both_factories_are_pointed_at_the_pricing_oracle() public {
        BreezeDeployer.Deployment memory d = _deploy();
        assertEq(address(d.classicFactory.pricingOracle()), address(d.pricingOracle));
        assertEq(address(d.perpFactory.pricingOracle()), address(d.pricingOracle));
    }

    /// The factory grants minter status to each market it deploys, so it has to own the
    /// shared token. Without this, market creation reverts on the first mint attempt.
    function test_classic_factory_owns_the_position_token() public {
        BreezeDeployer.Deployment memory d = _deploy();
        assertEq(d.positionToken.owner(), address(d.classicFactory));
    }

    /// A market created after deployment must work, which exercises the factory wiring
    /// rather than just reading it.
    function test_a_classic_market_can_be_created_after_deployment() public {
        BreezeDeployer.Deployment memory d = _deploy();

        address market = d.classicFactory.createMarket(
            TOKYO,
            BreezeMarket.WeatherVariable.RAINFALL,
            40e6,
            50e6,
            block.timestamp + 30 days,
            address(d.weatherOracle),
            address(d.collateralToken),
            PayoffCalculator.PayoffType.BINARY
        );
        assertTrue(d.positionToken.isMinter(market), "new market cannot mint");
    }

    // =================================================================
    // Governance
    // =================================================================

    /// No intermediary may retain a role.
    ///
    /// @dev This used to assert that a throwaway *builder contract* held nothing. There is no
    /// builder any more, and the equivalent hazard moved rather than disappeared: the caller
    /// the library is inlined into must not end up with control it was never meant to have.
    /// Under `forge script` that address is the script contract, which exists only in the
    /// local EVM and has no key behind it on any chain, so a role left there is permanently
    /// unusable exactly as before.
    function test_no_intermediary_keeps_roles() public {
        BreezeDeployer.Deployment memory d = _deployGoverned();
        BreezeAccessControl ac = d.accessControl;

        address[2] memory intermediaries = [address(this), deployer];
        string[2] memory labels = ["caller", "deployer"];

        for (uint256 i = 0; i < intermediaries.length; i++) {
            address a = intermediaries[i];
            assertFalse(ac.hasRole(ac.ADMIN_ROLE(), a), string.concat(labels[i], " kept ADMIN_ROLE"));
            assertFalse(
                ac.hasRole(ac.DEFAULT_ADMIN_ROLE(), a),
                string.concat(labels[i], " kept DEFAULT_ADMIN_ROLE")
            );
            assertFalse(ac.hasRole(ac.PAUSER_ROLE(), a), string.concat(labels[i], " kept PAUSER_ROLE"));
            assertFalse(
                ac.hasRole(ac.ORACLE_UPDATER_ROLE(), a),
                string.concat(labels[i], " kept ORACLE_UPDATER_ROLE")
            );
            assertFalse(
                ac.hasRole(ac.MARKET_CREATOR_ROLE(), a),
                string.concat(labels[i], " kept MARKET_CREATOR_ROLE")
            );
        }
    }

    /// The deployment path must stay deployable.
    ///
    /// @dev The reason this file exists at all is that wiring defects are silent. This one
    /// was worse: `BreezeDeployer` was a contract that called `new` on fifteen others, so it
    /// carried all their creation bytecode and came to 133,883 bytes against EIP-170's
    /// 24,576. It could not be deployed to any chain, and every test here passed anyway,
    /// because Foundry does not enforce the code size limit. A green suite is not evidence
    /// that a deployment can happen, so assert it directly.
    ///
    /// EXCLUDED FROM `forge coverage`, deliberately, and it must stay excluded. Coverage
    /// disables the optimizer, which inflates every contract: the largest compiles to about
    /// 29.6 KB unoptimized against 22.3 KB shipped. Run there, this asserts a property of a
    /// binary that never leaves CI and fails for a reason that says nothing about whether
    /// the protocol can be deployed. See the exclusion in `.github/workflows/contracts-ci.yml`.
    function test_no_deployed_contract_exceeds_the_chain_code_size_limit() public {
        BreezeDeployer.Deployment memory d = _deploy();

        address[10] memory deployed = [
            address(d.accessControl),
            address(d.weatherOracle),
            address(d.pricingOracle),
            address(d.positionToken),
            address(d.classicFactory),
            address(d.vault),
            address(d.juniorTranche),
            address(d.firstLossReserve),
            address(d.perpFactory),
            address(d.policyMarket)
        ];

        for (uint256 i = 0; i < deployed.length; i++) {
            assertLe(deployed[i].code.length, 24_576, "contract over EIP-170 limit");
            assertGt(deployed[i].code.length, 0, "contract has no code");
        }

        for (uint256 i = 0; i < d.perpMarkets.length; i++) {
            assertLe(d.perpMarkets[i].code.length, 24_576, "perp market over EIP-170 limit");
        }
    }

    /// With no multisig configured everything lands on the deployer. That is a testnet
    /// deployment and the script says so loudly; what matters here is that it is usable.
    function test_without_a_multisig_the_deployer_holds_every_role() public {
        BreezeDeployer.Deployment memory d = _deploy();
        BreezeAccessControl ac = d.accessControl;

        assertTrue(ac.hasRole(ac.ADMIN_ROLE(), deployer));
        assertTrue(ac.hasRole(ac.DEFAULT_ADMIN_ROLE(), deployer));
        assertTrue(ac.hasRole(ac.PAUSER_ROLE(), deployer));
        assertTrue(ac.hasRole(ac.ORACLE_UPDATER_ROLE(), deployer));
        assertTrue(ac.hasRole(ac.MARKET_CREATOR_ROLE(), deployer));
        assertEq(address(d.timelock), address(0), "a timelock was deployed without a multisig");
    }

    /// The handover: parameter control behind a delay, and the deployer key holding nothing.
    function test_governance_handover_moves_admin_behind_the_timelock() public {
        BreezeDeployer.Deployment memory d = _deployGoverned();
        BreezeAccessControl ac = d.accessControl;

        assertTrue(address(d.timelock) != address(0), "no timelock deployed");
        assertTrue(ac.hasRole(ac.ADMIN_ROLE(), address(d.timelock)), "timelock has no admin");
        assertTrue(ac.hasRole(ac.DEFAULT_ADMIN_ROLE(), address(d.timelock)));
        assertTrue(ac.hasRole(ac.MARKET_CREATOR_ROLE(), address(d.timelock)));

        assertFalse(ac.hasRole(ac.ADMIN_ROLE(), deployer), "deployer still holds ADMIN_ROLE");
        assertFalse(ac.hasRole(ac.DEFAULT_ADMIN_ROLE(), deployer), "deployer still root admin");
        assertFalse(ac.hasRole(ac.PAUSER_ROLE(), deployer));
        assertFalse(ac.hasRole(ac.ORACLE_UPDATER_ROLE(), deployer));
        assertFalse(ac.hasRole(ac.MARKET_CREATOR_ROLE(), deployer));
    }

    /// Pausing must NOT be timelocked. A pause that lands in two days is not an emergency
    /// control, and its worst case is bounded anyway — withdrawals, settlement, closes and
    /// liquidations are all deliberately unpausable.
    function test_pausing_stays_immediate_with_the_multisig() public {
        BreezeDeployer.Deployment memory d = _deployGoverned();
        BreezeAccessControl ac = d.accessControl;

        assertTrue(ac.hasRole(ac.PAUSER_ROLE(), multisig), "multisig cannot pause");
        assertFalse(
            ac.hasRole(ac.PAUSER_ROLE(), address(d.timelock)),
            "pausing was put behind the timelock"
        );

        // And it works, right now, with no proposal.
        vm.prank(multisig);
        d.vault.pauseDeposits();
        assertTrue(d.vault.paused());
    }

    /// Oracle updates likewise cannot wait — readings are posted continuously, and a
    /// timelock on them would stop the protocol resolving anything.
    function test_oracle_updates_stay_immediate() public {
        BreezeDeployer.Deployment memory d = _deployGoverned();
        BreezeAccessControl ac = d.accessControl;

        assertTrue(ac.hasRole(ac.ORACLE_UPDATER_ROLE(), updater), "updater cannot post");
        assertFalse(
            ac.hasRole(ac.ORACLE_UPDATER_ROLE(), address(d.timelock)),
            "oracle updates were put behind the timelock"
        );

        vm.prank(updater);
        d.weatherOracle.setReading(TOKYO, block.timestamp, 25e6);
    }

    /// The timelock is self-administered, so nobody can shorten its own delay without
    /// serving it. An admin key able to set the delay to zero is the same as no timelock.
    function test_the_timelock_is_self_administered() public {
        BreezeDeployer.Deployment memory d = _deployGoverned();
        TimelockController t = d.timelock;

        assertEq(t.getMinDelay(), 2 days);
        assertTrue(t.hasRole(t.PROPOSER_ROLE(), multisig));
        assertTrue(t.hasRole(t.EXECUTOR_ROLE(), multisig));
        assertTrue(t.hasRole(t.DEFAULT_ADMIN_ROLE(), address(t)), "timelock does not admin itself");
        assertFalse(t.hasRole(t.DEFAULT_ADMIN_ROLE(), deployer), "deployer can reconfigure it");
        assertFalse(t.hasRole(t.DEFAULT_ADMIN_ROLE(), multisig), "multisig can reconfigure it");
    }

    /// A parameter change has to actually be executable through the timelock, or the
    /// handover has locked the protocol's configuration permanently.
    function test_a_parameter_change_can_be_executed_through_the_timelock() public {
        BreezeDeployer.Deployment memory d = _deployGoverned();
        TimelockController t = d.timelock;

        bytes memory call = abi.encodeCall(BreezeLiquidityVault.setMaxUtilizationBps, (7000));

        vm.prank(multisig);
        t.schedule(address(d.vault), 0, call, bytes32(0), bytes32(0), 2 days);

        // Not before the delay.
        vm.prank(multisig);
        vm.expectRevert();
        t.execute(address(d.vault), 0, call, bytes32(0), bytes32(0));

        vm.warp(block.timestamp + 2 days);
        vm.prank(multisig);
        t.execute(address(d.vault), 0, call, bytes32(0), bytes32(0));

        assertEq(d.vault.maxUtilizationBps(), 7000, "the change never landed");
    }

    /// And the deployer key cannot make that change directly any more.
    function test_the_deployer_cannot_change_parameters_after_handover() public {
        BreezeDeployer.Deployment memory d = _deployGoverned();

        vm.prank(deployer);
        vm.expectRevert(BreezeLiquidityVault.UnauthorizedCaller.selector);
        d.vault.setMaxUtilizationBps(7000);
    }

    // =================================================================
    // Configuration guards
    // =================================================================

    function test_a_real_collateral_token_is_used_when_configured() public {
        BreezeDeployer.Config memory cfg = _config();
        BreezeDemoUSD existing = new BreezeDemoUSD(address(this));
        cfg.collateralToken = address(existing);

        BreezeDeployer.Deployment memory d = _deployAs(cfg);
        assertEq(address(d.collateralToken), address(existing));
        assertFalse(d.collateralIsDemoToken, "a demo token was deployed anyway");
    }

    /// The demo token has to be mintable to somebody who holds a key. Minting it to the
    /// inlined caller would strand the whole supply at an address with no key behind it.
    function test_the_demo_token_supply_reaches_the_deployer() public {
        BreezeDeployer.Deployment memory d = _deploy();
        assertTrue(d.collateralIsDemoToken);
        assertEq(d.collateralToken.balanceOf(deployer), 10_000_000e18);
        assertEq(d.collateralToken.balanceOf(address(this)), 0);
    }

    /// @dev `vm.expectRevert` needs a real call boundary to observe, and an inlined internal
    /// library function is not one — the revert unwinds the test itself with nothing to
    /// catch it. This wrapper restores the boundary the old `builder.deploy(...)` external
    /// call used to provide.
    function deployExternal(BreezeDeployer.Config memory cfg, address dep)
        external
        returns (BreezeDeployer.Deployment memory)
    {
        return BreezeDeployer.deploy(cfg, dep);
    }

    function test_mismatched_regions_and_groups_are_refused() public {
        BreezeDeployer.Config memory cfg = _config();
        cfg.perilGroups = new bytes32[](1);
        cfg.perilGroups[0] = JAPAN_RAIN;

        vm.expectRevert(
            abi.encodeWithSelector(BreezeDeployer.RegionsAndGroupsMismatch.selector, 2, 1)
        );
        this.deployExternal(cfg, deployer);
    }

    function test_a_deployment_with_no_markets_is_refused() public {
        BreezeDeployer.Config memory cfg;
        vm.expectRevert(BreezeDeployer.NoRegions.selector);
        this.deployExternal(cfg, deployer);
    }
}
