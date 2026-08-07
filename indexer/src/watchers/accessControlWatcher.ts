import { publicClient } from '../utils/chainClient'
import { supabase } from '../db/client'
import { logger } from '../utils/logger'
import { assertWritten, errorMessage } from '../utils/errors'

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

/**
 * Subscribe to one role event and record it.
 *
 * Both subscriptions previously restarted by calling the top-level starter,
 * which re-subscribed *both* events and leaked the surviving one; the
 * `RoleRevoked` subscription did not restart at all, so a single transport
 * hiccup stopped revocations being recorded for the rest of the process's life
 * with nothing but one log line to say so.
 */
function watchRoleEvent(eventName: 'RoleGranted' | 'RoleRevoked') {
  const unwatch = publicClient.watchContractEvent({
    address: ACCESS_CONTROL_ADDRESS,
    abi: AccessControlEventsABI,
    eventName,
    onLogs: async (logs) => {
      for (const log of logs) {
        const { args, blockNumber, transactionHash } = log as any
        try {
          const block = await publicClient.getBlock({ blockNumber })

          const { error } = await supabase.from('protocol_events').insert({
            event_type: eventName,
            contract_address: ACCESS_CONTROL_ADDRESS,
            role: args.role,
            account: args.account,
            triggered_by: args.sender,
            block_number: Number(blockNumber),
            tx_hash: transactionHash,
            occurred_at: new Date(Number(block.timestamp) * 1000).toISOString()
          })
          assertWritten('protocol_events insert', error, { eventName, txHash: transactionHash })

          logger.info(`${eventName} event indexed`, { role: args.role, account: args.account })
        } catch (err) {
          logger.error(`Failed to index ${eventName}`, {
            txHash: transactionHash,
            err: errorMessage(err)
          })
        }
      }
    },
    onError: (err) => {
      logger.error(`AccessControl ${eventName} watcher error, restarting in 5s...`, { err: err.message })
      unwatch()
      setTimeout(() => watchRoleEvent(eventName), 5000)
    }
  })
}

export function startAccessControlWatcher() {
  if (ACCESS_CONTROL_ADDRESS === '0x0000000000000000000000000000000000000000') {
    logger.warn('ACCESS_CONTROL_ADDRESS not configured, access control watcher skipped')
    return
  }

  watchRoleEvent('RoleGranted')
  watchRoleEvent('RoleRevoked')

  logger.info('AccessControl watcher started', { address: ACCESS_CONTROL_ADDRESS })
}
