/**
 * Request validation helpers.
 *
 * Every public endpoint takes user-controlled path and query parameters and
 * forwards them straight into PostgREST filters or `readContract` calls. The
 * Supabase client parameterises values, so this is not an injection surface,
 * but unvalidated input still reached the database and the RPC node verbatim:
 *
 *  - `Number(req.query.limit)` on a non-numeric value yields `NaN`, and
 *    `.range(NaN, NaN)` / `.limit(NaN)` produce a 500 rather than a 400.
 *  - `/markets` and `/protocol/fees/recent` had no upper bound on `limit`, so a
 *    single request could ask for the entire table.
 *  - `:address` was lowercased but never checked, so arbitrary strings were used
 *    as contract addresses for on-chain reads.
 */

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const BYTES32_RE = /^0x[a-fA-F0-9]{64}$/

export const SUPPORTED_CHAIN_IDS = [114, 14] as const

export class BadRequestError extends Error {}

/** Lowercased checksum-agnostic EVM address, or a 400. */
export function requireAddress(value: unknown, name = 'address'): string {
  const raw = String(value ?? '')
  if (!ADDRESS_RE.test(raw)) throw new BadRequestError(`Invalid ${name}: expected a 20-byte hex address`)
  return raw.toLowerCase()
}

/** Region ids are `bytes32` oracle keys. */
export function requireRegionId(value: unknown): string {
  const raw = String(value ?? '')
  if (!BYTES32_RE.test(raw)) throw new BadRequestError('Invalid regionId: expected a 32-byte hex value')
  return raw.toLowerCase()
}

export function parseChainId(value: unknown): number {
  if (value === undefined || value === '') return 114
  const chainId = Number(value)
  if (!SUPPORTED_CHAIN_IDS.includes(chainId as (typeof SUPPORTED_CHAIN_IDS)[number])) {
    throw new BadRequestError(`Unsupported chainId: expected one of ${SUPPORTED_CHAIN_IDS.join(', ')}`)
  }
  return chainId
}

/** Bounded non-negative integer. Rejects `NaN`, `Infinity` and negatives. */
export function parseInteger(
  value: unknown,
  { fallback, min, max, name }: { fallback: number; min: number; max: number; name: string }
): number {
  if (value === undefined || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new BadRequestError(`Invalid ${name}: expected an integer between ${min} and ${max}`)
  }
  return parsed
}

/** Enum-style query parameter, matched case-insensitively against `allowed`. */
export function parseEnum<T extends string>(value: unknown, allowed: readonly T[], name: string): T {
  const raw = String(value ?? '').toUpperCase()
  const match = allowed.find((option) => option.toUpperCase() === raw)
  if (!match) throw new BadRequestError(`Invalid ${name}: expected one of ${allowed.join(', ')}`)
  return match
}

/** Free-text filter value, length-capped so it cannot be used to build huge queries. */
export function parseShortString(value: unknown, name: string, maxLength = 64): string {
  const raw = String(value ?? '')
  if (raw.length === 0 || raw.length > maxLength) {
    throw new BadRequestError(`Invalid ${name}: expected 1–${maxLength} characters`)
  }
  return raw
}
