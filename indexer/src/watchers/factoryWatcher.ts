import { Log } from 'viem'
import { publicClient } from '../utils/chainClient'
import { supabase } from '../db/client'
import { logger } from '../utils/logger'
import { withRetry } from '../utils/retry'
import { assertWritten, errorMessage } from '../utils/errors'
import { getRegionName } from '../utils/regionNames'
import { startMarketWatcher } from './marketWatcher'
import FactoryABI from '../abis/BreezeMarketFactory.json'
import MarketABI from '../abis/BreezeMarket.json'

const FACTORY_ADDRESS = (process.env.FACTORY_ADDRESS || '0xe8969c988D4CF26AA9A98B8a95fF93D14E80615A') as `0x${string}`

export async function handleMarketCreated(log: Log) {
  const { args, blockNumber, transactionHash } = log as any
  const block = await withRetry(() => publicClient.getBlock({ blockNumber }))

  const marketAddress = args.market.toLowerCase()

  let weatherVar = args.weatherVariable
  let thresholdLow = args.thresholdLow
  let thresholdHigh = args.thresholdHigh

  if (thresholdLow === undefined || thresholdLow === null) {
    // Defaulting the thresholds to zero on a failed read used to write a market
    // whose payoff terms were wrong in the database while the row itself looked
    // complete — the worst possible outcome, because nothing downstream could
    // tell it apart from a real market. Fail instead: the caller logs it and
    // the backfill will pick the market up on a later pass.
    try {
      const [wv, tl, th] = await Promise.all([
        publicClient.readContract({ address: args.market, abi: MarketABI as any, functionName: 'weatherVariable' }),
        publicClient.readContract({ address: args.market, abi: MarketABI as any, functionName: 'thresholdLow' }),
        publicClient.readContract({ address: args.market, abi: MarketABI as any, functionName: 'thresholdHigh' }),
      ])
      weatherVar = wv
      thresholdLow = tl
      thresholdHigh = th
    } catch (err) {
      throw new Error(
        `Failed to read market terms from ${args.market}: ${errorMessage(err)}`
      )
    }
  }

  const { error } = await supabase.from('markets').upsert(
    {
      contract_address: marketAddress,
      chain_id: 114,
      region_id: args.regionId,
      region_name: getRegionName(args.regionId),
      weather_variable: Number(weatherVar ?? 0) === 0 ? 'RAINFALL' : 'TEMPERATURE',
      payoff_type: ['BINARY', 'LINEAR', 'CAPPED'][args.payoffType] || 'CAPPED',
      threshold_low: (thresholdLow ?? 0n).toString(),
      threshold_high: thresholdHigh !== undefined && thresholdHigh !== null ? thresholdHigh.toString() : null,
      expiry_timestamp: new Date(Number(args.expiryTimestamp) * 1000).toISOString(),
      collateral_token: args.collateralToken.toLowerCase(),
      status: 'OPEN',
      created_at: new Date(Number(block.timestamp) * 1000).toISOString(),
      block_number: Number(blockNumber),
      tx_hash: transactionHash
    },
    { onConflict: 'contract_address' }
  )

  assertWritten('markets upsert', error, { market: args.market })

  logger.info('Market indexed', { market: args.market, region: getRegionName(args.regionId) })

  startMarketWatcher(marketAddress)
}

export function startFactoryWatcher() {
  logger.info('Starting factory watcher', { address: FACTORY_ADDRESS })

  const unwatch = publicClient.watchContractEvent({
    address: FACTORY_ADDRESS,
    abi: FactoryABI,
    eventName: 'MarketCreated',
    onLogs: (logs) => {
      for (const log of logs) {
        handleMarketCreated(log).catch((err) => {
          logger.error('Failed to index MarketCreated', {
            txHash: (log as any).transactionHash,
            err: errorMessage(err)
          })
        })
      }
    },
    onError: (err) => {
      logger.error('Factory watcher error, restarting in 5s...', { err: err.message })
      unwatch()
      setTimeout(startFactoryWatcher, 5000)
    }
  })
}
