'use client'

import React, { useMemo } from 'react'
import { calculatePerpQuote, calculateMarkPrice, type Reserves } from '@breezeswap/sdk'
import { CHART, formatMoney } from '../lib/chartTheme'

interface DepthLadderProps {
  reserves?: Reserves
  tradingFeeBps?: number
}

const SIZE_STEPS = [500, 1_000, 2_500, 5_000, 10_000, 25_000]

/**
 * What a given order size costs in slippage against the constant-product
 * curve.
 *
 * The impact column is a magnitude comparison across rows, so each row carries
 * a proportional bar as well as its number — the bar is what makes "25k costs
 * 30× what 500 costs" readable without doing the division. Bars are scaled to
 * the largest impact in the ladder rather than to a fixed ceiling, so the
 * shape stays informative whatever the pool depth is.
 */
export function DepthLadder({ reserves, tradingFeeBps = 10 }: DepthLadderProps) {
  const markPrice = reserves ? calculateMarkPrice(reserves) : 0

  const ladder = useMemo(() => {
    if (!reserves || reserves.collateralReserve === 0n || reserves.weatherReserve === 0n) return []

    return SIZE_STEPS.map((size) => {
      // Reserves are 18-decimal, so the notional must be scaled to match.
      const notionalWei = BigInt(size) * 10n ** 18n
      const longQuote = calculatePerpQuote(reserves, notionalWei, 1, true, tradingFeeBps)
      const shortQuote = calculatePerpQuote(reserves, notionalWei, 1, false, tradingFeeBps)

      const longSlippage = markPrice > 0 ? ((longQuote.entryPrice - markPrice) / markPrice) * 100 : 0
      const shortSlippage =
        markPrice > 0 ? ((markPrice - shortQuote.entryPrice) / markPrice) * 100 : 0

      return {
        size,
        longPrice: longQuote.entryPrice,
        shortPrice: shortQuote.entryPrice,
        longSlippage,
        shortSlippage,
      }
    })
  }, [reserves, tradingFeeBps, markPrice])

  const maxImpact = useMemo(
    () => Math.max(0.01, ...ladder.map((r) => Math.max(r.longSlippage, Math.abs(r.shortSlippage)))),
    [ladder]
  )

  if (ladder.length === 0) {
    return (
      <div className="panel p-6">
        <div className="h-32 flex items-center justify-center text-xs text-ink-faint">
          Waiting for reserve data…
        </div>
      </div>
    )
  }

  return (
    <section className="panel">
      <header className="flex flex-wrap items-start justify-between gap-3 p-5 sm:p-6 pb-4 border-b border-[color:var(--color-hairline)]">
        <div className="min-w-0">
          <h3 className="display-3 text-ink">Depth &amp; price impact</h3>
          <p className="text-xs text-ink-faint mt-1">
            Estimated fill price for a single order at each notional size.
          </p>
        </div>
        <span className="chip chip-accent shrink-0">
          Mark <span className="numeric">{formatMoney(markPrice)}</span>
        </span>
      </header>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Notional</th>
              <th>Long fill</th>
              <th>Short fill</th>
              <th className="w-[38%] min-w-[180px]">Price impact</th>
            </tr>
          </thead>
          <tbody>
            {ladder.map((row) => (
              <tr key={row.size}>
                <td className="numeric text-ink font-medium">{formatMoney(row.size, 0)}</td>
                <td className="numeric value-long">{formatMoney(row.longPrice)}</td>
                <td className="numeric value-short">{formatMoney(row.shortPrice)}</td>
                <td>
                  <div className="flex items-center gap-3">
                    {/* 2px surface gap between the two fills keeps them from
                        reading as one bar at small impacts, and a 4px floor
                        stops the smallest rows collapsing into round dots that
                        no longer read as bars at all. */}
                    <div className="flex-1 min-w-[80px] h-1.5 rounded-full bg-[color:var(--color-inset)] overflow-hidden flex gap-[2px]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `max(4px, ${(row.longSlippage / maxImpact) * 50}%)`,
                          backgroundColor: CHART.long,
                        }}
                      />
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `max(4px, ${(Math.abs(row.shortSlippage) / maxImpact) * 50}%)`,
                          backgroundColor: CHART.short,
                        }}
                      />
                    </div>
                    <span className="numeric text-xs text-ink-muted tabular-nums shrink-0 w-14 text-right">
                      {row.longSlippage.toFixed(2)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-5 sm:px-6 py-3 border-t border-[color:var(--color-hairline)] flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-faint">
        <span className="inline-flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full ring-2 ring-[color:var(--color-surface)]"
            style={{ backgroundColor: CHART.long }}
            aria-hidden
          />
          Long impact
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full ring-2 ring-[color:var(--color-surface)]"
            style={{ backgroundColor: CHART.short }}
            aria-hidden
          />
          Short impact
        </span>
        <span>Includes the {(tradingFeeBps / 100).toFixed(2)}% trading fee.</span>
      </div>
    </section>
  )
}
