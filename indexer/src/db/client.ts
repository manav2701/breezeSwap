import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const url = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * Fail at startup rather than at every query.
 *
 * Falling back to a placeholder project meant the process booted, reported
 * `status: "ok"` on /health, and then failed every read and write against a
 * host that does not exist. A missing credential is a deployment mistake, and
 * the only useful moment to say so is before the API starts serving.
 */
if (!url || !serviceRoleKey) {
  const missing = [
    !url && 'SUPABASE_URL',
    !serviceRoleKey && 'SUPABASE_SERVICE_ROLE_KEY'
  ].filter(Boolean)
  throw new Error(
    `Missing required environment variable(s): ${missing.join(', ')}. ` +
      'The indexer cannot read or write without a Supabase connection.'
  )
}

export const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false }
})
