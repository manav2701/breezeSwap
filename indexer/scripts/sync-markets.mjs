/**
 * Reconcile the markets table against the factory's own list.
 *
 * The factory knows every market it has ever created. The database only knows the ones its
 * watcher happened to be listening for, which is a weaker guarantee: a watcher pointed at a
 * superseded factory address, or one that was down when a market was created, leaves a
 * market that exists on-chain and is invisible in the UI.
 *
 * Reads `allMarkets` from the factory, pulls each market's parameters straight from its own
 * contract, and inserts anything missing. Idempotent, so it is safe to run on a schedule or
 * after any deployment change.
 *
 *   node scripts/sync-markets.mjs
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { createPublicClient, http, keccak256, toHex } from 'viem'

const RPC = process.env.COSTON2_RPC ?? 'https://coston2-api.flare.network/ext/C/rpc'
const FACTORY = process.env.FACTORY_ADDRESS
const CHAIN_ID = 114

if (!FACTORY) {
  console.error('FACTORY_ADDRESS is not set.')
  process.exit(1)
}

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const client = createPublicClient({
  chain: { id: CHAIN_ID, name: 'Coston2', nativeCurrency: { name: 'C2FLR', symbol: 'C2FLR', decimals: 18 }, rpcUrls: { default: { http: [RPC] } } },
  transport: http(RPC),
})

const FACTORY_ABI = [
  { type: 'function', name: 'allMarkets', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'getMarketCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
]

const MARKET_ABI = [
  'regionId() returns (bytes32)',
  'weatherVariable() returns (uint8)',
  'payoffType() returns (uint8)',
  'thresholdLow() returns (int256)',
  'thresholdHigh() returns (int256)',
  'expiryTimestamp() returns (uint256)',
  'collateralToken() returns (address)',
  'status() returns (uint8)',
].map((sig) => {
  const name = sig.slice(0, sig.indexOf('('))
  const out = sig.slice(sig.lastIndexOf('(') + 1, sig.lastIndexOf(')'))
  return { type: 'function', name, stateMutability: 'view', inputs: [], outputs: [{ type: out }] }
})

// Region ids name a data series, so the variable is part of the hash.
const REGIONS = ['TOKYO', 'SEOUL', 'SINGAPORE', 'DUBAI', 'LONDON']
const VARIABLES = ['RAINFALL', 'TEMPERATURE']
const REGION_NAMES = Object.fromEntries(
  REGIONS.flatMap((r) =>
    VARIABLES.map((v) => [keccak256(toHex(`${r}_${v}`)), r.charAt(0) + r.slice(1).toLowerCase()])
  )
)

const read = (address, functionName) =>
  client.readContract({ address, abi: MARKET_ABI, functionName })

const count = await client.readContract({ address: FACTORY, abi: FACTORY_ABI, functionName: 'getMarketCount' })
console.log(`factory ${FACTORY} reports ${count} markets`)

const { data: known } = await sb.from('markets').select('contract_address')
const haveSet = new Set((known ?? []).map((m) => m.contract_address.toLowerCase()))
console.log(`database has ${haveSet.size}`)

let added = 0

for (let i = 0n; i < count; i++) {
  const address = await client.readContract({ address: FACTORY, abi: FACTORY_ABI, functionName: 'allMarkets', args: [i] })
  const lower = address.toLowerCase()
  if (haveSet.has(lower)) continue

  const [regionId, variable, payoff, low, high, expiry, collateral, status] = await Promise.all([
    read(address, 'regionId'),
    read(address, 'weatherVariable'),
    read(address, 'payoffType'),
    read(address, 'thresholdLow'),
    read(address, 'thresholdHigh'),
    read(address, 'expiryTimestamp'),
    read(address, 'collateralToken'),
    read(address, 'status'),
  ])

  const row = {
    contract_address: lower,
    chain_id: CHAIN_ID,
    region_id: regionId,
    region_name: REGION_NAMES[regionId] ?? null,
    weather_variable: Number(variable) === 0 ? 'RAINFALL' : 'TEMPERATURE',
    payoff_type: ['BINARY', 'LINEAR', 'CAPPED'][Number(payoff)] ?? 'CAPPED',
    threshold_low: low.toString(),
    threshold_high: high === 0n ? null : high.toString(),
    expiry_timestamp: new Date(Number(expiry) * 1000).toISOString(),
    collateral_token: collateral.toLowerCase(),
    status: Number(status) === 1 ? 'SETTLED' : 'OPEN',
    // Not in the creation event we missed, so recorded as unknown rather than invented.
    block_number: 0,
    tx_hash: `factory-sync:${lower}`,
  }

  const { error } = await sb.from('markets').insert(row)
  if (error) {
    console.error(`  FAILED ${lower}: ${error.message}`)
    continue
  }
  console.log(`  + ${lower}  ${row.region_name}/${row.weather_variable}  ${row.payoff_type}  ${row.status}`)
  added++
}

console.log(added ? `\nAdded ${added} market(s).` : '\nNothing missing.')
