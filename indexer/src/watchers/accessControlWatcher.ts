import { publicClient } from '../utils/chainClient'
import { supabase } from '../db/client'
import { logger } from '../utils/logger'

const ACCESS_CONTROL_ADDRESS = (process.env.ACCESS_CONTROL_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`

// Staaandard OpenZeppelin AccessControl ABI events
const AccessControlEventsABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "bytes32", name: "role", type: "bytes32" },
      { indexed: true, internalType: "address", name: "account", type: "address" },
      { indexed: true, internalType: "address", name: "sender", type: "address" }
    ],
    name: "RoleGranted",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "bytes32", name: "role", type: "bytes32" },
      { indexed: true, internalType: "address", name: "account", type: "address" },
      { indexed: true, internalType: "address", name: "sender", type: "address" }
    ],
    name: "RoleRevoked",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [{ indexed: false, internalType: "address", name: "account", type: "address" }],
    name: "Paused",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [{ indexed: false, internalType: "address", name: "account", type: "address" }],
    name: "Unpaused",
    type: "event"
  }
] as const

export function startAccessControlWatcher() {
  if (ACCESS_CONTROL_ADDRESS === '0x0000000000000000000000000000000000000000') {
    logger.warn('ACCESS_CONTROL_ADDRESS not configured, access control watcher skipped')
    return
  }

  const unwatchGranted = publicClient.watchContractEvent({
    address: ACCESS_CONTROL_ADDRESS,
    abi: AccessControlEventsABI,
    eventName: 'RoleGranted',
    onLogs: async (logs) => {
      for (const log of logs) {
        const { args, blockNumber, transactionHash } = log as any
        const block = await publicClient.getBlock({ blockNumber })

        await supabase.from('protocol_events').insert({
          event_type: 'RoleGranted',
          contract_address: ACCESS_CONTROL_ADDRESS,
          role: args.role,
          account: args.account,
          triggered_by: args.sender,
          block_number: Number(blockNumber),
          tx_hash: transactionHash,
          occurred_at: new Date(Number(block.timestamp) * 1000).toISOString()
        })

        logger.info('RoleGranted event indexed', { role: args.role, account: args.account })
      }
    },
    onError: (err) => {
      logger.error('AccessControl RoleGranted watcher error, restarting in 5s...', { err: err.message })
      unwatchGranted()
      setTimeout(startAccessControlWatcher, 5000)
    }
  })

  const unwatchRevoked = publicClient.watchContractEvent({
    address: ACCESS_CONTROL_ADDRESS,
    abi: AccessControlEventsABI,
    eventName: 'RoleRevoked',
    onLogs: async (logs) => {
      for (const log of logs) {
        const { args, blockNumber, transactionHash } = log as any
        const block = await publicClient.getBlock({ blockNumber })

        await supabase.from('protocol_events').insert({
          event_type: 'RoleRevoked',
          contract_address: ACCESS_CONTROL_ADDRESS,
          role: args.role,
          account: args.account,
          triggered_by: args.sender,
          block_number: Number(blockNumber),
          tx_hash: transactionHash,
          occurred_at: new Date(Number(block.timestamp) * 1000).toISOString()
        })

        logger.info('RoleRevoked event indexed', { role: args.role, account: args.account })
      }
    },
    onError: (err) => {
      logger.error('AccessControl RoleRevoked watcher error', { err: err.message })
      unwatchRevoked()
    }
  })

  logger.info('AccessControl watcher started', { address: ACCESS_CONTROL_ADDRESS })
}
