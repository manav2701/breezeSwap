'use client'

import React, { useEffect, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, Cell, Tooltip, XAxis, YAxis } from 'recharts'
import { getFundingHistory, type FundingHistoryItem } from '@breezeswap/sdk'
import { useBreezeSDK } from '../lib/hooks/useBreezeSDK'
import { useBreezeNetwork } from '../lib/hooks/useNetwork'

interface FundingRateSparklineProps {
  marketAddress: string
}

export function FundingRateSparkline({ marketAddress }: FundingRateSparklineProps) {
  const { indexerUrl } = useBreezeSDK()
  const { chainId } = useBreezeNetwork()
  const [history, setHistory] = useState<FundingHistoryItem[]>([])

  useEffect(() => {
    async function loadFunding() {
      try {
        const data = await getFundingHistory(indexerUrl, marketAddress, chainId)
        setHistory(data)
      } catch (err) {
        console.warn('FundingRateSparkline error:', err)
      }
    }
    loadFunding()
  }, [indexerUrl, marketAddress, chainId])

  if (history.length === 0) return null

  const chartData = history
    .slice(0, 24)
    .reverse()
    .map((item) => {
      const rateBps = Number(item.fundingRate || 0)
      const ratePercent = rateBps / 10000
      return {
        time: item.settledAt ? new Date(item.settledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        rate: ratePercent
      }
    })

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-2 shadow-lg">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
        <span>Historical Funding Rate Settlement (Last 24 Periods)</span>
        <span className="text-[10px] text-slate-500 font-mono">Green = Negative / Shorts pay Longs</span>
      </div>

      <div className="h-20 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
            <XAxis dataKey="time" hide />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '8px', fontSize: '11px' }}
              formatter={(value: any) => [`${Number(value).toFixed(4)}%`, 'Funding Rate']}
            />
            <Bar dataKey="rate">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.rate < 0 ? '#10b981' : entry.rate > 0 ? '#f43f5e' : '#64748b'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
