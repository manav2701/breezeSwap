'use client'

import React, { useEffect, useState } from 'react'
import { Activity, Clock, TrendingUp, DollarSign, Layers } from 'lucide-react'
import { getPerpMarketStats, type PerpMarketStatsData } from '@breezeswap/sdk'
import { useBreezeSDK } from '../lib/hooks/useBreezeSDK'
import { useBreezeNetwork } from '../lib/hooks/useNetwork'

interface PerpStatsHeaderProps {
  marketAddress: string
}

export function PerpStatsHeader({ marketAddress }: PerpStatsHeaderProps) {
  const { indexerUrl } = useBreezeSDK()
  const { chainId } = useBreezeNetwork()
  const [stats, setStats] = useState<PerpMarketStatsData | null>(null)
  const [countdown, setCountdown] = useState<string>('00:00')

  useEffect(() => {
    async function fetchStats() {
      try {
        const data = await getPerpMarketStats(indexerUrl, marketAddress, chainId)
        if (data) setStats(data)
      } catch (err) {
        console.warn('PerpStatsHeader error:', err)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 10_000)
    return () => clearInterval(interval)
  }, [indexerUrl, marketAddress, chainId])

  // Live countdown timer client-side
  useEffect(() => {
    if (!stats?.nextFundingAt) return

    const timer = setInterval(() => {
      const targetMs = new Date(stats.nextFundingAt).getTime()
      const diffSec = Math.max(0, Math.floor((targetMs - Date.now()) / 1000))

      const mins = Math.floor(diffSec / 60)
      const secs = diffSec % 60
      const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      setCountdown(formatted)
    }, 1000)

    return () => clearInterval(timer)
  }, [stats?.nextFundingAt])

  const fundingRateNum = stats ? Number(stats.currentFundingRate) : 0
  const isFundingPositive = fundingRateNum > 0
  const oiSkew = stats?.oiSkewPercent ?? 50

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl space-y-6">
      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4 font-mono">
        {/* Mark Price */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-[11px] font-sans text-slate-400 font-medium">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>Mark Price</span>
          </div>
          <div className="text-xl font-bold text-white tracking-tight">
            ${stats ? stats.markPrice : '0.00'}
          </div>
        </div>

        {/* Oracle Price */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-[11px] font-sans text-slate-400 font-medium">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span>Oracle Price</span>
          </div>
          <div className="text-xl font-bold text-slate-200">
            ${stats ? stats.oraclePrice : '0.00'}
          </div>
        </div>

        {/* Funding Rate */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-[11px] font-sans text-slate-400 font-medium">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Funding Rate / 15m</span>
          </div>
          <div
            className={`text-xl font-bold ${
              fundingRateNum < 0
                ? 'text-emerald-400'
                : fundingRateNum > 0
                ? 'text-rose-400'
                : 'text-slate-300'
            }`}
          >
            {fundingRateNum > 0 ? `+${stats?.currentFundingRate}%` : `${stats?.currentFundingRate || '0.0000'}%`}
          </div>
        </div>

        {/* Next Funding Countdown */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-[11px] font-sans text-slate-400 font-medium">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Next Funding</span>
          </div>
          <div className="text-xl font-bold text-amber-300 animate-pulse">
            {countdown}
          </div>
        </div>

        {/* 24h Volume */}
        <div className="space-y-1 hidden lg:block">
          <div className="flex items-center gap-1 text-[11px] font-sans text-slate-400 font-medium">
            <DollarSign className="w-3.5 h-3.5 text-purple-400" />
            <span>24h Volume</span>
          </div>
          <div className="text-xl font-bold text-purple-300">
            ${stats ? Number(stats.totalVolume24h).toLocaleString() : '0'}
          </div>
        </div>
      </div>

      {/* Bottom Row: Open Interest Bar */}
      <div className="border-t border-slate-800/80 pt-4 space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-mono">Long OI: ${stats ? Number(stats.openInterestLong).toLocaleString() : '0'}</span>
            <span className="text-slate-500 font-normal">({oiSkew.toFixed(1)}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-normal">({(100 - oiSkew).toFixed(1)}%)</span>
            <span className="text-rose-400 font-mono">Short OI: ${stats ? Number(stats.openInterestShort).toLocaleString() : '0'}</span>
          </div>
        </div>

        {/* Two-color OI Skew Bar */}
        <div className="w-full h-2.5 rounded-full bg-slate-950 p-0.5 overflow-hidden border border-slate-800 flex">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-l-full transition-all duration-500"
            style={{ width: `${oiSkew}%` }}
          />
          <div
            className="h-full bg-gradient-to-r from-rose-500 to-red-400 rounded-r-full transition-all duration-500"
            style={{ width: `${100 - oiSkew}%` }}
          />
        </div>
      </div>
    </div>
  )
}
