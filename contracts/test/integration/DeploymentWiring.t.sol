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
    BreezeDeployer builder;

    address deployer = address(0xDE9);
    address multisig = address(0x115);
    address updater = address(0x0BAC);

    bytes32 constant TOKYO = keccak256("TOKYO_RAINFALL");
    bytes32 constant OSAKA = keccak256("OSAKA_RAINFALL");
    bytes32 constant JAPAN_RAIN = keccak256("PERIL_JAPAN_RAINFALL");

    function setUp() public {
        vm.warp(1_700_000_000);
        builder = new BreezeDeployer();
    }

    function _config() internal pure returns (BreezeDeployer.Config memory cfg) {
        cfg.perpRegions = new bytes32[](2);
        cfg.perpRegions[0] = TOKYO;
        cfg.perpRegions[1] = OSAKA;
        cfg.perilGroups = new bytes32[](2);
        cfg.perilGroups[0] = JAPAN_RAIN;
        cfg.perilGroups[1] = JAPAN_RAIN;
    }

    function _deploy() internal returns (BreezeDeployer.Deployment memory) {
        return builder.deploy(_config(), deployer);
    }

    function _deployGoverned() internal returns (BreezeDeployer.Deployment memory) {
        BreezeDeployer.Config memory cfg = _config();
        cfg.governanceMultisig = multisig;
        cfg.timelockDelay = 2 days;
        cfg.oracleUpdater = updater;
        return builder.deploy(cfg, deployer);
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

    /// The builder is a throwaway contract with no key behind it. If it kept any role, that
    /// role would be permanently unusable and, for `DEFAULT_ADMIN_ROLE`, would mean nobody
    /// could ever grant anything again.
    function test_the_builder_keeps_no_roles() public {
        BreezeDeployer.Deployment memory d = _deploy();
        BreezeAccessControl ac = d.accessControl;
        address b = address(builder);

        assertFalse(ac.hasRole(ac.ADMIN_ROLE(), b), "builder kept ADMIN_ROLE");
        assertFalse(ac.hasRole(ac.DEFAULT_ADMIN_ROLE(), b), "builder kept DEFAULT_ADMIN_ROLE");
        assertFalse(ac.hasRole(ac.PAUSER_ROLE(), b), "builder kept PAUSER_ROLE");
        assertFalse(ac.hasRole(ac.ORACLE_UPDATER_ROLE(), b), "builder kept ORACLE_UPDATER_ROLE");
        assertFalse(ac.hasRole(ac.MARKET_CREATOR_ROLE(), b), "builder kept MARKET_CREATOR_ROLE");
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

        BreezeDeployer.Deployment memory d = builder.deploy(cfg, deployer);
        assertEq(address(d.collateralToken), address(existing));
        assertFalse(d.collateralIsDemoToken, "a demo token was deployed anyway");
    }

    /// The demo token has to be mintable to somebody who holds a key. Minting it to the
    /// throwaway builder would strand the whole supply.
    function test_the_demo_token_supply_reaches_the_deployer() public {
        BreezeDeployer.Deployment memory d = _deploy();
        assertTrue(d.collateralIsDemoToken);
        assertEq(d.collateralToken.balanceOf(deployer), 10_000_000e18);
        assertEq(d.collateralToken.balanceOf(address(builder)), 0);
    }

    function test_mismatched_regions_and_groups_are_refused() public {
        BreezeDeployer.Config memory cfg = _config();
        cfg.perilGroups = new bytes32[](1);
        cfg.perilGroups[0] = JAPAN_RAIN;

        vm.expectRevert(
            abi.encodeWithSelector(BreezeDeployer.RegionsAndGroupsMismatch.selector, 2, 1)
        );
        builder.deploy(cfg, deployer);
    }

    function test_a_deployment_with_no_markets_is_refused() public {
        BreezeDeployer.Config memory cfg;
        vm.expectRevert(BreezeDeployer.NoRegions.selector);
        builder.deploy(cfg, deployer);
    }
}
