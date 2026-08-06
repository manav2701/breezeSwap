'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { getMarkPriceCandles, type OHLCCandle } from '@breezeswap/sdk'
import { useBreezeSDK } from '../lib/hooks/useBreezeSDK'
import { useBreezeNetwork } from '../lib/hooks/useNetwork'
import { CHART, axisProps, gridProps, tooltipProps, paddedDomain, formatMoney } from '../lib/chartTheme'
import { ChartCard } from './charts/ChartCard'
import { DemoBadge } from './DemoBadge'
import { demoCandles } from '../lib/demoData'

const INTERVALS = ['5m', '15m', '1h'] as const
type Interval = (typeof INTERVALS)[number]

const INTERVAL_SECONDS: Record<Interval, number> = { '5m': 300, '15m': 900, '1h': 3600 }

export function MarkPriceChart({
  marketAddress,
  basePrice = 25,
  height = 280,
}: {
  marketAddress: string
  /** Oracle anchor used to seed the fallback series. */
  basePrice?: number
  height?: number
}) {
  const { indexerUrl } = useBreezeSDK()
  const { chainId } = useBreezeNetwork()
  const [interval, setInterval_] = useState<Interval>('5m')
  const [candles, setCandles] = useState<OHLCCandle[]>([])
  const [loading, setLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const data = await getMarkPriceCandles(indexerUrl, marketAddress, interval, 100, chainId)
        if (cancelled) return
        if (data && data.length > 0) {
          setCandles(data)
          setIsDemo(false)
        } else {
          setCandles(
            demoCandles(`${marketAddress}:${interval}`, 72, basePrice, INTERVAL_SECONDS[interval])
          )
          setIsDemo(true)
        }
      } catch {
        if (cancelled) return
        setCandles(
          demoCandles(`${marketAddress}:${interval}`, 72, basePrice, INTERVAL_SECONDS[interval])
        )
        setIsDemo(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    const timer = window.setInterval(load, 20_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [indexerUrl, marketAddress, interval, chainId, basePrice])

  const data = useMemo(
    () =>
      candles.map((c) => ({
        time: new Date(c.timestamp * 1000).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        price: Number(c.close),
      })),
    [candles]
  )

  const domain = useMemo(() => paddedDomain(data.map((d) => d.price)), [data])

  const last = data.at(-1)?.price ?? 0
  const first = data[0]?.price ?? 0
  const change = first > 0 ? ((last - first) / first) * 100 : 0
  const up = change >= 0

  return (
    <ChartCard
      title="Mark price"
      subtitle="vAMM mark price sampled from the reserve curve over time."
      height={height}
      loading={loading}
      empty={!loading && data.length === 0}
      emptyLabel="No mark price snapshots for this market yet."
      actions={
        <>
          {isDemo && <DemoBadge />}
          <div className="segmented" role="group" aria-label="Candle interval">
            {INTERVALS.map((int) => (
              <button
                key={int}
                type="button"
                onClick={() => setInterval_(int)}
                data-active={interval === int}
                aria-pressed={interval === int}
              >
                {int}
              </button>
            ))}
          </div>
        </>
      }
      footer={
        data.length > 0 ? (
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="metric-value text-accent">{formatMoney(last)}</span>
            <span
              className={`numeric text-xs font-medium ${up ? 'value-long' : 'value-short'}`}
              title="Change across the visible window"
            >
              {up ? '▲' : '▼'} {up ? '+' : ''}
              {change.toFixed(2)}% over {data.length} periods
            </span>
          </div>
        ) : undefined
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        {/* The right margin holds the last x-axis tick, which is centred on the
            final data point and would otherwise be clipped in half by the
            panel's overflow. */}
        <AreaChart data={data} margin={{ top: 8, right: 34, bottom: 4, left: -8 }}>
          <defs>
            <linearGradient id="markPriceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.accent} stopOpacity={0.3} />
              <stop offset="100%" stopColor={CHART.accent} stopOpacity={0.01} />
            </linearGradient>
          </defs>

          <CartesianGrid {...gridProps} />

          <XAxis {...axisProps} dataKey="time" minTickGap={40} />
          <YAxis
            {...axisProps}
            domain={domain}
            width={52}
            tickFormatter={(v) => `$${Number(v).toFixed(2)}`}
          />

          <Tooltip
            {...tooltipProps}
            formatter={(v: number) => [formatMoney(Number(v)), 'Mark']}
          />

          <Area
            type="monotone"
            dataKey="price"
            stroke={CHART.accent}
            strokeWidth={2}
            fill="url(#markPriceGrad)"
            isAnimationActive={false}
            activeDot={{
              r: 4,
              fill: CHART.accent,
              stroke: 'var(--color-surface)',
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
