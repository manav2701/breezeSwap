/**
 * Migration runner.
 *
 * Two things this fixes over the previous version, both of which mattered in
 * production:
 *
 *  1. It applied ONLY `0001_init.sql`. Migrations 0002–0005 were never run, so
 *     a deployed database had no `perp_markets`, `perp_positions`,
 *     `funding_history` or `fee_events` tables and every perpetual and fee API
 *     returned a 500.
 *
 *  2. `0001_init.sql` opens with `DROP TABLE IF EXISTS ... CASCADE`. Running
 *     the documented migrate command against a live database therefore deleted
 *     every indexed market, position, settlement and weather reading. It is now
 *     treated as a bootstrap that runs only when the schema is empty.
 *
 * Applied migrations are recorded in `schema_migrations`, so re-running is a
 * no-op and deploys can call this safely on every boot.
 */

const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

// The indexer keeps its own .env; the monorepo root holds shared credentials.
require('dotenv').config({ path: path.join(__dirname, '../.env') })
require('dotenv').config({ path: path.join(__dirname, '../../.env') })

const MIGRATIONS_DIR = path.join(__dirname, '../db/migrations')

/** `0001` is a destructive bootstrap — see the note above. */
const BOOTSTRAP = '0001_init.sql'

async function ensureLedger(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)
}

async function appliedMigrations(client) {
  const { rows } = await client.query('SELECT name FROM schema_migrations')
  return new Set(rows.map((r) => r.name))
}

/**
 * True when the database has no BreezeSwap tables yet. Used to decide whether
 * the destructive bootstrap is safe to run.
 */
async function isEmptySchema(client) {
  const { rows } = await client.query(`
    SELECT COUNT(*)::int AS n
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('markets', 'positions', 'settlements', 'weather_readings')
  `)
  return rows[0].n === 0
}

/**
 * TLS settings for the migration connection.
 *
 * This connection carries the whole schema and runs with the database owner's
 * credentials, and it previously used `rejectUnauthorized: false` — an encrypted
 * channel to whoever answers, with no proof it is the intended host.
 *
 * Supply the provider's CA in `DATABASE_CA_CERT` (Supabase publishes it under
 * Project Settings → Database → SSL configuration) to verify the peer. Verified
 * against the system trust store instead when `DATABASE_SSL_STRICT=true`.
 * Without either, the old unverified behaviour is kept and announced, so an
 * existing deploy keeps working but nobody assumes the channel is authenticated.
 */
function sslConfig() {
  const ca = process.env.DATABASE_CA_CERT
  if (ca) return { ca, rejectUnauthorized: true }
  if (process.env.DATABASE_SSL_STRICT === 'true') return { rejectUnauthorized: true }

  console.warn(
    'WARNING: connecting to the database without verifying its certificate. ' +
      'Set DATABASE_CA_CERT to the provider CA (or DATABASE_SSL_STRICT=true) to authenticate the host.'
  )
  return { rejectUnauthorized: false }
}

async function migrate() {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    console.error('DATABASE_URL is required in the environment.')
    process.exit(1)
  }

  const force = process.argv.includes('--force-bootstrap')

  const client = new Client({ connectionString: dbUrl, ssl: sslConfig() })
  await client.connect()

  try {
    await ensureLedger(client)

    const done = await appliedMigrations(client)
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort()

    // A database created before this runner existed has tables but no ledger
    // rows. Record the bootstrap as applied rather than replaying its DROPs.
    if (files.includes(BOOTSTRAP) && !done.has(BOOTSTRAP) && !(await isEmptySchema(client)) && !force) {
      console.log(`~ ${BOOTSTRAP} skipped — schema already exists (it would DROP live tables).`)
      console.log('  Pass --force-bootstrap only to rebuild an environment from scratch.')
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [
        BOOTSTRAP,
      ])
      done.add(BOOTSTRAP)
    }

    let applied = 0
    for (const file of files) {
      if (done.has(file)) {
        console.log(`= ${file} already applied`)
        continue
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
      console.log(`> ${file} applying…`)

      // Each migration is its own transaction, so a failure halfway through the
      // set leaves the ledger consistent with what actually landed.
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
        await client.query('COMMIT')
        applied++
      } catch (err) {
        await client.query('ROLLBACK')
        throw new Error(`${file} failed: ${err.message}`)
      }
    }

    console.log(applied === 0 ? 'Schema already up to date.' : `Applied ${applied} migration(s).`)

    const { rows } = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name
    `)
    console.log('Tables:', rows.map((r) => r.table_name).join(', '))
  } catch (err) {
    console.error('Migration failed:', err.message)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

migrate()
