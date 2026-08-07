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
import { getPublicClient } from './utils/chainClient'
import { runBackfill } from './scripts/backfill'
import { errorMessage } from './utils/errors'

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
  logger.info('BreezeSwap indexer starting (Chain ID: 114 — Coston2)...')

  // 1. Start API server with CORS enabled immediately
  const app = express()
  app.use(cors())
  app.use(express.json())
  app.use('/api', router)

  // Express 4 answers an unhandled error with a bare stack trace in the body and
  // nothing in the logs. Anything that gets past a handler's own try/catch is
  // logged here and answered as JSON, like every other failure.
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled API error', { err: errorMessage(err) })
    if (res.headersSent) return
    res.status(500).json({ error: 'Internal error' })
  })

  const PORT = process.env.PORT || 3001
  app.listen(PORT, () => {
    logger.info(`BreezeSwap Indexer API server listening on port ${PORT}`)
  })

  // 2. Load known Classic and Perp markets from DB for both chains
  let activePerpMarkets: { address: string; chainId: number }[] = []

  // A failure here means no watcher is running for any existing market, so the
  // indexer would sit there looking healthy while recording nothing. Supabase
  // reports query failures in `error` rather than by throwing, so both paths
  // have to be checked.
  const { data: markets, error: marketsError } = await supabase
    .from('markets')
    .select('contract_address, chain_id')
  if (marketsError) {
    throw new Error(`Failed loading existing markets: ${marketsError.message}`)
  }
  for (const market of markets ?? []) {
    startMarketWatcher(market.contract_address)
  }

  const { data: perps, error: perpsError } = await supabase
    .from('perp_markets')
    .select('contract_address, chain_id')
  if (perpsError) {
    throw new Error(`Failed loading existing perp markets: ${perpsError.message}`)
  }
  for (const perp of perps ?? []) {
    const chainId = perp.chain_id || 114
    activePerpMarkets.push({ address: perp.contract_address, chainId })
    startPerpMarketWatcher(perp.contract_address)
  }

  // 3. Start live watchers for both chains
  startFactoryWatcher()
  startOracleWatcher()
  startAccessControlWatcher()

  // 4. Mark price 60-second snapshot job
  setInterval(async () => {
    for (const item of activePerpMarkets) {
      try {
        const client = getPublicClient(item.chainId)
        const markPrice = await client.readContract({
          address: item.address as `0x${string}`,
          abi: PerpMarketABI,
          functionName: 'getMarkPrice'
        })
        const { error } = await supabase.from('mark_price_history').insert({
          market_address: item.address.toLowerCase(),
          mark_price: markPrice.toString(),
          snapshotted_at: new Date().toISOString()
        })
        if (error) throw new Error(`mark_price_history insert failed: ${error.message}`)
      } catch (err) {
        logger.warn('Mark price snapshot failed', { market: item.address, error: errorMessage(err) })
      }
    }
  }, 60_000)

  // 5. Run historical backfill in background
  runBackfill().catch((err) => {
    logger.error('Initial backfill failed', { err: errorMessage(err) })
  })
}

// A rejection that reaches this point escaped a watcher callback or a timer.
// Node's default is to print a truncated warning and, since v15, kill the
// process — neither of which produces a log line that identifies the indexer as
// the source. Log it in the same structured shape as everything else first.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { err: errorMessage(reason) })
})

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception, exiting', { err: errorMessage(err) })
  process.exit(1)
})

main().catch((err) => {
  logger.error('Fatal indexer error', { err: errorMessage(err) })
  process.exit(1)
})
