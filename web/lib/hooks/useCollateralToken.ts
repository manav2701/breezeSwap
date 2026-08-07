'use client'

import { useEffect, useState } from 'react'
import { getTokenMeta, getTokenBalance, type TokenMeta } from '@breezeswap/sdk'
import { errorMessage } from '../errorMessage'
import { useBreezeSDK } from './useBreezeSDK'

/**
 * Resolve a market's collateral token from the chain.
 *
 * The app used to hardcode 6 decimals everywhere. The deployed mUSDT on Coston2
 * has **18**, so every amount sent on-chain was 10^12 too small — entering
 * "100" posted 0.0000000001 mUSDT — and every amount displayed was 10^12 too
 * large. Nothing reverted, which is why it went unnoticed: the values were
 * small rather than invalid.
 *
 * Different markets on this deployment were also created against different
 * collateral tokens, so a single global constant could not have been right for
 * all of them even in principle.
 *
 * `decimals` starts as `null` rather than a guess. Callers must not build a
 * transaction until it resolves, otherwise the first render would scale the
 * amount by the wrong factor.
 *
 * For the same reason a failed read is reported through `error` rather than
 * swallowed: the mint form stays disabled either way, but it can now say why
 * instead of appearing indefinitely stuck on "Loading token…".
 */
export function useCollateralToken(tokenAddress?: string) {
  const { publicClient, address } = useBreezeSDK()
  const [meta, setMeta] = useState<TokenMeta | null>(null)
  const [balance, setBalance] = useState<bigint | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!publicClient || !tokenAddress) {
      setMeta(null)
      setBalance(null)
      setError(null)
      return
    }

    async function load() {
      setError(null)
      try {
        const m = await getTokenMeta(publicClient as any, tokenAddress as string)
        if (cancelled) return
        setMeta(m)
      } catch (err) {
        console.error(`Failed to read token metadata for ${tokenAddress}`, err)
        if (!cancelled) {
          setMeta(null)
          setError(errorMessage(err))
        }
        return
      }

      if (!address) return

      // An unreadable balance is not a blocker: the amount can still be scaled
      // and submitted, and the chain rejects an over-spend anyway. It is kept
      // separate from `error` so it cannot disable the form.
      try {
        const b = await getTokenBalance(publicClient as any, tokenAddress as string, address)
        if (!cancelled) setBalance(b)
      } catch (err) {
        console.warn(`Failed to read the ${tokenAddress} balance of ${address}`, err)
        if (!cancelled) setBalance(null)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [publicClient, tokenAddress, address])

  return {
    /** `null` until read from chain — never assume a default. */
    decimals: meta?.decimals ?? null,
    symbol: meta?.symbol ?? 'tokens',
    balance,
    isReady: meta !== null,
    /** Set when the token could not be read at all; `isReady` stays false. */
    error,
  }
}
