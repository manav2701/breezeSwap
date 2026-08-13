import dotenv from 'dotenv'
dotenv.config()

import { publicClient } from '../utils/chainClient'
import { supabase } from '../db/client'
import { logger } from '../utils/logger'
import { withRetry } from '../utils/retry'
import { handleMarketCreated } from '../watchers/factoryWatcher'
import { handlePositionMinted, handleMarketSettled, handlePositionRedeemed } from '../watchers/marketWatcher'
import { getRegionName } from '../utils/regionNames'

import FactoryABI from '../abis/BreezeMarketFactory.json'
import MarketABI from '../abis/BreezeMarket.json'
import OracleABI from '../abis/MockWeatherOracle.json'

const FACTORY_ADDRESS = (process.env.FACTORY_ADDRESS || '0xe8969c988D4CF26AA9A98B8a95fF93D14E80615A') as `0x${string}`
const ORACLE_ADDRESS = (process.env.MOCK_WEATHER_ORACLE_ADDRESS || '0x376b26e7C91AE050E48Aa1Ca7233625EA258A3ab') as `0x${string}`
const CHUNK_SIZE = 25n // Coston2 RPC limits max block range to 30

/**
 * Where to resume indexing from.
 *
 * @dev This was `currentBlock - 500n`, unconditionally. Coston2 produces a block roughly
 * every 1.8 seconds, so that is about fifteen minutes of history no matter when the
 * contracts were deployed or how long the service was down. Meanwhile `DEPLOYMENT_BLOCK`
 * was documented in `.env.example` as "block to backfill from on first boot" and read
 * nowhere, and `indexer_state.last_block` was written after every run and never read back.
 * Both existed; neither did anything.
 *
 * It surfaces as missing data rather than as an error. Seeding the oracle takes longer than
 * fifteen minutes, so a boot afterwards indexed only the tail of that run, and every chart
 * whose region had no rows fell back to sample data with nothing logged to say why.
 *
 * Resume point, in order of preference:
 *   1. the stored cursor, so a restart continues where it left off
 *   2. `DEPLOYMENT_BLOCK`, so a first boot covers the whole deployment
 *   3. the previous 500-block window, so an unconfigured service still does something
 */
async function resolveStartBlock(currentBlock: bigint): Promise<{ from: bigint; reason: string }> {
  const deploymentBlock = process.env.DEPLOYMENT_BLOCK
    ? BigInt(process.env.DEPLOYMENT_BLOCK)
    : undefined

  let stored: bigint | undefined
  try {
    const { data } = await supabase
      .from('indexer_state')
      .select('last_block')
      .eq('id', 'coston2_main')
      .single()
    if (data?.last_block) stored = BigInt(data.last_block)
  } catch {
    // No row yet is the ordinary first-boot case, not a failure.
  }

  // A stored cursor behind the configured deployment means the row is left over from an
  // earlier set of contracts. Trusting it would silently skip the current deployment's
  // history, which is exactly how the indexer ended up watching one generation of
  // contracts while the frontend read another.
  if (stored && deploymentBlock !== undefined && stored < deploymentBlock) {
    return { from: deploymentBlock, reason: 'DEPLOYMENT_BLOCK (stored cursor predates it)' }
  }
  if (stored && stored > 0n) {
    // Re-read the last indexed block rather than starting past it: handlers upsert on
    // transaction hash, so overlapping by a block is harmless and missing one is not.
    return { from: stored, reason: 'stored cursor' }
  }
  if (deploymentBlock !== undefined) {
    return { from: deploymentBlock, reason: 'DEPLOYMENT_BLOCK' }
  }
  return {
    from: currentBlock > 500n ? currentBlock - 500n : 0n,
    reason: 'default 500-block window; set DEPLOYMENT_BLOCK to cover the full deployment',
  }
}

export async function runBackfill() {
  const currentBlock = await withRetry(() => publicClient.getBlockNumber())
  const { from: startBlock, reason } = await resolveStartBlock(currentBlock)

  logger.info('Starting backfill', {
    fromBlock: startBlock.toString(),
    toBlock: currentBlock.toString(),
    blocks: (currentBlock - startBlock).toString(),
    startedFrom: reason,
  })

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
    } catch (err: any) {
      logger.warn('MarketCreated fetch warning', { from: from.toString(), err: err.message })
    }

    // 2. For each known market, fetch PositionMinted / MarketSettled / PositionRedeemed
    try {
      const { data: markets } = await supabase.from('markets').select('contract_address')
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
    } catch (err: any) {
      logger.warn('Market events fetch warning', { err: err.message })
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
        await supabase.from('weather_readings').upsert(
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
      }
    } catch (err: any) {
      logger.warn('Oracle ReadingSet fetch warning', { err: err.message })
    }
  }

  // Update indexer_state
  try {
    await supabase.from('indexer_state').upsert(
      {
        id: 'coston2_main',
        last_block: Number(currentBlock),
        updated_at: new Date().toISOString()
      },
      { onConflict: 'id' }
    )
  } catch (err: any) {
    logger.warn('Indexer state update skipped', { err: err.message })
  }

  logger.info('Backfill complete', { finalBlock: currentBlock.toString() })
}

if (require.main === module) {
  runBackfill().catch((err) => {
    logger.error('Backfill failed', { error: err.message })
    process.exit(1)
  })
}
