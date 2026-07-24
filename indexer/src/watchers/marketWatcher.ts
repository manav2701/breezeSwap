import { publicClient } from '../utils/chainClient'
import { supabase } from '../db/client'
import { logger } from '../utils/logger'
import { withRetry } from '../utils/retry'
import MarketABI from '../abis/BreezeMarket.json'

const activeWatchers = new Map<string, () => void>()

export async function handlePositionMinted(marketAddress: string, log: any) {
  const { args, blockNumber, transactionHash } = log
  const block = await withRetry(() => publicClient.getBlock({ blockNumber }))

  await supabase.from('positions').upsert(
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

  logger.info('Position indexed', { market: marketAddress, user: args.user, side: args.side === 0 ? 'LONG' : 'SHORT' })
}

export async function handleMarketSettled(marketAddress: string, log: any) {
  const { args, blockNumber, transactionHash } = log
  const block = await withRetry(() => publicClient.getBlock({ blockNumber }))

  const longPayoutRatio = (Number(args.longPayoutPerToken) / 1e18).toString()
  const shortPayoutRatio = (Number(args.shortPayoutPerToken) / 1e18).toString()

  await supabase
    .from('markets')
    .update({
      status: 'SETTLED',
      final_oracle_value: args.oracleValue.toString(),
      long_payout_ratio: longPayoutRatio,
      short_payout_ratio: shortPayoutRatio,
      settled_at: new Date(Number(block.timestamp) * 1000).toISOString()
    })
    .eq('contract_address', marketAddress.toLowerCase())

  await supabase.from('settlements').upsert(
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

  logger.info('Settlement indexed', { market: marketAddress, oracleValue: args.oracleValue.toString() })
}

export async function handlePositionRedeemed(marketAddress: string, log: any) {
  const { args, blockNumber, transactionHash } = log
  const block = await withRetry(() => publicClient.getBlock({ blockNumber }))

  await supabase
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

  logger.info('Redemption indexed', { market: marketAddress, user: args.user })
}

export function startMarketWatcher(marketAddress: string) {
  const normalizedAddress = marketAddress.toLowerCase()
  if (activeWatchers.has(normalizedAddress)) return

  const unwatch = publicClient.watchContractEvent({
    address: normalizedAddress as `0x${string}`,
    abi: MarketABI,
    onLogs: (logs) => {
      logs.forEach((log) => {
        const eventName = (log as any).eventName
        if (eventName === 'PositionMinted') handlePositionMinted(normalizedAddress, log)
        if (eventName === 'MarketSettled') handleMarketSettled(normalizedAddress, log)
        if (eventName === 'PositionRedeemed') handlePositionRedeemed(normalizedAddress, log)
      })
    },
    onError: (err) => logger.error('Market watcher error', { market: normalizedAddress, err: err.message })
  })

  activeWatchers.set(normalizedAddress, unwatch)
  logger.info('Market watcher started', { market: normalizedAddress })
}
