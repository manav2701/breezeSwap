import type { PublicClient } from 'viem'
import MarketABI from '../abis/BreezeMarket.json'
import type { Market } from '../types'
import { ORACLE_SCALAR } from '../constants'
import { KNOWN_REGIONS } from '../utils/regions'

const VARIABLES = ['RAINFALL', 'TEMPERATURE'] as const
const PAYOFFS = ['BINARY', 'LINEAR', 'CAPPED'] as const

/**
 * Read a classic market straight from its contract.
 *
 * The indexer is a convenience, not a source of truth, and treating it as one
 * broke the single most important flow in the product: creating a market
 * succeeded on-chain and the very next screen said **"Market not found"**,
 * because the indexer had not seen the deployment — or, on a deployment whose
 * indexer URL was wrong, would never see anything at all.
 *
 * Everything the detail page needs is on the market contract. This is the
 * fallback that makes a freshly created market immediately usable, and makes
 * the whole app degrade to "slower and without history" rather than "broken"
 * when the indexer is down.
 *
 * Returns `null` when there is no contract at the address, so a genuine typo
 * still reports not-found. An RPC that cannot answer at all throws, because
 * "there is no market here" and "nobody could tell me" send the user to very
 * different places.
 */
export async function getMarketOnChain(
  publicClient: PublicClient,
  address: string,
  chainId = 114
): Promise<Market | null> {
  const marketAddress = address as `0x${string}`

  const code = await publicClient.getCode({ address: marketAddress })
  if (!code || code === '0x') return null

  // Optional fields only: a market deployed from an older factory may not expose
  // all of them, and the detail page renders fine without them.
  const read = async <T>(functionName: string): Promise<T | null> => {
    try {
      return (await publicClient.readContract({
        address: marketAddress,
        abi: MarketABI,
        functionName,
      })) as T
    } catch (err) {
      console.warn(`Could not read ${functionName}() from market ${address}`, err)
      return null
    }
  }

  // Required: without these there is no market to describe, and substituting
  // defaults produced a plausible-looking market with a zero threshold and no
  // expiry out of what was really a failed RPC call.
  const required = async <T>(functionName: string): Promise<T> =>
    (await publicClient.readContract({
      address: marketAddress,
      abi: MarketABI,
      functionName,
    })) as T

  const [
    regionId,
    weatherVariable,
    payoffType,
    thresholdLow,
    thresholdHigh,
    expiryTimestamp,
    collateralToken,
    status,
    finalOracleValue,
    longPayoutPerToken,
    shortPayoutPerToken,
  ] = await Promise.all([
    required<`0x${string}`>('regionId'),
    required<number>('weatherVariable'),
    required<number>('payoffType'),
    required<bigint>('thresholdLow'),
    read<bigint>('thresholdHigh'),
    required<bigint>('expiryTimestamp'),
    required<`0x${string}`>('collateralToken'),
    required<number>('status'),
    read<bigint>('finalOracleValue'),
    read<bigint>('longPayoutPerToken'),
    read<bigint>('shortPayoutPerToken'),
  ])

  const scale = (v: bigint | null): number | null =>
    v === null ? null : Number(v) / Number(ORACLE_SCALAR)

  const isSettled = Number(status ?? 0) === 1
  const WAD = 1e18

  return {
    contractAddress: address,
    chainId,
    regionId: regionId ?? '',
    // The chain stores a keccak hash, not a name. Resolve it against the known
    // regions so a market created through the app shows "Tokyo" rather than
    // "Global region"; an unrecognised hash stays null rather than being given
    // an invented label.
    regionName: regionId
      ? (KNOWN_REGIONS[regionId.toLowerCase()] ?? KNOWN_REGIONS[regionId] ?? null)
      : null,
    weatherVariable: VARIABLES[Number(weatherVariable ?? 0)] ?? 'RAINFALL',
    payoffType: PAYOFFS[Number(payoffType ?? 2)] ?? 'CAPPED',
    thresholdLow: scale(thresholdLow) ?? 0,
    thresholdHigh: Number(payoffType ?? 2) === 0 ? null : scale(thresholdHigh),
    expiryTimestamp: expiryTimestamp
      ? new Date(Number(expiryTimestamp) * 1000).toISOString()
      : '',
    collateralToken,
    status: isSettled ? 'SETTLED' : 'OPEN',
    finalOracleValue: isSettled ? scale(finalOracleValue) : null,
    longPayoutRatio: isSettled && longPayoutPerToken ? Number(longPayoutPerToken) / WAD : null,
    shortPayoutRatio: isSettled && shortPayoutPerToken ? Number(shortPayoutPerToken) / WAD : null,
    settledAt: null,
    createdAt: '',
    blockNumber: 0,
    txHash: '',
  } as Market
}
