/**
 * Report rows belonging to a superseded deployment.
 *
 * Read-only. Markets are keyed only by contract address, with no column naming the factory
 * that created them, so the discriminator available is `block_number`: anything created
 * before the current deployment's first block belongs to an earlier set of contracts.
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

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
  .select('id,contract_address,region_id,region_name,weather_variable,block_number,status')
if (error) throw error

const stale = (markets ?? []).filter((m) => BigInt(m.block_number ?? 0) < CUTOFF)
const keep = (markets ?? []).filter((m) => BigInt(m.block_number ?? 0) >= CUTOFF)

console.log(`cutoff block: ${CUTOFF}`)
console.log(`markets: ${markets?.length ?? 0} total, ${stale.length} stale, ${keep.length} current\n`)

for (const m of stale) {
  console.log(
    `  STALE blk=${m.block_number} ${m.contract_address} ${m.region_name}/${m.weather_variable} ` +
      `region=${String(m.region_id).slice(0, 12)} status=${m.status}`
  )
}
for (const m of keep) {
  console.log(`  KEEP  blk=${m.block_number} ${m.contract_address} ${m.region_name}/${m.weather_variable}`)
}

const staleIds = stale.map((m) => m.id)
if (staleIds.length) {
  const { data: pos } = await sb.from('positions').select('id').in('market_id', staleIds)
  console.log(`\npositions attached to stale markets: ${pos?.length ?? 0}`)
  const { data: setts } = await sb.from('settlements').select('id').in('market_id', staleIds)
  console.log(`settlements attached to stale markets: ${setts?.length ?? 0}`)
}

const { data: wr } = await sb.from('weather_readings').select('region_id').limit(5000)
const ids = [...new Set((wr ?? []).map((r) => r.region_id))]
console.log(`\nweather_readings distinct region ids: ${ids.length}`)
for (const i of ids) console.log('   ', i)
