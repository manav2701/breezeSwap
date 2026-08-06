import { fromTokenUnits } from '@breezeswap/sdk'

/**
 * Render a raw token amount at the token's own scale.
 *
 * Fixed decimal places alone are not enough here. A position minted before the
 * decimals bug was fixed holds 3,000,000 raw units of an 18-decimal token —
 * 0.000000000003 mUSDT — and at four decimal places that prints as "0", which
 * reads as "no position" rather than "a very small one". Falling back to
 * significant digits keeps a real balance visible however small it is, while
 * ordinary amounts still get clean fixed-point formatting.
 */
export function formatTokenAmount(
  raw: bigint | string | null | undefined,
  decimals: number | null,
  symbol = ''
): string {
  if (decimals === null || raw === null || raw === undefined) return '—'

  const value = fromTokenUnits(raw, decimals)
  const suffix = symbol ? ` ${symbol}` : ''

  if (value === 0) return `0${suffix}`

  // Non-zero but would round away at 4dp — show significant digits instead.
  const formatted =
    Math.abs(value) < 0.0001
      ? value.toLocaleString(undefined, { maximumSignificantDigits: 3 })
      : value.toLocaleString(undefined, { maximumFractionDigits: 4 })

  return `${formatted}${suffix}`
}
