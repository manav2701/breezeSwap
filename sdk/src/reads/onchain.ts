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
 * still reports not-found.
 */
export async function getMarketOnChain(
  publicClient: PublicClient,
  address: string,
  chainId = 114
): Promise<Market | null> {
  const marketAddress = address as `0x${string}`

  const code = await publicClient.getCode({ address: marketAddress }).catch(() => undefined)
  if (!code || code === '0x') return null

  const read = async <T>(functionName: string): Promise<T | null> => {
    try {
      return (await publicClient.readContract({
        address: marketAddress,
        abi: MarketABI,
        functionName,
      })) as T
    } catch {
      return null
    }
  }

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
    read<`0x${string}`>('regionId'),
    read<number>('weatherVariable'),
    read<number>('payoffType'),
    read<bigint>('thresholdLow'),
    read<bigint>('thresholdHigh'),
    read<bigint>('expiryTimestamp'),
    read<`0x${string}`>('collateralToken'),
    read<number>('status'),
    read<bigint>('finalOracleValue'),
    read<bigint>('longPayoutPerToken'),
    read<bigint>('shortPayoutPerToken'),
  ])

  if (collateralToken === null) return null

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
