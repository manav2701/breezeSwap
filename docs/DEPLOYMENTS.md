# BreezeSwap deployments

The canonical record of where BreezeSwap actually runs. **Nothing runs on localhost.**
Anyone writing instructions, debugging a page, or checking an address should start here.

---

## Hosted services

| Layer | Provider | URL |
|---|---|---|
| Frontend | Vercel | https://breeze-swap-web-74qh-coral.vercel.app |
| Indexer / API | Render | https://breezeswap.onrender.com |
| Database | Supabase | https://mffnwiyubmhnknvihoqs.supabase.co |
| Chain | Flare Coston2 | https://coston2-api.flare.network/ext/C/rpc |
| Explorer | Blockscout | https://coston2-explorer.flare.network |

The API is mounted at `/api`, so health is
[`/api/health`](https://breezeswap.onrender.com/api/health), not `/health`.

**Render free tier sleeps after inactivity.** The first request after an idle period can take
30 to 60 seconds while the service wakes. Hit `/api/health` a few minutes before a demo so
the frontend is not waiting on a cold start. A sleeping indexer is also why panels sometimes
show a "Sample data" chip on first load: the fetch fails, and the UI falls back rather than
rendering blank.

**Vercel inlines `NEXT_PUBLIC_*` at build time.** Changing one in the dashboard does nothing
until you redeploy. The frontend must have:

```
NEXT_PUBLIC_INDEXER_URL=https://breezeswap.onrender.com
NEXT_PUBLIC_COSTON2_RPC=https://coston2-api.flare.network/ext/C/rpc
NEXT_PUBLIC_CHAIN_ID=114
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<walletconnect project id>
```

Render must have `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `COSTON2_RPC`
and the contract addresses below. Secrets live in the provider dashboards and in the local
`.env` files; they are deliberately not repeated here.

---

## Contracts, Coston2 (chain 114)

Deployed by `script/DeployProtocol.s.sol`, first block **33922220**. Machine-readable copy
is `contracts/deployments/coston2.json`; the SDK carries the same set in
`sdk/src/constants.ts` and the two must not drift.

| Contract | Address |
|---|---|
| BreezeAccessControl | `0x055939d4FB50AF8bEd0b0834689B2e19e4f3454e` |
| CollateralToken (bUSDT, demo) | `0x8399c62f02cb1863Af24D71Db4f6F780F81c9d95` |
| MockWeatherOracle | `0x9c1C9eb2d5Eeede240254AaC84Ca449E647a35E5` |
| StrikeProbabilityOracle | `0x8e8F99a12Ec5Cec7436E16a70Ce7Ec31f1ECb595` |
| BreezeLiquidityVault (senior) | `0x053d5237A55941bE87cAb5bbB40230AC8Ab644b6` |
| JuniorTranche (tier 2) | `0x9432b5cE8c6aEc67b7FD04429986fC38149DBF55` |
| FirstLossReserve (tier 1) | `0x7abF64b4B0bED8c151F403f8Ae3efA6f8AD22B4E` |
| PerilExposureRegistry | `0xa8A1A17642226203397e2cc7aB336f814c0a4Ef4` |
| WeatherPolicyMarket | `0xB41Fd6739FE2fee81F5eA8A3881eaDEc49B72252` |
| BreezeMarketFactory (classic) | `0x37E24CcE58A1fCC23e3C88Bdf0Dcc75E19444A5d` |
| PositionToken (ERC-1155) | `0xC84941ba6be5580f5502e5D04a3ACa3d2fE2fa39` |
| BreezePerpFactory | `0x82df4B98D83A65Af9CA85ec489bcC9d3742D36B7` |
| Tokyo perp market | `0x4Cad553561C9A37f9db2D33f5CbcCb527D4dC0dc` |
| Seoul perp market | `0x2247023AAa6dE770C5b7c7aF91B204553ee3d08A` |
| InsuranceFund | `0x40593E16e34Df12537bb0c07dded55F4a0355198` |
| FeeConfig | `0xc284039C88A9B5B0Cb1D7D149DBa017BF1935052` |
| ProtocolTreasury | `0x7eFC570bFDA83e94c7a65Fc23B339f59097dd1bB` |

### Demo markets

| Market | Type | Address |
|---|---|---|
| Tokyo rainfall, at or above 40mm | BINARY | `0x822e063702bb814aa140c827b414becded8dae71` |
| Tokyo rainfall, 50 to 100mm | CAPPED | see `/markets` |

### Deployer

`0xE9D7B6576581AD0A712B5DBC83cD27378c494503`

Holds `ADMIN_ROLE`, `PAUSER_ROLE` and `ORACLE_UPDATER_ROLE`, and the entire 10,000,000 bUSDT
demo supply. No governance multisig is configured, which the deploy script announces on every
run. This is a testnet deployment; say so if asked rather than implying otherwise.

Top up at https://faucet.flare.network/coston2 (about 100 C2FLR per day).

---

## Data on-chain

- **440 weather readings.** 5 cities x 2 variables x 44 days of real Open-Meteo observations,
  covering roughly 12 July to 25 August 2026.
- **1,080 strike probabilities and 60 climatology levels.** Thirty years of monthly totals per
  region, month, threshold and direction.

Region ids are `keccak256("<REGION>_<VARIABLE>")`, for example
`keccak256("TOKYO_RAINFALL")`. The variable is part of the id because the oracle keys
readings on region alone, so a city-only id makes a city's rainfall and temperature markets
read the same slot.

---

## Superseded, do not use

The pre-waterfall deployment. It had no vault, junior tranche, first-loss reserve, peril
registry, policy market or pricing oracle, and its markets used a city-only region id, so
they cannot settle correctly. Kept only so an old link resolves to an explanation.

| Contract | Address |
|---|---|
| BreezeAccessControl | `0x3788420AB4Ef4D2c2dd22c151fd6CB93d2543853` |
| MockUSDT | `0x639b6b2a0195271557e543F51c0FA417265B2FAC` |
| MockWeatherOracle | `0x17EEF37738887b2a6f7149aA3af047D6144D6139` |
| BreezeMarketFactory | `0x699fd810EC7C0620a9BF01Cd73356770Ae0aBbaf` |
| BreezePerpFactory | `0x05e309f0434942BDfa0D961E25FaCc4483BABe46` |

An even older generation (`0xe8969c98…` factory, `0x376b26e7…` oracle) was what
`indexer/.env` pointed at while the frontend read the addresses above. That split is fixed;
if anything ever disagrees again, this file is the arbiter.

---

## Redeploying

Only if you are standing up a fresh stack. Full detail in `DEMO_RUNBOOK.md` §6.

Pin the gas price. Forge estimates against a padded figure and will drain the wallet:
the same deployment cost 21.9 C2FLR pinned at 700 gwei against a 41 C2FLR estimate.

After redeploying, four places must be updated together or the stack silently splits again:

1. `contracts/deployments/coston2.json`
2. `sdk/src/constants.ts`, then `cd sdk && npm run build`
3. Render environment variables (`FACTORY_ADDRESS`, `POSITION_TOKEN_ADDRESS`,
   `MOCK_WEATHER_ORACLE_ADDRESS`, `ACCESS_CONTROL_ADDRESS`, `DEPLOYMENT_BLOCK`)
4. Vercel redeploy, because `NEXT_PUBLIC_*` is inlined at build time
