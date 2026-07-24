# BreezeSwap — Weather Derivatives Protocol on Flare

> Parametric weather derivatives protocol letting anyone hedge or speculate on real weather outcomes with instant, automatic, tamper-proof payouts on Flare Network.

---

## Live Coston2 Testnet Deployments

| Contract | Address on Coston2 (Chain ID 114) | Explorer Link |
|---|---|---|
| **BreezeMarketFactory** | `0xe8969c988D4CF26AA9A98B8a95fF93D14E80615A` | [View on Explorer](https://coston2-explorer.flare.network/address/0xe8969c988D4CF26AA9A98B8a95fF93D14E80615A) |
| **PositionToken (ERC1155)** | `0x611653F531D6c584801449548728290EbE298d28` | [View on Explorer](https://coston2-explorer.flare.network/address/0x611653F531D6c584801449548728290EbE298d28) |
| **MockWeatherOracle** | `0x376b26e7C91AE050E48Aa1Ca7233625EA258A3ab` | [View on Explorer](https://coston2-explorer.flare.network/address/0x376b26e7C91AE050E48Aa1Ca7233625EA258A3ab) |
| **FtsoWeatherAdapter** | `0x112E2Cd1Bd31874E2b24Eb7c75A3bA1408c67b5A` | [View on Explorer](https://coston2-explorer.flare.network/address/0x112E2Cd1Bd31874E2b24Eb7c75A3bA1408c67b5A) |
| **FdcWeatherAdapter** | `0xA2EF417a007A6E199F757809A7B56Db45c54861b` | [View on Explorer](https://coston2-explorer.flare.network/address/0xA2EF417a007A6E199F757809A7B56Db45c54861b) |
| **FAssetsCollateralAdapter** | `0xf84c832Ca8fdfb9FFCE433A359d959ED6f37Bc7B` | [View on Explorer](https://coston2-explorer.flare.network/address/0xf84c832Ca8fdfb9FFCE433A359d959ED6f37Bc7B) |
| **MockUSDT (mUSDT)** | `0x61bB87822841428249405Cc77bcBF004C217fc64` | [View on Explorer](https://coston2-explorer.flare.network/address/0x61bB87822841428249405Cc77bcBF004C217fc64) |
| **Demo Market Instance** | `0x04B7Cf428c39a33F35fE557B7f9538916E3C6576` | [View on Explorer](https://coston2-explorer.flare.network/address/0x04B7Cf428c39a33F35fE557B7f9538916E3C6576) |

---

## Test Summary

- **Total Unit & Integration Tests:** 44 Passing (100% Pass Rate)
- **Payoff Fuzzing:** 10,000 Fuzz Iterations Passed (`PayoffCalculatorFuzzTest`)
- **Protocol Code Coverage:** 95.14% Line Coverage
- **Live On-Chain Proof:** Live Coston2 transactions executed (`coston2-demo-txs.json`)

---

## How to Run Weather Seeder (Real Open-Meteo Data)

```bash
cd weather-seed
pnpm install
pnpm seed
```

This pulls real historical and forecast rainfall and temperature data for 5 regions (Tokyo, Seoul, Singapore, Dubai, London) from Open-Meteo API and generates `weather-seed/seed-log.json`.

---

## Project Structure

```
breezeswap/
  contracts/            # Foundry Solidity smart contracts
  weather-seed/         # Open-Meteo weather data seeder script
  indexer/              # Node.js event watcher service (Render ready)
  web/                  # Next.js App Router web application
  docs/                 # Architecture, Integration & Security documentation
```
