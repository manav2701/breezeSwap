import type { PublicClient } from 'viem'

const ERC20_META_ABI = [
  { inputs: [], name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'symbol', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
  {
    inputs: [{ type: 'address' }, { type: 'address' }],
    name: 'allowance',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ type: 'address' }],
    name: 'balanceOf',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

export interface TokenMeta {
  address: string
  decimals: number
  symbol: string
}

/**
 * Read a collateral token's decimals and symbol from the chain.
 *
 * **Never assume 6.** The whole app previously hardcoded 6-decimal collateral
 * while the deployed mUSDT on Coston2 has **18**. Every amount the UI sent was
 * therefore 10^12 too small — entering "100" posted 0.0000000001 mUSDT — and
 * every amount it displayed was 10^12 too large. Nothing reverted, because the
 * numbers were small rather than invalid, so the error was invisible.
 *
 * Decimals are a property of whichever token a market was actually deployed
 * against, and different markets on this deployment use different tokens. The
 * only correct source is the token itself.
 */
export async function getTokenMeta(
  publicClient: PublicClient,
  token: string
): Promise<TokenMeta> {
  const address = token as `0x${string}`

  const [decimals, symbol] = await Promise.all([
    publicClient
      .readContract({ address, abi: ERC20_META_ABI, functionName: 'decimals' })
      .catch(() => 18),
    publicClient
      .readContract({ address, abi: ERC20_META_ABI, functionName: 'symbol' })
      .catch(() => 'TOKEN'),
  ])

  return { address: token, decimals: Number(decimals), symbol: String(symbol) }
}

export async function getAllowance(
  publicClient: PublicClient,
  token: string,
  owner: string,
  spender: string
): Promise<bigint> {
  try {
    return (await publicClient.readContract({
      address: token as `0x${string}`,
      abi: ERC20_META_ABI,
      functionName: 'allowance',
      args: [owner as `0x${string}`, spender as `0x${string}`],
    })) as bigint
  } catch {
    return 0n
  }
}

export async function getTokenBalance(
  publicClient: PublicClient,
  token: string,
  owner: string
): Promise<bigint> {
  try {
    return (await publicClient.readContract({
      address: token as `0x${string}`,
      abi: ERC20_META_ABI,
      functionName: 'balanceOf',
      args: [owner as `0x${string}`],
    })) as bigint
  } catch {
    return 0n
  }
}

/** Convert a human-entered amount to raw units for a token of `decimals`. */
export function toTokenUnits(amount: number, decimals: number): bigint {
  if (!Number.isFinite(amount) || amount <= 0) return 0n
  // Build the integer from a fixed-precision string so a value like 0.1 does
  // not pick up a float artefact on the way to BigInt.
  const [whole, frac = ''] = amount.toFixed(decimals).split('.')
  return BigInt(whole + frac.padEnd(decimals, '0').slice(0, decimals))
}

/** Convert raw token units back to a display number. */
export function fromTokenUnits(raw: bigint | string, decimals: number): number {
  const value = typeof raw === 'bigint' ? raw : BigInt(raw || '0')
  const divisor = 10n ** BigInt(decimals)
  const whole = value / divisor
  const frac = value % divisor
  return Number(whole) + Number(frac) / Number(divisor)
}
