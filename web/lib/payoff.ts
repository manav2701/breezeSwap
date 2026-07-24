import type { Market } from '@breezeswap/sdk'

export interface PayoffPoint {
  x: number      // oracle value in display units
  long: number   // long side payout (0-1, fraction of notional)
  short: number  // short side payout (0-1, fraction of notional)
}

export function calculatePayoffCurve(market: Partial<Market>, points = 100): PayoffPoint[] {
  const low = market.thresholdLow ?? 50
  const high = market.thresholdHigh ?? low * 2
  const rangeMin = Math.max(0, low * 0.2)
  const rangeMax = (market.payoffType === 'CAPPED' ? high : low) * 1.8

  return Array.from({ length: points }, (_, i) => {
    const x = rangeMin + (rangeMax - rangeMin) * (i / (points - 1))
    let longRatio: number

    if (market.payoffType === 'BINARY') {
      longRatio = x >= low ? 1 : 0
    } else if (market.payoffType === 'LINEAR') {
      longRatio = Math.min(1, Math.max(0, (x - low) / low))
    } else {
      // CAPPED
      if (x <= low) longRatio = 0
      else if (x >= high) longRatio = 1
      else longRatio = (x - low) / (high - low)
    }

    return { x: Number(x.toFixed(1)), long: Number(longRatio.toFixed(3)), short: Number((1 - longRatio).toFixed(3)) }
  })
}
