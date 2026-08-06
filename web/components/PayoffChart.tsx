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
} from 'recharts'
import { calculatePayoffCurve } from '../lib/payoff'
import { CHART, axisProps, gridProps, tooltipProps } from '../lib/chartTheme'
import { ChartCard, LegendKey } from './charts/ChartCard'
import type { Market } from '@breezeswap/sdk'

/**
 * Settlement payout for each side as a function of the final oracle reading.
 *
 * Two series that always sum to 1, so they are drawn as filled areas rather
 * than lines — the reader's question is "how much of the pot goes to my side",
 * and area answers that at a glance where two crossing lines do not.
 */
export function PayoffChart({
  market,
  height = 260,
}: {
  market: Partial<Market>
  height?: number
}) {
  const data = useMemo(() => calculatePayoffCurve(market), [market])
  const unit = market.weatherVariable === 'RAINFALL' ? 'mm' : '°C'

  const hasFinal = market.finalOracleValue !== undefined && market.finalOracleValue !== null

  return (
    <ChartCard
      title="Payoff at settlement"
      subtitle={`Share of the collateral pot each side receives, by final oracle reading (${unit}).`}
      height={height}
      empty={data.length === 0}
      emptyLabel="Set a threshold to preview the payoff curve."
      actions={<span className="chip">{market.payoffType ?? 'CAPPED'}</span>}
      footer={
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <LegendKey color={CHART.long} label="LONG payout" />
          <LegendKey color={CHART.short} label="SHORT payout" />
          {market.thresholdLow !== undefined && (
            <span className="text-xs text-ink-faint">
              Strike <span className="numeric text-ink-muted">{market.thresholdLow}{unit}</span>
            </span>
          )}
          {market.thresholdHigh != null && (
            <span className="text-xs text-ink-faint">
              Cap <span className="numeric text-ink-muted">{market.thresholdHigh}{unit}</span>
            </span>
          )}
        </div>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 26, bottom: 4, left: -8 }}>
          <defs>
            <linearGradient id="payoffLong" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.long} stopOpacity={0.35} />
              <stop offset="100%" stopColor={CHART.long} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="payoffShort" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.short} stopOpacity={0.3} />
              <stop offset="100%" stopColor={CHART.short} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid {...gridProps} />

          {/* A numeric x-axis rather than the default category axis. As a
              category axis the ticks landed on whichever of the 100 sampled
              points fell at the right pixel — "52.9mm", "83.8mm" — and
              ReferenceLine could not position the strike between samples. */}
          <XAxis
            {...axisProps}
            dataKey="x"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v) => `${Math.round(Number(v))}${unit}`}
            minTickGap={28}
          />
          <YAxis
            {...axisProps}
            domain={[0, 1]}
            ticks={[0, 0.25, 0.5, 0.75, 1]}
            tickFormatter={(v) => `${Math.round(v * 100)}%`}
            width={40}
          />

          <Tooltip
            {...tooltipProps}
            formatter={(value: number, name: string) => [
              `${(Number(value) * 100).toFixed(1)}%`,
              name === 'long' ? 'LONG' : 'SHORT',
            ]}
            labelFormatter={(label) => `Oracle reading ${label}${unit}`}
          />

          <Area
            type="monotone"
            dataKey="long"
            name="long"
            stroke={CHART.long}
            strokeWidth={2}
            fill="url(#payoffLong)"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="short"
            name="short"
            stroke={CHART.short}
            strokeWidth={2}
            fill="url(#payoffShort)"
            isAnimationActive={false}
          />

          {/* Reference lines are declared after the areas so they paint on top
              of the fills — underneath them the dashed strike was invisible
              against the 35%-opacity gradient.

              Strike and cap can sit close together (40°C and 48°C on an 8–86°C
              axis), which ran the two labels into each other as "StrikeCap".
              They are stacked on separate rows rather than both hugging the
              top, so the pair stays legible however tight the band is. */}
          {market.thresholdLow !== undefined && (
            <ReferenceLine
              x={market.thresholdLow}
              stroke={CHART.reference}
              strokeDasharray="4 4"
              label={{
                value: 'Strike',
                fill: CHART.inkMuted,
                fontSize: 10,
                position: 'insideTopLeft',
                offset: 8,
              }}
            />
          )}
          {market.thresholdHigh != null && (
            <ReferenceLine
              x={market.thresholdHigh}
              stroke={CHART.reference}
              strokeDasharray="4 4"
              label={{
                value: 'Cap',
                fill: CHART.inkMuted,
                fontSize: 10,
                position: 'insideTopLeft',
                offset: 24,
              }}
            />
          )}

          {/* The settled reading is the one line that must read as data, so it
              gets the accent and a label. */}
          {hasFinal && (
            <ReferenceLine
              x={market.finalOracleValue as number}
              stroke={CHART.accent}
              strokeWidth={2}
              label={{
                value: `Settled ${market.finalOracleValue}${unit}`,
                fill: CHART.accent,
                fontSize: 10,
                position: 'insideTopRight',
              }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
