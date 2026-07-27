'use client'

import React, { useEffect, useState } from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts'
import { getMarkPriceCandles, getMarkPriceHistory, type OHLCCandle } from '@breezeswap/sdk'
import { useBreezeSDK } from '../lib/hooks/useBreezeSDK'
import { useBreezeNetwork } from '../lib/hooks/useNetwork'

interface MarkPriceChartProps {
  marketAddress: string
}

export function MarkPriceChart({ marketAddress }: MarkPriceChartProps) {
  const { indexerUrl } = useBreezeSDK()
  const { chainId } = useBreezeNetwork()
  const [interval, setIntervalState] = useState<'5m' | '15m' | '1h'>('5m')
  const [candles, setCandles] = useState<OHLCCandle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadCandles() {
      try {
        const data = await getMarkPriceCandles(indexerUrl, marketAddress, interval, 100, chainId)
        setCandles(data)
      } catch (err) {
        console.warn('MarkPriceChart fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    loadCandles()
    const timer = setInterval(loadCandles, 20_000)
    return () => clearInterval(timer)
  }, [indexerUrl, marketAddress, interval, chainId])

  const chartData = candles.map((c) => ({
    time: new Date(c.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    price: c.close,
    high: c.high,
    low: c.low,
    open: c.open
  }))

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-4 shadow-xl">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight">Mark Price Historical Trajectory</h3>
          <p className="text-[11px] text-slate-400">Aggregated vAMM mark price snapshots over time</p>
        </div>

        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold font-mono">
          {(['5m', '15m', '1h'] as const).map((int) => (
            <button
              key={int}
              onClick={() => setIntervalState(int)}
              className={`px-3 py-1 rounded-lg transition-all ${
                interval === int
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {int}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 w-full">
        {loading ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-500 animate-pulse">
            Loading mark price data...
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-500">
            No mark price history available for this market yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="markPriceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} />
              <YAxis stroke="#475569" fontSize={10} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '8px', fontSize: '11px' }}
                formatter={(val: any) => [`$${Number(val).toFixed(2)}`, 'Mark Price']}
              />
              <Area type="monotone" dataKey="price" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#markPriceGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
