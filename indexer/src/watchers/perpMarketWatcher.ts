import { publicClient } from '../utils/chainClient'
import { supabase } from '../db/client'
import { logger } from '../utils/logger'

const PerpMarketABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "positionId", type: "uint256" },
      { indexed: true, internalType: "address", name: "trader", type: "address" },
      { indexed: false, internalType: "bool", name: "isLong", type: "bool" },
      { indexed: false, internalType: "uint256", name: "collateral", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "leverage", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "virtualSize", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "markPrice", type: "uint256" }
    ],
    name: "PositionOpened",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "positionId", type: "uint256" },
      { indexed: true, internalType: "address", name: "trader", type: "address" },
      { indexed: false, internalType: "int256", name: "pnl", type: "int256" },
      { indexed: false, internalType: "uint256", name: "payout", type: "uint256" }
    ],
    name: "PositionClosed",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "positionId", type: "uint256" },
      { indexed: true, internalType: "address", name: "liquidator", type: "address" },
      { indexed: false, internalType: "uint256", name: "reward", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "badDebt", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "coveredDebt", type: "uint256" }
    ],
    name: "PositionLiquidated",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "int256", name: "fundingRate", type: "int256" },
      { indexed: false, internalType: "int256", name: "newCumulativeIndex", type: "int256" },
      { indexed: false, internalType: "uint256", name: "timestamp", type: "uint256" }
    ],
    name: "FundingSettled",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "market", type: "address" },
      { indexed: true, internalType: "address", name: "trader", type: "address" },
      { indexed: false, internalType: "uint256", name: "feeAmount", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "insuranceShare", type: "uint256" },
      // Added when waterfall tier 1 gained its own funded reserve. The event
      // signature changed with it, so this entry is not optional — without it the
      // topic no longer matches and fee events stop being indexed silently.
      { indexed: false, internalType: "uint256", name: "firstLossShare", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "treasuryShare", type: "uint256" }
    ],
    name: "FeeCollected",
    type: "event"
  }
] as const

export function startPerpMarketWatcher(marketAddress: string) {
  const mAddress = marketAddress as `0x${string}`

  const unwatch = publicClient.watchContractEvent({
    address: mAddress,
    abi: PerpMarketABI,
    onLogs: async (logs) => {
      for (const log of logs) {
        const { eventName, args, blockNumber, transactionHash } = log as any
        const block = await publicClient.getBlock({ blockNumber })

        if (eventName === 'PositionOpened') {
          await supabase.from('perp_positions').insert({
            market_address: marketAddress.toLowerCase(),
            position_id: args.positionId.toString(),
            trader_address: args.trader.toLowerCase(),
            is_long: args.isLong,
            collateral: args.collateral.toString(),
            leverage: Number(args.leverage),
            virtual_size: args.virtualSize.toString(),
            entry_mark_price: args.markPrice.toString(),
            opened_at: new Date(Number(block.timestamp) * 1000).toISOString(),
            open_tx_hash: transactionHash,
            is_open: true
          })
          logger.info('Perp PositionOpened indexed', { marketAddress, positionId: args.positionId.toString() })
        } else if (eventName === 'PositionClosed') {
          await supabase
            .from('perp_positions')
            .update({
              is_open: false,
              closed_at: new Date(Number(block.timestamp) * 1000).toISOString(),
              close_tx_hash: transactionHash,
              realized_pnl: args.pnl.toString()
            })
            .match({ market_address: marketAddress.toLowerCase(), position_id: args.positionId.toString() })
          logger.info('Perp PositionClosed indexed', { marketAddress, positionId: args.positionId.toString() })
        } else if (eventName === 'PositionLiquidated') {
          await supabase
            .from('perp_positions')
            .update({
              is_open: false,
              was_liquidated: true,
              closed_at: new Date(Number(block.timestamp) * 1000).toISOString(),
              close_tx_hash: transactionHash
            })
            .match({ market_address: marketAddress.toLowerCase(), position_id: args.positionId.toString() })
          logger.info('Perp PositionLiquidated indexed', { marketAddress, positionId: args.positionId.toString() })
        } else if (eventName === 'FundingSettled') {
          await supabase.from('funding_history').insert({
            market_address: marketAddress.toLowerCase(),
            funding_rate: args.fundingRate.toString(),
            cumulative_index: args.newCumulativeIndex.toString(),
            mark_price: '0',
            oracle_price: '0',
            settled_at: new Date(Number(args.timestamp) * 1000).toISOString(),
            block_number: Number(blockNumber),
            tx_hash: transactionHash
          })
          logger.info('Perp FundingSettled indexed', { marketAddress, rate: args.fundingRate.toString() })
        } else if (eventName === 'FeeCollected') {
          await supabase.from('fee_events').insert({
            market_address: marketAddress.toLowerCase(),
            trader_address: args.trader.toLowerCase(),
            fee_amount: args.feeAmount.toString(),
            insurance_share: args.insuranceShare.toString(),
            first_loss_share: args.firstLossShare.toString(),
            treasury_share: args.treasuryShare.toString(),
            block_number: Number(blockNumber),
            tx_hash: transactionHash,
            occurred_at: new Date(Number(block.timestamp) * 1000).toISOString()
          })
          logger.info('FeeCollected indexed', { marketAddress, feeAmount: args.feeAmount.toString() })
        }
      }
    },
    onError: (err) => {
      logger.error('Perp market watcher error, restarting...', { marketAddress, err: err.message })
      unwatch()
      setTimeout(() => startPerpMarketWatcher(marketAddress), 5000)
    }
  })

  logger.info('Perp market watcher started', { marketAddress })
}
