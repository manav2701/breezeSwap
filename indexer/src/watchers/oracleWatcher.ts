import { publicClient } from '../utils/chainClient'
import { supabase } from '../db/client'
import { logger } from '../utils/logger'
import { getRegionName } from '../utils/regionNames'
import OracleABI from '../abis/MockWeatherOracle.json'

const ORACLE_ADDRESS = (process.env.MOCK_WEATHER_ORACLE_ADDRESS || '0x376b26e7C91AE050E48Aa1Ca7233625EA258A3ab') as `0x${string}`

export function startOracleWatcher() {
  const unwatch = publicClient.watchContractEvent({
    address: ORACLE_ADDRESS,
    abi: OracleABI,
    eventName: 'ReadingSet',
    onLogs: async (logs) => {
      for (const log of logs) {
        const { args, blockNumber, transactionHash } = log as any
        const block = await publicClient.getBlock({ blockNumber })

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

        logger.info('Oracle reading indexed', { region: args.regionId, value: args.value.toString() })
      }
    },
    onError: (err) => {
      logger.error('Oracle watcher error, restarting in 5s...', { err: err.message })
      unwatch()
      setTimeout(startOracleWatcher, 5000)
    }
  })

  logger.info('Oracle watcher started', { address: ORACLE_ADDRESS })
}
