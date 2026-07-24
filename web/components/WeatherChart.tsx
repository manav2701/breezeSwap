'use client'

import React from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts'
import type { WeatherReading } from '@breezeswap/sdk'

export function WeatherChart({
  readings,
  thresholdLow,
  thresholdHigh,
  variable
}: {
  readings: WeatherReading[]
  thresholdLow?: number
  thresholdHigh?: number | null
  variable?: 'RAINFALL' | 'TEMPERATURE'
}) {
  const isRain = variable === 'RAINFALL'
  const unit = isRain ? 'mm' : '°C'

  const formattedData = readings.map((r) => ({
    date: new Date(r.readingTimestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: r.value
  }))

  return (
    <div className="w-full h-72 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
      {formattedData.length === 0 ? (
        <div className="h-full flex items-center justify-center text-slate-500 text-sm">
          No historical weather readings populated for this region yet.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formattedData} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
            <defs>
              <linearGradient id="weatherGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isRain ? '#06b6d4' : '#f59e0b'} stopOpacity={0.4} />
                <stop offset="95%" stopColor={isRain ? '#06b6d4' : '#f59e0b'} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
            <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
            <YAxis stroke="#94a3b8" fontSize={11} unit={` ${unit}`} tickLine={false} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
              formatter={(val: any) => [`${val} ${unit}`, 'Weather Value']}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={isRain ? '#06b6d4' : '#f59e0b'}
              strokeWidth={2}
              fill="url(#weatherGrad)"
            />

            {thresholdLow !== undefined && (
              <ReferenceLine
                y={thresholdLow}
                stroke="#10b981"
                strokeDasharray="4 4"
                label={{ value: `Threshold: ${thresholdLow} ${unit}`, fill: '#10b981', fontSize: 10 }}
              />
            )}

            {thresholdHigh && (
              <ReferenceLine
                y={thresholdHigh}
                stroke="#8b5cf6"
                strokeDasharray="4 4"
                label={{ value: `Cap: ${thresholdHigh} ${unit}`, fill: '#8b5cf6', fontSize: 10 }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
