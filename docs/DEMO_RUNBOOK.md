# BreezeSwap demo runbook

**Nothing runs on localhost.** Frontend on Vercel, indexer on Render, database on Supabase,
contracts on Flare Coston2. Addresses and URLs live in [DEPLOYMENTS.md](./DEPLOYMENTS.md).

| Layer | URL |
|---|---|
| Frontend | https://breeze-swap-web-74qh-coral.vercel.app |
| Indexer API | https://breezeswap.onrender.com/api |
| Database | https://mffnwiyubmhnknvihoqs.supabase.co |

---

## 0. Two things to do before you demo

The contracts, weather data and climatology are all live and correct. The two hosted
services are behind.

### A. Redeploy Vercel. Required.

The live frontend is running an older build. Concretely, on the site right now:

- `/docs` lists the **superseded** contract addresses (`0x699fd810…` factory), so `/create`
  would deploy a market to the dead factory
- Market cards read `40–0mm` instead of `≥ 40mm` for binary markets
- Expired markets read `Open` next to `Expired` instead of `Awaiting settlement`

All three are already fixed in the repo. They ship the moment you redeploy.

```bash
cd sdk && npm run build && cd ../web && vercel --prod
```

Or push to the branch Vercel builds from. `NEXT_PUBLIC_*` values are inlined at build time,
so a redeploy is the only way any of this takes effect.

### B. Update Render's environment variables. Required.

Render still watches the previous generation of contracts. Market *listing* works anyway,
because Render reads the same Supabase rows, but any market created from here on will not be
indexed. Set these in the Render dashboard and restart the service:

```
FACTORY_ADDRESS=0x37E24CcE58A1fCC23e3C88Bdf0Dcc75E19444A5d
POSITION_TOKEN_ADDRESS=0xC84941ba6be5580f5502e5D04a3ACa3d2fE2fa39
MOCK_WEATHER_ORACLE_ADDRESS=0x9c1C9eb2d5Eeede240254AaC84Ca449E647a35E5
ACCESS_CONTROL_ADDRESS=0x055939d4FB50AF8bEd0b0834689B2e19e4f3454e
DEPLOYMENT_BLOCK=33922220
```

`ACCESS_CONTROL_ADDRESS` was never set, which is why the service logs
`access control watcher skipped`. `DEPLOYMENT_BLOCK` matters more than it looks: without it
the indexer only scans the last 500 blocks, about fifteen minutes of Coston2 history.

---

## 1. Five minutes before you present

**Wake Render.** The free tier sleeps, and the first request after idle takes 30 to 60
seconds. A sleeping indexer is why panels sometimes show a "Sample data" chip on first load:
the fetch times out and the UI falls back rather than rendering blank.

```bash
curl -s https://breezeswap.onrender.com/api/health
```

Expect `{"status":"ok","lastIndexedBlock":<recent>,…}`.

**Confirm the weather is real.** This is the check that matters most.

```bash
curl -s https://breezeswap.onrender.com/api/weather/regions
```

Expect **ten** entries: five cities, each twice, once for rainfall and once for temperature.
Two entries per city is the point, not a duplicate.

**Load the site once** so Vercel's edge cache is warm, and confirm `/docs` now shows
`0x37E24CcE…` as the factory. If it still shows `0x699fd810…`, step 0A did not take.

**Check your wallet** is on Coston2 with C2FLR for gas and bUSDT for collateral. The demo
supply of bUSDT is all at `0xE9D7B657…4503`; transfer some if you are demoing from a
different wallet.

---

## 2. Prove it on-chain, live

Ninety seconds, and anyone watching can run these independently. This is the most persuasive
part of the demo.

```bash
export RPC=https://coston2-api.flare.network/ext/C/rpc
```

**The whitepaper's headline number is on-chain.** Figure 3 claims Tokyo August rainfall
exceeded 40mm in 28 of 30 years.

```bash
cast call 0x8e8F99a12Ec5Cec7436E16a70Ce7Ec31f1ECb595 \
  "getStrike(bytes32)((uint32,uint16,bool))" \
  $(cast call 0x8e8F99a12Ec5Cec7436E16a70Ce7Ec31f1ECb595 \
    "strikeKey(bytes32,uint8,bool,uint256,uint8)(bytes32)" \
    $(cast keccak "TOKYO_RAINFALL") 0 false 40000000 8 --rpc-url $RPC) --rpc-url $RPC
```

Returns `(9333, 30, true)`. 93.33%, thirty samples behind it. The sample count travels with
the probability so a consumer can refuse to price against a thin record.

**The loss waterfall is wired, both directions.**

```bash
cast call 0x053d5237A55941bE87cAb5bbB40230AC8Ab644b6 "firstLossFund()(address)" --rpc-url $RPC
cast call 0x053d5237A55941bE87cAb5bbB40230AC8Ab644b6 "juniorTranche()(address)" --rpc-url $RPC
cast call 0x9432b5cE8c6aEc67b7FD04429986fC38149DBF55 "seniorVault()(address)" --rpc-url $RPC
```

Tier 1 and tier 2 resolve and junior points back at senior. A one-way wiring gives you a
tier that exists and is never drawn, which is the silent failure the deployment test exists
to catch.

**Every parameter in the paper is readable.**

