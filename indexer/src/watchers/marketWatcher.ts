import { publicClient } from '../utils/chainClient'
import { supabase } from '../db/client'
import { logger } from '../utils/logger'
import { withRetry } from '../utils/retry'
import { assertWritten, errorMessage } from '../utils/errors'
import MarketABI from '../abis/BreezeMarket.json'

const activeWatchers = new Map<string, () => void>()

export async function handlePositionMinted(marketAddress: string, log: any) {
  const { args, blockNumber, transactionHash } = log
  const block = await withRetry(() => publicClient.getBlock({ blockNumber }))

  const { error } = await supabase.from('positions').upsert(
    {
      market_address: marketAddress.toLowerCase(),
      token_id: args.tokenId.toString(),
      holder_address: args.user.toLowerCase(),
      side: args.side === 0 ? 'LONG' : 'SHORT',
      collateral_asset: args.collateralAsset ? args.collateralAsset.toLowerCase() : 'usdt',
      collateral_amount: args.collateralAmount ? args.collateralAmount.toString() : args.amount?.toString() || '0',
      minted_at: new Date(Number(block.timestamp) * 1000).toISOString(),
      block_number: Number(blockNumber),
      tx_hash: transactionHash
    },
    { onConflict: 'tx_hash' }
  )
  assertWritten('positions upsert', error, { market: marketAddress, txHash: transactionHash })

  logger.info('Position indexed', { market: marketAddress, user: args.user, side: args.side === 0 ? 'LONG' : 'SHORT' })
}

export async function handleMarketSettled(marketAddress: string, log: any) {
  const { args, blockNumber, transactionHash } = log
  const block = await withRetry(() => publicClient.getBlock({ blockNumber }))

  const longPayoutRatio = (Number(args.longPayoutPerToken) / 1e18).toString()
  const shortPayoutRatio = (Number(args.shortPayoutPerToken) / 1e18).toString()

  const { error: marketError } = await supabase
    .from('markets')
    .update({
      status: 'SETTLED',
      final_oracle_value: args.oracleValue.toString(),
      long_payout_ratio: longPayoutRatio,
      short_payout_ratio: shortPayoutRatio,
      settled_at: new Date(Number(block.timestamp) * 1000).toISOString()
    })
    .eq('contract_address', marketAddress.toLowerCase())
  assertWritten('markets settlement update', marketError, { market: marketAddress })

  const { error: settlementError } = await supabase.from('settlements').upsert(
    {
      market_address: marketAddress.toLowerCase(),
      oracle_value: args.oracleValue.toString(),
      long_payout_ratio: longPayoutRatio,
      short_payout_ratio: shortPayoutRatio,
      settled_at: new Date(Number(block.timestamp) * 1000).toISOString(),
      block_number: Number(blockNumber),
      tx_hash: transactionHash
    },
    { onConflict: 'tx_hash' }
  )
  assertWritten('settlements upsert', settlementError, { market: marketAddress, txHash: transactionHash })

  logger.info('Settlement indexed', { market: marketAddress, oracleValue: args.oracleValue.toString() })
}

export async function handlePositionRedeemed(marketAddress: string, log: any) {
  const { args, blockNumber, transactionHash } = log
  const block = await withRetry(() => publicClient.getBlock({ blockNumber }))

  const { error } = await supabase
    .from('positions')
    .update({
      redeemed: true,
      redeemed_amount: args.payout.toString(),
      redeemed_at: new Date(Number(block.timestamp) * 1000).toISOString(),
      redeem_tx_hash: transactionHash
    })
    .eq('market_address', marketAddress.toLowerCase())
    .eq('token_id', args.tokenId.toString())
    .eq('holder_address', args.user.toLowerCase())
  assertWritten('positions redemption update', error, { market: marketAddress, txHash: transactionHash })

  logger.info('Redemption indexed', { market: marketAddress, user: args.user })
}

export function startMarketWatcher(marketAddress: string) {
  const normalizedAddress = marketAddress.toLowerCase()
  if (activeWatchers.has(normalizedAddress)) return

  const watch = () => {
    const unwatch = publicClient.watchContractEvent({
      address: normalizedAddress as `0x${string}`,
      abi: MarketABI,
      onLogs: (logs) => {
        // `onLogs` is synchronous as far as viem is concerned, so a rejected
        // handler here is an unhandled rejection: nothing reports it and the
        // process can be torn down by it. Each log is handled and reported
        // independently so one bad event does not drop the rest of the batch.
        for (const log of logs) {
          const eventName = (log as any).eventName
          const handler =
            eventName === 'PositionMinted' ? handlePositionMinted
            : eventName === 'MarketSettled' ? handleMarketSettled
            : eventName === 'PositionRedeemed' ? handlePositionRedeemed
            : null
          if (!handler) continue

          handler(normalizedAddress, log).catch((err) => {
            logger.error('Failed to index market event', {
              market: normalizedAddress,
              eventName,
              txHash: (log as any).transactionHash,
              err: errorMessage(err)
            })
          })
        }
      },
      onError: (err) => {
        logger.error('Market watcher error, restarting in 5s...', { market: normalizedAddress, err: err.message })
        unwatch()
        activeWatchers.delete(normalizedAddress)
        setTimeout(() => startMarketWatcher(normalizedAddress), 5000)
      }
    })

    activeWatchers.set(normalizedAddress, unwatch)
  }

  watch()
  logger.info('Market watcher started', { market: normalizedAddress })
}
