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
    <div className="w-full h-72 bg-[#141414] p-4 rounded-3xl border border-white/10 font-mono">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#262626" opacity={0.6} />
          <XAxis
            dataKey="x"
            stroke="#a3a3a3"
            fontSize={10}
            unit={` ${unit}`}
            tickLine={false}
          />
          <YAxis
            stroke="#a3a3a3"
            fontSize={10}
            domain={[0, 1]}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#0a0a0a', borderColor: 'rgba(255,255,255,0.15)', borderRadius: '12px', fontSize: '11px', color: '#ffffff' }}
            formatter={(value: any, name: any) => [`${(Number(value) * 100).toFixed(1)}%`, name === 'long' ? 'LONG Payout' : 'SHORT Payout']}
            labelFormatter={(label) => `Oracle Value: ${label} ${unit}`}
          />
          <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />

          <Line
            type="monotone"
            dataKey="long"
            stroke="#34d399"
            strokeWidth={2.5}
            dot={false}
            name="LONG Side"
          />
          <Line
            type="monotone"
            dataKey="short"
            stroke="#f87171"
            strokeWidth={2.5}
            dot={false}
            name="SHORT Side"
          />

          {market.thresholdLow !== undefined && (
            <ReferenceLine
              x={market.thresholdLow}
              stroke="#fde047"
              strokeDasharray="4 4"
              label={{ value: `Low: ${market.thresholdLow}`, fill: '#fde047', fontSize: 10, position: 'top' }}
            />
          )}

          {market.thresholdHigh && (
            <ReferenceLine
              x={market.thresholdHigh}
              stroke="#c084fc"
              strokeDasharray="4 4"
              label={{ value: `High: ${market.thresholdHigh}`, fill: '#c084fc', fontSize: 10, position: 'top' }}
            />
          )}

          {market.finalOracleValue !== undefined && market.finalOracleValue !== null && (
            <ReferenceLine
              x={market.finalOracleValue}
              stroke="#fde047"
              strokeWidth={2}
              label={{ value: `Final: ${market.finalOracleValue}`, fill: '#fde047', fontSize: 11, position: 'insideTopLeft' }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
