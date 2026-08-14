# BreezeSwap — DoraHacks submission

Paste-ready copy for the Flare Summer Signal submission form.

---

**Project name:** BreezeSwap

**Bounty:** Bounty 1 — Interoperable Asset Products

**Links**
- Live app: https://breeze-swap-web-74qh-coral.vercel.app
- GitHub: https://github.com/manav2701/breezeSwap
- Whitepaper: https://breeze-swap-web-74qh-coral.vercel.app/whitepaper

---

BreezeSwap is a weather derivatives protocol on Flare. Anyone can hedge or trade rainfall
and temperature outcomes, priced from a 30-year climate record and settled automatically
from an oracle reading, with no claim, no adjuster and no counterparty to find.

**The problem.** Weather decides whether a huge number of people earn a living, and almost
none of them can insure against it. In 2025 there was **$424bn of natural catastrophe loss
with no insurance behind it**, and **60% of the world's crop production is uninsured**
(Swiss Re). The instruments that hedge weather properly settle against **thirteen US
cities**. That is not a map of where weather risk lives, it is a map of where the paperwork
was easiest. Traditional cover pays only after an assessor visits and agrees, which takes
months — a farmer who cannot buy seed this season does not need the money next season.

**The solution.** BreezeSwap replaces the assessor with a formula and the counterparty with
capital. You agree in advance on something measurable — rainfall in Tokyo this month, below
40mm — and if the measurement lands there, you are paid. Three products share one balance
sheet: **classic markets** (fixed-expiry ERC-1155 positions, transferable before expiry),
**perpetual markets** (a virtual AMM quoting both sides continuously, so a hedger never
waits for a counterparty), and **policy markets** (one-sided cover underwritten straight
from pooled LP capital). Settlement is permissionless: anyone can trigger it, nobody can
block it.

**Target user.** Farmers and agricultural cooperatives hedging a season; energy and solar
operators whose revenue tracks temperature; ski resorts, logistics and outdoor events; and
LPs who want a yield source genuinely uncorrelated with crypto, because rainfall in Japan
has nothing to do with the market.

**What makes it different.** Most on-chain weather attempts are an oracle and an
if-statement, which fails twice. First, equal collateral silently prices every outcome as a
coin flip: Tokyo August rainfall exceeded 40mm in **28 of the last 30 years**, so a 50/50
contract hands one side a 43-point edge. BreezeSwap publishes **1,080 strike probabilities
computed from 30 years of Open-Meteo history** on-chain, and gates markets against them.
Second, weather demand is one-directional — everyone in a region wants drought cover in the
same month — so a matching market clears roughly one hedger in four. Pooling capital removes
that constraint entirely. Because weather risk is severely correlated, that pool is
protected by a **three-tier loss waterfall** (protocol-owned first-loss reserve → junior
tranche → senior ERC-4626 vault) and a **peril exposure registry** that caps exposure across
correlated markets, so one storm cannot drain the protocol through several markets at once.

**How it uses Flare.** BreezeSwap is deployed on **Flare Testnet Coston2** (chainId 114),
17 contracts, gas in C2FLR. It is built directly on the thesis behind Flare's **Letter of
Intent with Kweather (14 July 2026)** to publish meteorological data through **FTSO**,
explicitly to enable parametric climate insurance and weather derivatives — which is exactly
this product. `FtsoWeatherAdapter` and `FdcWeatherAdapter` are written against the same
`IWeatherOracle` interface the protocol consumes, and **revert rather than returning
invented data** while the Kweather feed is not yet live; `test_MarketSwapsOracleToFtsoAdapterGracefully`
proves a live market can move from the seeded oracle to the adapter without a rewrite.
`FAssetsCollateralAdapter` lets **FXRP** back a weather position, so XRP holders can hedge
without selling into a stablecoin. Today settlement runs on an oracle seeded with **440 real
Open-Meteo readings** across five cities; the swap-in point is one address.

**What was newly built during the program.** The entire capital stack — `BreezeLiquidityVault`
(ERC-4626 senior tranche), `JuniorTranche`, `FirstLossReserve` and the waterfall between
them; `PerilExposureRegistry` for correlated-exposure caps; `StrikeProbabilityOracle` plus
the climatology pipeline that turns 30 years of history into 1,080 on-chain strikes;
`WeatherPolicyMarket` for one-sided cover. We also **made the protocol deployable at all**:
two contracts exceeded the EIP-170 bytecode limit (one at 133,883 bytes against a 24,576
limit) and could never have been deployed to any chain — Foundry does not enforce the limit
in tests, so a green suite was running against a deployment path that could not execute.
Both are fixed and the limit is now asserted by a test. **569 tests pass**, across unit,
fuzz (10,000 runs), invariant (256×64) and adversarial suites, with 13,700 lines of tests
against 6,100 lines of contracts.

**Diagrams.** The architecture diagram shows the three products sharing one balance sheet:
two oracles feed all three markets, and the policy and perpetual markets clear against a
pooled vault protected by the loss waterfall. The clearing chart is the reason the protocol
is built this way: as weather demand becomes one-sided, a matching venue clears a collapsing
fraction of hedgers (25% at a mild 80% skew) while a pooled venue clears everyone until
capital binds, then degrades smoothly instead of emptying.

**Deployed on Flare Coston2** ([explorer](https://coston2-explorer.flare.network))

| Contract | Address |
|---|---|
| BreezeMarketFactory | `0x37E24CcE58A1fCC23e3C88Bdf0Dcc75E19444A5d` |
| BreezeLiquidityVault (senior) | `0x053d5237A55941bE87cAb5bbB40230AC8Ab644b6` |
| JuniorTranche | `0x9432b5cE8c6aEc67b7FD04429986fC38149DBF55` |
| FirstLossReserve | `0x7abF64b4B0bED8c151F403f8Ae3efA6f8AD22B4E` |
| PerilExposureRegistry | `0xa8A1A17642226203397e2cc7aB336f814c0a4Ef4` |
| StrikeProbabilityOracle | `0x8e8F99a12Ec5Cec7436E16a70Ce7Ec31f1ECb595` |
| WeatherPolicyMarket | `0xB41Fd6739FE2fee81F5eA8A3881eaDEc49B72252` |
| BreezePerpFactory | `0x82df4B98D83A65Af9CA85ec489bcC9d3742D36B7` |
| MockWeatherOracle | `0x9c1C9eb2d5Eeede240254AaC84Ca449E647a35E5` |
| PositionToken (ERC-1155) | `0xC84941ba6be5580f5502e5D04a3ACa3d2fE2fa39` |

Live markets are tradeable now, with real weather charts and a market past expiry that
anyone can settle. Full list in `contracts/deployments/coston2.json`.

**Honest limitations.** Coston2 only, demo collateral, no audit. The FTSO and FDC weather
adapters are deliberate stubs until the Kweather feed exists. Our own Monte Carlo sweep
argues one shipped parameter should be higher, and that is in the whitepaper rather than
left for someone to find. All of it is in `docs/KNOWN_ISSUES.md`.

**Next steps.** Wire the Kweather FTSO feed the moment it publishes — one adapter, already
written and tested. Complete FXRP collateral end-to-end against live FTSOv2 pricing. A
security audit, then a Flare mainnet deployment gated on it (`DeployMainnet.s.sol` already
refuses to run without real collateral and a governance multisig). Then pilot conversations
with an agricultural cooperative, because the product only matters if the farmer it was
built for can actually reach it.
