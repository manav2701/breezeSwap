'use client'

import React from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend
} from 'recharts'
import { calculatePayoffCurve } from '../lib/payoff'
import type { Market } from '@breezeswap/sdk'

export function PayoffChart({ market }: { market: Partial<Market> }) {
  const data = calculatePayoffCurve(market)
  const unit = market.weatherVariable === 'RAINFALL' ? 'mm' : '°C'

  return (
    <div className="w-full h-72 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
          <XAxis
            dataKey="x"
            stroke="#94a3b8"
            fontSize={11}
            unit={` ${unit}`}
            tickLine={false}
          />
          <YAxis
            stroke="#94a3b8"
            fontSize={11}
            domain={[0, 1]}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
            formatter={(value: any, name: any) => [`${(Number(value) * 100).toFixed(1)}%`, name === 'long' ? 'LONG Payout' : 'SHORT Payout']}
            labelFormatter={(label) => `Oracle Value: ${label} ${unit}`}
          />
          <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />

          <Line
            type="monotone"
            dataKey="long"
            stroke="#10b981"
            strokeWidth={2.5}
            dot={false}
            name="LONG Side"
          />
          <Line
            type="monotone"
            dataKey="short"
            stroke="#ef4444"
            strokeWidth={2.5}
            dot={false}
            name="SHORT Side"
          />

          {market.thresholdLow !== undefined && (
            <ReferenceLine
              x={market.thresholdLow}
              stroke="#06b6d4"
              strokeDasharray="4 4"
              label={{ value: `Low: ${market.thresholdLow}`, fill: '#06b6d4', fontSize: 10, position: 'top' }}
            />
          )}

          {market.thresholdHigh && (
            <ReferenceLine
              x={market.thresholdHigh}
              stroke="#8b5cf6"
              strokeDasharray="4 4"
              label={{ value: `High: ${market.thresholdHigh}`, fill: '#8b5cf6', fontSize: 10, position: 'top' }}
            />
          )}

          {market.finalOracleValue !== undefined && market.finalOracleValue !== null && (
            <ReferenceLine
              x={market.finalOracleValue}
              stroke="#f59e0b"
              strokeWidth={2}
              label={{ value: `Final: ${market.finalOracleValue}`, fill: '#f59e0b', fontSize: 11, position: 'insideTopLeft' }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
