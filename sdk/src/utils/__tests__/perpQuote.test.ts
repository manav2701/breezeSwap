import { describe, it, expect } from 'vitest'
import { calculateMarkPrice, calculatePerpQuote, type Reserves } from '../perpQuote'

const E18 = 10n ** 18n

describe('calculateMarkPrice', () => {
  it('returns 0 when the weather reserve is empty', () => {
    expect(calculateMarkPrice({ collateralReserve: 1000n * E18, weatherReserve: 0n })).toBe(0)
  })

  it('computes collateral-per-weather as the price', () => {
    // 2000 / 1000 = 2
    expect(
      calculateMarkPrice({ collateralReserve: 2000n * E18, weatherReserve: 1000n * E18 })
    ).toBe(2)
  })

  it('computes a price of 1 for balanced reserves', () => {
    expect(
      calculateMarkPrice({ collateralReserve: 1000n * E18, weatherReserve: 1000n * E18 })
    ).toBe(1)
  })
})

describe('calculatePerpQuote', () => {
  const reserves: Reserves = {
    collateralReserve: 1_000_000n * E18,
    weatherReserve: 1_000_000n * E18,
  }

  it('deducts the fee and computes net collateral', () => {
    const collateralIn = 1000n * E18
    const q = calculatePerpQuote(reserves, collateralIn, 2, true)
    // default feeBps = 10 -> 0.1%
    expect(q.feeAmount).toBe((collateralIn * 10n) / 10_000n)
    expect(q.netCollateral).toBe(collateralIn - q.feeAmount)
  })

  it('respects a custom fee in basis points', () => {
    const collateralIn = 1000n * E18
    const q = calculatePerpQuote(reserves, collateralIn, 1, true, 30)
    expect(q.feeAmount).toBe((collateralIn * 30n) / 10_000n)
  })

  it('pushes the mark price up and returns positive exposure for a long', () => {
    const before = calculateMarkPrice(reserves)
    const q = calculatePerpQuote(reserves, 1000n * E18, 3, true)
    expect(q.exposureOut > 0n).toBe(true)
    expect(q.newMarkPrice).toBeGreaterThan(before)
    expect(q.priceImpactBps).toBeGreaterThan(0)
    expect(q.entryPrice).toBeGreaterThan(0)
  })

  it('pushes the mark price down and returns positive exposure for a short', () => {
    const before = calculateMarkPrice(reserves)
    const q = calculatePerpQuote(reserves, 1000n * E18, 3, false)
    expect(q.exposureOut > 0n).toBe(true)
    expect(q.newMarkPrice).toBeLessThan(before)
    expect(q.priceImpactBps).toBeGreaterThan(0)
  })

  it('scales exposure with leverage (larger notional moves the price more)', () => {
    const low = calculatePerpQuote(reserves, 1000n * E18, 1, true)
    const high = calculatePerpQuote(reserves, 1000n * E18, 5, true)
    expect(high.exposureOut > low.exposureOut).toBe(true)
    expect(high.priceImpactBps).toBeGreaterThanOrEqual(low.priceImpactBps)
  })

  it('reports zero price impact against empty reserves', () => {
    const empty: Reserves = { collateralReserve: 0n, weatherReserve: 0n }
    const q = calculatePerpQuote(empty, 1000n * E18, 2, true)
    expect(q.priceImpactBps).toBe(0)
  })
})
