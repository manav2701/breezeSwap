import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'
import { router } from './api/router'
import { startFactoryWatcher } from './watchers/factoryWatcher'
import { startMarketWatcher } from './watchers/marketWatcher'
import { startOracleWatcher } from './watchers/oracleWatcher'
import { startAccessControlWatcher } from './watchers/accessControlWatcher'
import { supabase } from './db/client'
import { logger } from './utils/logger'
import { runBackfill } from './scripts/backfill'

async function main() {
  logger.info('BreezeSwap indexer starting...')

  // 1. Start API server with CORS enabled immediately
  const app = express()
  app.use(cors()) // CORS middleware enabled for Vercel / external frontend calls
  app.use(express.json())
  app.use('/api', router)

  const PORT = process.env.PORT || 3001
  app.listen(PORT, () => {
    logger.info(`BreezeSwap Indexer API server listening on port ${PORT}`)
  })

  // 2. Load known markets from DB and start watchers for each
  try {
    const { data: markets } = await supabase.from('markets').select('contract_address')
    for (const market of markets ?? []) {
      startMarketWatcher(market.contract_address)
    }
  } catch (err: any) {
    logger.warn('Failed loading existing markets from DB', { error: err.message })
  }

  // 3. Start live watchers
  startFactoryWatcher()
  startOracleWatcher()
  startAccessControlWatcher()

  // 4. Run historical backfill in background
  runBackfill().catch((err) => {
    logger.warn('Initial backfill warning', { message: err.message })
  })
}

main().catch((err) => {
  logger.error('Fatal indexer error', { err: err.message })
  process.exit(1)
})
