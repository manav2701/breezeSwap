/**
 * Sample series used when the indexer has nothing to return.
 *
 * BreezeSwap's indexer only has rows once someone has traded on Coston2, so a
 * fresh environment renders every panel as an empty state and nothing about
 * the product is legible. Rather than leave the app blank, each surface falls
 * back to a generated series **and says so**: anything drawn from here is
 * rendered behind a visible "Sample data" chip, so a demo is never mistaken
 * for on-chain activity.
 *
 * The generator is seeded, so the same market address always produces the same
 * curve — screenshots and demos stay reproducible between reloads.
 */

/** Small deterministic PRNG (mulberry32). Same seed ⇒ same series. */
function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedFrom(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export type DemoCandle = {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
}

/**
 * A mean-reverting mark price walk. Weather markets do not trend the way an
 * asset does — the price oscillates around the oracle forecast — so the walk
 * pulls back toward `base` rather than drifting.
 */
export function demoCandles(key: string, count = 72, base = 25, intervalSec = 300): DemoCandle[] {
  const rand = seeded(seedFrom(key))
  const now = Math.floor(Date.now() / 1000)
  const out: DemoCandle[] = []
  let price = base

  for (let i = count - 1; i >= 0; i--) {
    const shock = (rand() - 0.5) * base * 0.018
    const pullback = (base - price) * 0.08
    const open = price
    price = Math.max(base * 0.6, price + shock + pullback)
    const close = price
    const wick = base * 0.006 * rand()
    out.push({
      timestamp: now - i * intervalSec,
      open: Number(open.toFixed(4)),
      close: Number(close.toFixed(4)),
      high: Number((Math.max(open, close) + wick).toFixed(4)),
      low: Number((Math.min(open, close) - wick).toFixed(4)),
    })
  }
  return out
}

export type DemoFunding = {
  settledAt: string
  /** Basis points, matching the indexer's `fundingRate` units. */
  fundingRate: number
}

/**
 * Funding settlements must cross zero, because the sign is what the bar chart
 * encodes — it says which side is paying. A pure random walk drifts to one
 * side and stays there, which produced 24 identical red bars and made the
 * diverging colour scale meaningless. Driving the skew with a slow oscillation
 * plus noise keeps the sign changing the way a real book does.
 */
export function demoFunding(key: string, periods = 24, intervalMin = 15): DemoFunding[] {
  const rand = seeded(seedFrom(key + ':funding'))
  const now = Date.now()
  const phase = rand() * Math.PI * 2

  return Array.from({ length: periods }, (_, i) => {
    const wave = Math.sin(phase + (i / periods) * Math.PI * 2.6)
    const noise = (rand() - 0.5) * 0.45
    const skew = Math.max(-1, Math.min(1, wave * 0.8 + noise))
    return {
      settledAt: new Date(now - i * intervalMin * 60_000).toISOString(),
      fundingRate: Number((skew * 90).toFixed(2)),
    }
  })
}

export type DemoTrade = {
  id: string
  trader: string
  type: 'OPEN' | 'CLOSE' | 'LIQUIDATION'
  side: 'LONG' | 'SHORT'
  size: string
  price: string
  pnl: string | null
  timestamp: string
  txHash: string
}

const DEMO_TRADERS = [
  '0x7a3f9c1e8b2d4a6f0c5e9b7d3a1f8c2e4b6d0a9f',
  '0x2c8e5b1a7f3d9c0e6b4a8f2d5c1e7b3a9f0d6c4e',
  '0x9f1d6b3a8c5e2f7d0b4a9c6e3f1d8b5a2c7e0f4d',
  '0x4b7e2a9c6f1d8b3a0c5e7f2d9b6a4c1e8f3d0b7a',
  '0x6d0a4f8c2b9e5a1d7c3f0b8e6a2d9c4f1b7e3a5d',
]

export function demoTrades(key: string, count = 14, base = 25): DemoTrade[] {
  const rand = seeded(seedFrom(key + ':trades'))
  const now = Date.now()

  // Gaps accumulate rather than being computed as `i * random`, which is not
  // monotonic and produced a feed reading "0s ago, 4m ago, 2m ago".
  let elapsed = 0

  return Array.from({ length: count }, (_, i) => {
    const roll = rand()
    const type: DemoTrade['type'] = roll > 0.94 ? 'LIQUIDATION' : roll > 0.55 ? 'CLOSE' : 'OPEN'
    const side: DemoTrade['side'] = rand() > 0.48 ? 'LONG' : 'SHORT'
    const size = Math.round((200 + rand() * 9800) / 50) * 50
    const price = base * (1 + (rand() - 0.5) * 0.03)
    const pnl =
      type === 'OPEN' ? null : ((rand() - (type === 'LIQUIDATION' ? 0.95 : 0.45)) * size * 0.09)

    elapsed += 45_000 + rand() * 260_000

    return {
      id: `demo-${key}-${i}`,
      trader: DEMO_TRADERS[i % DEMO_TRADERS.length],
      type,
      side,
      size: String(size),
      price: price.toFixed(2),
      pnl: pnl === null ? null : pnl.toFixed(2),
      timestamp: new Date(now - elapsed).toISOString(),
      txHash: '',
    }
  })
}

export type DemoReading = { readingTimestamp: string; value: number }

/** Thirty days of readings that straddle the strike, so the band is meaningful. */
export function demoWeatherReadings(
  key: string,
  thresholdLow = 50,
  thresholdHigh: number | null = 100,
  days = 30
): DemoReading[] {
  const rand = seeded(seedFrom(key + ':weather'))
  const centre = thresholdHigh != null ? (thresholdLow + thresholdHigh) / 2 : thresholdLow * 1.15
  const spread = Math.max(4, centre * 0.4)
  const now = Date.now()

  let v = centre
  return Array.from({ length: days }, (_, i) => {
    v += (rand() - 0.5) * spread * 0.55 + (centre - v) * 0.18
    return {
      readingTimestamp: new Date(now - (days - 1 - i) * 86_400_000).toISOString(),
      value: Number(Math.max(0, v).toFixed(1)),
    }
  })
}

/** Stats block for a perp market with no indexer rows behind it. */
export function demoPerpStats(key: string, base = 25) {
  const rand = seeded(seedFrom(key + ':stats'))
  const longOi = Math.round(40_000 + rand() * 180_000)
  const shortOi = Math.round(40_000 + rand() * 180_000)
  const mark = base * (1 + (rand() - 0.5) * 0.02)

  return {
    markPrice: mark.toFixed(2),
    oraclePrice: base.toFixed(2),
    currentFundingRate: ((rand() - 0.45) * 0.08).toFixed(4),
    nextFundingAt: new Date(Date.now() + (3 + rand() * 11) * 60_000).toISOString(),
    totalVolume24h: String(Math.round(180_000 + rand() * 1_400_000)),
    openInterestLong: String(longOi),
    openInterestShort: String(shortOi),
    oiSkewPercent: (longOi / (longOi + shortOi)) * 100,
  }
}
