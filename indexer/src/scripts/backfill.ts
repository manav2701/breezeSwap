import dotenv from 'dotenv'
dotenv.config()

import { publicClient } from '../utils/chainClient'
import { supabase } from '../db/client'
import { logger } from '../utils/logger'
import { withRetry } from '../utils/retry'
import { assertWritten, errorMessage } from '../utils/errors'
import { handleMarketCreated } from '../watchers/factoryWatcher'
import { handlePositionMinted, handleMarketSettled, handlePositionRedeemed } from '../watchers/marketWatcher'
import { getRegionName } from '../utils/regionNames'

import FactoryABI from '../abis/BreezeMarketFactory.json'
import MarketABI from '../abis/BreezeMarket.json'
import OracleABI from '../abis/MockWeatherOracle.json'

const FACTORY_ADDRESS = (process.env.FACTORY_ADDRESS || '0xe8969c988D4CF26AA9A98B8a95fF93D14E80615A') as `0x${string}`
const ORACLE_ADDRESS = (process.env.MOCK_WEATHER_ORACLE_ADDRESS || '0x376b26e7C91AE050E48Aa1Ca7233625EA258A3ab') as `0x${string}`
const CHUNK_SIZE = 25n // Coston2 RPC limits max block range to 30

export async function runBackfill() {
  const currentBlock = await withRetry(() => publicClient.getBlockNumber())
  const startBlock = currentBlock > 500n ? currentBlock - 500n : 0n

  logger.info('Starting backfill', { fromBlock: startBlock.toString(), toBlock: currentBlock.toString() })

  // Chunks are allowed to fail — a Coston2 RPC drops range queries regularly —
  // but the events in a failed chunk are then missing, so the run must not
  // claim to have indexed up to `currentBlock`. `failures` gates the state
  // update below, which is what makes the next run retry that range instead of
  // skipping past it forever.
  let failures = 0

  for (let from = startBlock; from <= currentBlock; from += CHUNK_SIZE) {
    const to = from + CHUNK_SIZE - 1n < currentBlock ? from + CHUNK_SIZE - 1n : currentBlock

    logger.info('Processing backfill chunk', { from: from.toString(), to: to.toString() })

    // 1. Fetch MarketCreated logs
    try {
      const marketCreatedLogs = await withRetry(() =>
        publicClient.getContractEvents({
          address: FACTORY_ADDRESS,
          abi: FactoryABI,
          eventName: 'MarketCreated',
          fromBlock: from,
          toBlock: to
        })
      )

      for (const log of marketCreatedLogs) {
        await handleMarketCreated(log)
      }
    } catch (err) {
      failures++
      logger.error('MarketCreated backfill chunk failed', { from: from.toString(), to: to.toString(), err: errorMessage(err) })
    }

    // 2. For each known market, fetch PositionMinted / MarketSettled / PositionRedeemed
    try {
      const { data: markets, error } = await supabase.from('markets').select('contract_address')
      if (error) throw new Error(`markets query failed: ${error.message}`)
      for (const market of markets ?? []) {
        const marketLogs = await withRetry(() =>
          publicClient.getContractEvents({
            address: market.contract_address as `0x${string}`,
            abi: MarketABI,
            fromBlock: from,
            toBlock: to
          })
        )

        for (const log of marketLogs) {
          const eventName = (log as any).eventName
          if (eventName === 'PositionMinted') await handlePositionMinted(market.contract_address, log)
          if (eventName === 'MarketSettled') await handleMarketSettled(market.contract_address, log)
          if (eventName === 'PositionRedeemed') await handlePositionRedeemed(market.contract_address, log)
        }
      }
    } catch (err) {
      failures++
      logger.error('Market events backfill chunk failed', { from: from.toString(), to: to.toString(), err: errorMessage(err) })
    }

    // 3. Fetch oracle ReadingSet logs
    try {
      const oracleLogs = await withRetry(() =>
        publicClient.getContractEvents({
          address: ORACLE_ADDRESS,
          abi: OracleABI,
          eventName: 'ReadingSet',
          fromBlock: from,
          toBlock: to
        })
      )

      for (const log of oracleLogs) {
        const { args, blockNumber, transactionHash } = log as any
        const { error } = await supabase.from('weather_readings').upsert(
          {
            region_id: args.regionId,
            region_name: getRegionName(args.regionId),
            variable: 'RAINFALL',
            value: args.value.toString(),
            reading_timestamp: new Date(Number(args.timestamp) * 1000).toISOString(),
            block_number: Number(blockNumber),
            tx_hash: transactionHash
          },
          { onConflict: 'tx_hash' }
        )
        assertWritten('weather_readings upsert', error, { txHash: transactionHash })
      }
    } catch (err) {
      failures++
      logger.error('Oracle ReadingSet backfill chunk failed', { from: from.toString(), to: to.toString(), err: errorMessage(err) })
    }
  }

  if (failures > 0) {
    throw new Error(
      `Backfill finished with ${failures} failed chunk(s); indexer_state left at its previous block so the range is retried`
    )
  }

  const { error } = await supabase.from('indexer_state').upsert(
    {
      id: 'coston2_main',
      last_block: Number(currentBlock),
      updated_at: new Date().toISOString()
    },
    { onConflict: 'id' }
  )
  assertWritten('indexer_state upsert', error, { lastBlock: Number(currentBlock) })

  logger.info('Backfill complete', { finalBlock: currentBlock.toString() })
}

if (require.main === module) {
  runBackfill().catch((err) => {
    logger.error('Backfill failed', { error: errorMessage(err) })
    process.exit(1)
  })
}
