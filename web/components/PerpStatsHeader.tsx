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
  const oiSkew = stats?.oiSkewPercent ?? 50

  return (
    <div className="glass-panel p-6 sm:p-8 space-y-6">
      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-6 font-mono">
        {/* Mark Price */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-sans uppercase font-bold text-slate-400">
            <Activity className="w-4 h-4 text-[#fde047]" />
            <span>Mark Price</span>
          </div>
          <div className="text-2xl font-black text-[#fde047] tracking-tight">
            ${stats ? stats.markPrice : '0.00'}
          </div>
        </div>

        {/* Oracle Price */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-sans uppercase font-bold text-slate-400">
            <Layers className="w-4 h-4 text-sky-400" />
            <span>Oracle Price</span>
          </div>
          <div className="text-2xl font-black text-white">
            ${stats ? stats.oraclePrice : '0.00'}
          </div>
        </div>

        {/* Funding Rate */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-sans uppercase font-bold text-slate-400">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>Funding Rate / 15m</span>
          </div>
          <div
            className={`text-2xl font-black ${
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
          <div className="flex items-center gap-1.5 text-[10px] font-sans uppercase font-bold text-slate-400">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Next Funding</span>
          </div>
          <div className="text-2xl font-black text-[#fde047] animate-pulse">
            {countdown}
          </div>
        </div>

        {/* 24h Volume */}
        <div className="space-y-1 hidden lg:block">
          <div className="flex items-center gap-1.5 text-[10px] font-sans uppercase font-bold text-slate-400">
            <DollarSign className="w-4 h-4 text-purple-400" />
            <span>24h Volume</span>
          </div>
          <div className="text-2xl font-black text-purple-300">
            ${stats ? Number(stats.totalVolume24h).toLocaleString() : '0'}
          </div>
        </div>
      </div>

      {/* Bottom Row: Open Interest Ratio Bar */}
      <div className="border-t border-white/10 pt-4 space-y-2 font-mono">
        <div className="flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400">Long OI: ${stats ? Number(stats.openInterestLong).toLocaleString() : '0'}</span>
            <span className="text-slate-400 text-[10px]">({oiSkew.toFixed(1)}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[10px]">({(100 - oiSkew).toFixed(1)}%)</span>
            <span className="text-rose-400">Short OI: ${stats ? Number(stats.openInterestShort).toLocaleString() : '0'}</span>
          </div>
        </div>

        {/* Two-color OI Skew Bar */}
        <div className="w-full h-3 rounded-full bg-black/80 p-0.5 overflow-hidden border border-white/10 flex">
          <div
            className="h-full bg-emerald-500 rounded-l-full transition-all duration-500"
            style={{ width: `${oiSkew}%` }}
          />
          <div
            className="h-full bg-rose-500 rounded-r-full transition-all duration-500"
            style={{ width: `${100 - oiSkew}%` }}
          />
        </div>
      </div>
    </div>
  )
}
