/**
 * Delete rows belonging to a superseded deployment.
 *
 * Dry run by default. Pass `--confirm` to actually delete.
 *
 * Markets carry no column naming the factory that created them, so `block_number` is the
 * discriminator: anything created before the current deployment's first block came from an
 * earlier set of contracts. Those markets are not merely old. They were created under a
 * region id derived from the city name alone, so a city's rainfall and temperature markets
 * shared one oracle slot and cannot settle correctly, and the indexer no longer watches the
 * factory that made them.
 *
 * Dependants are removed first so nothing is orphaned by a foreign key.
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const CONFIRM = process.argv.includes('--confirm')
const CUTOFF = BigInt(process.env.DEPLOYMENT_BLOCK ?? '0')

if (CUTOFF === 0n) {
  console.error('DEPLOYMENT_BLOCK is unset; refusing to guess which rows are stale.')
  process.exit(1)
}

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const { data: markets, error } = await sb
  .from('markets')
  .select('id,contract_address,region_name,weather_variable,block_number')
if (error) throw error

const stale = (markets ?? []).filter((m) => BigInt(m.block_number ?? 0) < CUTOFF)

if (stale.length === 0) {
  console.log('Nothing stale. Database already matches the current deployment.')
  process.exit(0)
}

console.log(`${stale.length} stale market(s) below block ${CUTOFF}:`)
for (const m of stale) {
  console.log(`  ${m.contract_address}  blk=${m.block_number}  ${m.region_name}/${m.weather_variable}`)
}

// Children reference `markets.contract_address`, not the surrogate `id`. Querying by
// `market_id` returns nothing and makes a market with dependants look safe to delete, which
// then fails on the foreign key half way through.
const ids = stale.map((m) => m.id)
const addrs = stale.map((m) => m.contract_address)

const { data: pos } = await sb.from('positions').select('id').in('market_address', addrs)
const { data: setts } = await sb.from('settlements').select('id').in('market_address', addrs)
console.log(`\ndependants: ${pos?.length ?? 0} position(s), ${setts?.length ?? 0} settlement(s)`)

if (!CONFIRM) {
  console.log('\nDry run. Re-run with --confirm to delete.')
  process.exit(0)
}

// Children before parents.
if (pos?.length) {
  const { error: e } = await sb.from('positions').delete().in('market_address', addrs)
  if (e) throw e
  console.log(`deleted ${pos.length} position(s)`)
}
if (setts?.length) {
  const { error: e } = await sb.from('settlements').delete().in('market_address', addrs)
  if (e) throw e
  console.log(`deleted ${setts.length} settlement(s)`)
}

const { error: e } = await sb.from('markets').delete().in('id', ids)
if (e) throw e
console.log(`deleted ${ids.length} market(s)`)

const { data: after } = await sb.from('markets').select('contract_address')
console.log(`\nmarkets remaining: ${after?.length ?? 0}`)
