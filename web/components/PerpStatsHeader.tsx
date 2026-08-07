'use client'

import React, { useEffect, useState } from 'react'
import { getPerpMarketStats, type PerpMarketStatsData } from '@breezeswap/sdk'
import { useBreezeSDK } from '../lib/hooks/useBreezeSDK'
import { useBreezeNetwork } from '../lib/hooks/useNetwork'
import { CHART, formatMoney } from '../lib/chartTheme'
import { DemoBadge } from './DemoBadge'
import { InlineError } from './LoadError'
import { errorMessage } from '../lib/errorMessage'
import { demoPerpStats } from '../lib/demoData'

interface PerpStatsHeaderProps {
  marketAddress: string
  basePrice?: number
}

/**
 * The market's headline numbers.
 *
 * Only one value here is coloured with the accent — the mark price, because
 * that is the number a trader is actually reading. The rest are ink, so the
 * eye lands somewhere specific instead of bouncing between five yellow
 * figures.
 */
export function PerpStatsHeader({ marketAddress, basePrice = 25 }: PerpStatsHeaderProps) {
  const { indexerUrl } = useBreezeSDK()
  const { chainId } = useBreezeNetwork()
  const [stats, setStats] = useState<PerpMarketStatsData | null>(null)
  const [isDemo, setIsDemo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState('—')

  useEffect(() => {
    let cancelled = false

    /**
     * Sample data stands in for an unindexed market, which is legitimate — but it
     * used to stand in for a *failed* read too, on a 10-second timer, so a dead
     * indexer showed plausible mark prices and open interest behind nothing more
     * than a "Sample data" chip. The failure is now named next to the chip.
     */
    async function fetchStats() {
      try {
        const data = await getPerpMarketStats(indexerUrl, marketAddress, chainId)
        if (cancelled) return
        setError(null)
        if (data) {
          setStats(data)
          setIsDemo(false)
        } else {
          setStats(demoPerpStats(marketAddress, basePrice) as unknown as PerpMarketStatsData)
          setIsDemo(true)
        }
      } catch (err) {
        console.error(`Failed to load stats for perp market ${marketAddress}`, err)
        if (cancelled) return
        setStats(demoPerpStats(marketAddress, basePrice) as unknown as PerpMarketStatsData)
        setIsDemo(true)
        setError(errorMessage(err))
      }
    }

    fetchStats()
    const timer = window.setInterval(fetchStats, 10_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [indexerUrl, marketAddress, chainId, basePrice])

  useEffect(() => {
    if (!stats?.nextFundingAt) return

    // Run once immediately so the tile does not show a placeholder for a
    // second before the first tick.
    const tick = () => {
      const diffSec = Math.max(
        0,
        Math.floor((new Date(stats.nextFundingAt).getTime() - Date.now()) / 1000)
      )
      const mins = Math.floor(diffSec / 60)
      const secs = diffSec % 60
      setCountdown(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`)
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [stats?.nextFundingAt])

  const fundingRate = Number(stats?.currentFundingRate ?? 0)
  const longOi = Number(stats?.openInterestLong ?? 0)
  const shortOi = Number(stats?.openInterestShort ?? 0)
  const totalOi = longOi + shortOi
  // Fall back to a balanced book rather than to 50% of nothing, and guard the
  // divide so an empty market renders a centred bar instead of NaN%.
  const longShare = totalOi > 0 ? (longOi / totalOi) * 100 : 50

  const markPrice = Number(stats?.markPrice ?? 0)
  const oraclePrice = Number(stats?.oraclePrice ?? 0)
  const basis = oraclePrice > 0 ? ((markPrice - oraclePrice) / oraclePrice) * 100 : 0

  return (
    <section className="panel p-5 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="eyebrow">Market stats</h2>
        <span className="flex flex-wrap items-center gap-3">
          {error && <InlineError message={`Live stats unavailable: ${error}`} />}
          {isDemo && <DemoBadge />}
        </span>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-5">
        <div className="min-w-0">
          <dt className="metric-label">Mark price</dt>
          <dd className="metric-value text-accent mt-1">{formatMoney(markPrice)}</dd>
        </div>

        <div className="min-w-0">
          <dt className="metric-label">Oracle price</dt>
          <dd className="metric-value mt-1">{formatMoney(oraclePrice)}</dd>
          <dd className={`numeric text-xs mt-0.5 ${basis >= 0 ? 'value-long' : 'value-short'}`}>
            {basis >= 0 ? '+' : ''}
            {basis.toFixed(2)}% basis
          </dd>
        </div>

        <div className="min-w-0">
          <dt className="metric-label">Funding / 15m</dt>
          <dd
            className={`metric-value mt-1 ${
              fundingRate > 0 ? 'value-short' : fundingRate < 0 ? 'value-long' : ''
            }`}
          >
            {fundingRate > 0 ? '+' : ''}
            {fundingRate.toFixed(4)}%
          </dd>
          <dd className="text-xs text-ink-faint mt-0.5">
            {fundingRate > 0 ? 'Longs pay shorts' : fundingRate < 0 ? 'Shorts pay longs' : 'Balanced'}
          </dd>
        </div>

        <div className="min-w-0">
          <dt className="metric-label">Next funding</dt>
          <dd className="metric-value mt-1 numeric">{countdown}</dd>
        </div>

        <div className="min-w-0">
          <dt className="metric-label">24h volume</dt>
          <dd className="metric-value mt-1">{formatMoney(Number(stats?.totalVolume24h ?? 0), 0)}</dd>
        </div>
      </dl>

      {/* Open interest skew. A single 100%-wide bar split in two: the reader's
          question is "which way is the book leaning", and proportion of a whole
          answers that better than two separate numbers. */}
      <div className="pt-5 border-t border-[color:var(--color-hairline)] space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full ring-2 ring-[color:var(--color-surface)]"
              style={{ backgroundColor: CHART.long }}
              aria-hidden
            />
            <span className="text-ink-muted">Long OI</span>
            <span className="numeric text-ink font-medium">{formatMoney(longOi, 0)}</span>
            <span className="numeric text-ink-faint">({longShare.toFixed(1)}%)</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="numeric text-ink-faint">({(100 - longShare).toFixed(1)}%)</span>
            <span className="numeric text-ink font-medium">{formatMoney(shortOi, 0)}</span>
            <span className="text-ink-muted">Short OI</span>
            <span
              className="w-2.5 h-2.5 rounded-full ring-2 ring-[color:var(--color-surface)]"
              style={{ backgroundColor: CHART.short }}
              aria-hidden
            />
          </span>
        </div>

        <div
          className="w-full h-2 rounded-full overflow-hidden flex gap-[2px] bg-[color:var(--color-inset)]"
          role="img"
          aria-label={`Open interest is ${longShare.toFixed(1)} percent long and ${(100 - longShare).toFixed(1)} percent short`}
        >
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${longShare}%`, backgroundColor: CHART.long }}
          />
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${100 - longShare}%`, backgroundColor: CHART.short }}
          />
        </div>
      </div>
    </section>
  )
}
