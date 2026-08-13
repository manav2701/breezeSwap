/**
 * Register the deployed perpetual markets so the indexer watches them.
 *
 * @dev There is no perp-factory watcher. `index.ts` starts a `perpMarketWatcher` for every
 * row already in `perp_markets`, so a market created on-chain is never discovered on its
 * own and the API returns an empty list until a row exists. The classic side does have a
 * factory watcher, which is why classic markets appear automatically and perps do not.
 *
 * This is the manual equivalent, and it is a stopgap: the real fix is a factory watcher on
 * `BreezePerpFactory` listening for `PerpMarketCreated`, which would remove the need for
 * anyone to run this.
 *
 * Idempotent. Upserts on `contract_address`, so re-running changes nothing.
 *
 *   node scripts/register-perp-markets.mjs
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// From contracts/deployments/coston2.json. Both sit in one peril group, which is the
// configuration `PerilExposureRegistry` exists to bound.
const MARKETS = [
  {
    contract_address: '0x4cad553561c9a37f9db2d33f5cbccb527d4dc0dc',
    chain_id: 114,
    region_id: '0x7eb47a164b9247a5aaf37720353ab36e8c227eeb926e886848e9ca1cf9ca0a77', // TOKYO_RAINFALL
    region_name: 'Tokyo',
    collateral_token: '0x8399c62f02cb1863af24d71db4f6f780f81c9d95',
    status: 'ACTIVE',
    block_number: 33922286,
    tx_hash: 'deploy:DeployProtocol.s.sol',
  },
  {
    contract_address: '0x2247023aaa6de770c5b7c7af91b204553ee3d08a',
    chain_id: 114,
    region_id: '0x13559cceee377e47dfce8045e518d009be09630977ae41aba2482f8dd45b9380', // SEOUL_RAINFALL
    region_name: 'Seoul',
    collateral_token: '0x8399c62f02cb1863af24d71db4f6f780f81c9d95',
    status: 'ACTIVE',
    block_number: 33922286,
    tx_hash: 'deploy:DeployProtocol.s.sol',
  },
]

const { error } = await sb.from('perp_markets').upsert(MARKETS, { onConflict: 'contract_address' })
if (error) throw error

const { data } = await sb.from('perp_markets').select('contract_address,region_name,status')
console.log(`perp_markets rows: ${data?.length ?? 0}`)
for (const m of data ?? []) {
  console.log(`  ${m.contract_address}  ${m.region_name}  ${m.status}`)
}