```bash
cast call 0x053d5237A55941bE87cAb5bbB40230AC8Ab644b6 "maxUtilizationBps()(uint256)" --rpc-url $RPC        # 8000
cast call 0x9432b5cE8c6aEc67b7FD04429986fC38149DBF55 "exhaustionBps()(uint256)" --rpc-url $RPC            # 2500
cast call 0x4Cad553561C9A37f9db2D33f5CbcCb527D4dC0dc "skewReserveBps()(uint256)" --rpc-url $RPC           # 5000
cast call 0xB41Fd6739FE2fee81F5eA8A3881eaDEc49B72252 "minLeadTime()(uint256)" --rpc-url $RPC              # 3888000 = 45 days
```

All four match. The 45-day lead time is the adverse-selection control: weather forecasts
have real skill to about two weeks, so cover is sold outside that horizon.

**The suite.**

```bash
cd contracts && forge test --summary
```

`569 tests passed, 0 failed` across 54 suites.

---

## 3. The walkthrough

**Beat 1, the problem (1 min).** Show `/`. Weather moves real money and almost nobody can
hedge it. CME lists thirteen United States cities. Crop insurance pays on an adjuster's
timetable. Parametric protocols pay instantly but sell cover in one direction and need an
underwriter to appear first.

**Beat 2, pricing (3 min).** Open a market page and point at the observed-readings chart
with the strike line across it. Then run the `getStrike` call above. On thirty years of
record, Tokyo August rainfall cleared 40mm in 28 of them. **A contract collateralised 50/50
hands one side a 43-point edge.** This is the part most weather protocols skip.

**Beat 3, the trade (3 min).** Create a market through `/create`. Move the strike and cap
and let people watch the payoff curve redraw. Mint a position. The position is an ERC-1155
token, so it is transferable before expiry rather than locked to you.

**Beat 4, settlement (3 min).** Use the market that has already expired. It reads **Awaiting
settlement**: past expiry, nobody has settled it yet. Press **Settle market** from a wallet
with no special role, because settlement is permissionless. Redeem from `/portfolio`. Say
out loud that there was nobody to appeal to and nobody who could have blocked it.

**Beat 5, why it scales (3 min).** None of this is visible in the UI and it is what
separates the project from a weekend build. Run the waterfall and parameter calls above,
then:

```bash
cd contracts && forge test --match-contract ReserveMonteCarloTest -vv
```

The 50% coverage ratio came from sweeping the parameter across three seeds and 900 actions
each under the most aggressive funding the protocol permits, not from intuition.

Then **volunteer the result that argues against your own default**: the sweep shows one
payout shortfall at the shipped 50% and none at 75%, for 0.48 percentage points more trade
rejection. It is in the whitepaper as an open item. Offering the number that costs you
something is worth more than any chart.

**Beat 6, honest limits (1 min).** Say these before you are asked.

- The FTSO and FDC adapters **revert on read**. Settlement is a trusted mock oracle. This is
  the largest gap between the repository and production.
- No mainnet deployment and no audit. Mainnet is gated on one.
- The deployer holds every role. No multisig, no timelock.
- Basis risk is not addressed: an index-settled contract pays against a measured index, not
  your actual loss.

`/docs` already states the first two, so you are not admitting anything the product hides.

---

## 4. Do not demo this

**The fair-odds gate on a classic BINARY market.** `BreezeMarket.settle()` reads a single
oracle reading at expiry, but `fairLongShareBps` comes from climatology that measures
**monthly totals**. So a market can show a confident 93.33% next to a chart reading "1 of 43
readings landed in the payout range". The two numbers describe different quantities.

This is the same defect the whitepaper records as fixed for `WeatherPolicyMarket`, which
records an `Aggregation` and settles on the whole covered period. `BreezeMarket` never got
that fix. It is written up in [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) with the shape of the
repair.

Everything else demos cleanly: the capital stack, the waterfall, weather charts, minting,
settlement, redemption and the perp markets.

---

## 5. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Site slow or panels empty on first load | Render free tier asleep | `curl` the health endpoint and wait 60s |
| Everything shows "Sample data" | Indexer unreachable, so the UI fell back | Check `/api/health` |
| `/docs` shows `0x699fd810…` | Vercel running the old build | Redeploy, step 0A |
| New market does not appear | Render watching the old factory | Update Render env, step 0B |
| `Cannot GET /health` | API is mounted at `/api` | Use `/api/health` |
| Market stuck on "Awaiting settlement" | Nobody has called settle | Press **Settle market**, it is permissionless |
| Market cards say "Unknown Region" | Region id from the superseded scheme | Expected for old markets |
| Wallet has no bUSDT | Demo supply is all at the deployer | Transfer from `0xE9D7B657…4503` |

---

## 6. Checklist

- [ ] Vercel redeployed; `/docs` shows factory `0x37E24CcE…`
- [ ] Render env updated and restarted
- [ ] `/api/health` returns `ok` with a recent block
- [ ] `/api/weather/regions` lists **ten** series
- [ ] `/markets` shows one **Open** market with time left, and one **Awaiting settlement**
- [ ] Market detail page shows real readings with **no** "Sample data" chip
- [ ] Wallet on Coston2 with C2FLR and bUSDT
- [ ] You can state the four limits in Beat 6 without hesitating
