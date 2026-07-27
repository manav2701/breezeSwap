import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'
import { router } from './api/router'
import { startFactoryWatcher } from './watchers/factoryWatcher'
import { startMarketWatcher } from './watchers/marketWatcher'
import { startOracleWatcher } from './watchers/oracleWatcher'
import { startAccessControlWatcher } from './watchers/accessControlWatcher'
import { startPerpMarketWatcher } from './watchers/perpMarketWatcher'
import { supabase } from './db/client'
import { logger } from './utils/logger'
import { publicClient } from './utils/chainClient'
import { runBackfill } from './scripts/backfill'

const PerpMarketABI = [
  {
    inputs: [],
    name: "getMarkPrice",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  }
] as const

async function main() {
  logger.info('BreezeSwap indexer starting...')

  // 1. Start API server with CORS enabled immediately
  const app = express()
  app.use(cors())
  app.use(express.json())
  app.use('/api', router)

  const PORT = process.env.PORT || 3001
  app.listen(PORT, () => {
    logger.info(`BreezeSwap Indexer API server listening on port ${PORT}`)
  })

  // 2. Load known Classic and Perp markets from DB
  let activePerpMarkets: string[] = []

  try {
    const { data: markets } = await supabase.from('markets').select('contract_address')
    for (const market of markets ?? []) {
      startMarketWatcher(market.contract_address)
    }

    const { data: perps } = await supabase.from('perp_markets').select('contract_address')
    for (const perp of perps ?? []) {
      activePerpMarkets.push(perp.contract_address)
      startPerpMarketWatcher(perp.contract_address)
    }
  } catch (err: any) {
    logger.warn('Failed loading existing markets from DB', { error: err.message })
  }

  // 3. Start live watchers
  startFactoryWatcher()
  startOracleWatcher()
  startAccessControlWatcher()

  // 4. Mark price 60-second snapshot job
  setInterval(async () => {
    for (const market of activePerpMarkets) {
      try {
        const markPrice = await publicClient.readContract({
          address: market as `0x${string}`,
          abi: PerpMarketABI,
          functionName: 'getMarkPrice'
        })
        await supabase.from('mark_price_history').insert({
          market_address: market.toLowerCase(),
          mark_price: markPrice.toString(),
          snapshotted_at: new Date().toISOString()
        })
      } catch (err: any) {
        logger.warn('Mark price snapshot failed', { market, error: err.message })
      }
    }
  }, 60_000)

  // 5. Run historical backfill in background
  runBackfill().catch((err) => {
    logger.warn('Initial backfill warning', { message: err.message })
  })
}

main().catch((err) => {
  logger.error('Fatal indexer error', { err: err.message })
  process.exit(1)
})
