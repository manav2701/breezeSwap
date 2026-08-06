'use client'

import React, { useMemo } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ReferenceArea,
} from 'recharts'
import type { WeatherReading } from '@breezeswap/sdk'
import { CHART, axisProps, gridProps, tooltipProps, paddedDomain } from '../lib/chartTheme'
import { ChartCard, LegendKey } from './charts/ChartCard'
import { DemoBadge } from './DemoBadge'

/**
 * Historical oracle readings for the market's region.
 *
 * One series, so it takes the cool accent rather than a rotated hue. The
 * shaded band between the two thresholds is the whole point of the chart: it
 * shows at a glance how often the region has actually landed in the payout
 * range.
 */
export function WeatherChart({
  readings,
  thresholdLow,
  thresholdHigh,
  variable,
  height = 260,
  isDemo = false,
}: {
  readings: WeatherReading[]
  thresholdLow?: number
  thresholdHigh?: number | null
  variable?: 'RAINFALL' | 'TEMPERATURE'
  height?: number
  /** Draws the sample-data chip inside the header rather than over it. */
  isDemo?: boolean
}) {
  const isRain = variable === 'RAINFALL'
  const unit = isRain ? 'mm' : '°C'

  const data = useMemo(
    () =>
      readings.map((r) => ({
        date: new Date(r.readingTimestamp).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        value: Number(r.value),
      })),
    [readings]
  )

  // Include the thresholds in the domain so the strike line is never off-plot.
  const domain = useMemo(() => {
    const vals = data.map((d) => d.value)
    if (thresholdLow !== undefined) vals.push(thresholdLow)
    if (thresholdHigh != null) vals.push(thresholdHigh)
    return paddedDomain(vals)
  }, [data, thresholdLow, thresholdHigh])

  const inRange =
    thresholdLow !== undefined
      ? data.filter((d) => d.value >= thresholdLow && (thresholdHigh == null || d.value <= thresholdHigh))
          .length
      : 0

  return (
    <ChartCard
      title="Observed readings"
      subtitle={`Verified ${isRain ? 'rainfall' : 'temperature'} history for this region, in ${unit}.`}
      height={height}
      empty={data.length === 0}
      emptyLabel="No oracle readings recorded for this region yet."
      actions={
        <>
          {isDemo && <DemoBadge />}
          {data.length > 0 && <span className="chip">{data.length} readings</span>}
        </>
      }
      footer={
        data.length > 0 ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <LegendKey color={CHART.cool} label={isRain ? 'Rainfall' : 'Temperature'} />
            {thresholdLow !== undefined && (
              <LegendKey color={CHART.accent} label={`Strike ${thresholdLow}${unit}`} />
            )}
            {thresholdLow !== undefined && (
              <span className="text-xs text-ink-faint">
                <span className="numeric text-ink-muted">{inRange}</span> of{' '}
                <span className="numeric text-ink-muted">{data.length}</span> readings landed in the
                payout range
              </span>
            )}
          </div>
        ) : undefined
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 30, bottom: 4, left: -8 }}>
          <defs>
            <linearGradient id="weatherGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.cool} stopOpacity={0.32} />
              <stop offset="100%" stopColor={CHART.cool} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid {...gridProps} />

          <XAxis {...axisProps} dataKey="date" minTickGap={30} />
          <YAxis
            {...axisProps}
            domain={domain}
            width={46}
            tickFormatter={(v) => `${Number(v).toFixed(0)}${unit}`}
          />

          <Tooltip
            {...tooltipProps}
            formatter={(v: number) => [`${Number(v).toFixed(1)} ${unit}`, 'Reading']}
          />

          {/* The payout band, drawn behind the series. */}
          {thresholdLow !== undefined && thresholdHigh != null && (
            <ReferenceArea
              y1={thresholdLow}
              y2={thresholdHigh}
              fill={CHART.accent}
              fillOpacity={0.06}
              stroke="none"
            />
          )}

          {thresholdLow !== undefined && (
            <ReferenceLine y={thresholdLow} stroke={CHART.accent} strokeDasharray="4 4" />
          )}
          {thresholdHigh != null && (
            <ReferenceLine y={thresholdHigh} stroke={CHART.reference} strokeDasharray="4 4" />
          )}

          <Area
            type="monotone"
            dataKey="value"
            stroke={CHART.cool}
            strokeWidth={2}
            fill="url(#weatherGrad)"
            isAnimationActive={false}
            activeDot={{
              r: 4,
              fill: CHART.cool,
              stroke: 'var(--color-surface)',
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
