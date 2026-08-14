/**
 * Regenerate the SDK's ABIs from the compiled Foundry artifacts.
 *
 * These files used to be hand-curated subsets, kept in sync by remembering to. They were
 * not in sync: `BreezePerpMarket` carried 23 of the contract's 74 functions, and one of the
 * missing ones was `collateralToken`, which `openPerpPosition` reads to find the token it
 * has to approve. Opening any perpetual position failed with
 * `Function "collateralToken" not found on ABI`.
 *
 * A curated ABI is a copy of an interface that changes without it, so it is only ever
 * correct by luck. Generating from the artifact removes the copy. The indexer has done this
 * since the beginning; the SDK was the one that did not.
 *
 * Run after `forge build`:
 *   npm run sync-abis
 */
const fs = require('fs')
const path = require('path')

const CONTRACTS = [
  ['BreezeMarketFactory', 'BreezeMarketFactory.sol/BreezeMarketFactory.json'],
  ['BreezeMarket', 'BreezeMarket.sol/BreezeMarket.json'],
  ['BreezePerpMarket', 'BreezePerpMarket.sol/BreezePerpMarket.json'],
  ['BreezePerpFactory', 'BreezePerpFactory.sol/BreezePerpFactory.json'],
  ['PositionToken', 'PositionToken.sol/PositionToken.json'],
  ['MockWeatherOracle', 'MockWeatherOracle.sol/MockWeatherOracle.json'],
  ['BreezeAccessControl', 'BreezeAccessControl.sol/BreezeAccessControl.json'],
  ['FeeConfig', 'FeeConfig.sol/FeeConfig.json'],
  ['StrikeProbabilityOracle', 'StrikeProbabilityOracle.sol/StrikeProbabilityOracle.json'],
  ['BreezeLiquidityVault', 'BreezeLiquidityVault.sol/BreezeLiquidityVault.json'],
  ['WeatherPolicyMarket', 'WeatherPolicyMarket.sol/WeatherPolicyMarket.json'],
]

const outDir = path.join(__dirname, '../../contracts/out')
const abisDir = path.join(__dirname, '../src/abis')

if (!fs.existsSync(abisDir)) fs.mkdirSync(abisDir, { recursive: true })

let synced = 0
let missing = 0

for (const [name, file] of CONTRACTS) {
  const artifactPath = path.join(outDir, file)
  if (!fs.existsSync(artifactPath)) {
    console.error(`  MISSING artifact for ${name}. Run \`forge build\` in contracts/ first.`)
    missing++
    continue
  }

  const { abi } = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
  const target = path.join(abisDir, `${name}.json`)

  const before = fs.existsSync(target)
    ? JSON.parse(fs.readFileSync(target, 'utf8')).filter((i) => i.type === 'function').length
    : 0
  const after = abi.filter((i) => i.type === 'function').length

  fs.writeFileSync(target, JSON.stringify(abi, null, 2) + '\n')
  const delta = after - before
  console.log(`  ${name}: ${after} functions${delta ? ` (${delta > 0 ? '+' : ''}${delta})` : ''}`)
  synced++
}

console.log(`\nSynced ${synced} ABIs${missing ? `, ${missing} missing` : ''}.`)
if (missing) process.exit(1)
