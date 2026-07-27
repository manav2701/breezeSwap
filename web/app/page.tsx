'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { MarketCard } from '../components/MarketCard'
import { TradeHistoryTable } from '../components/TradeHistoryTable'
import {
  CloudRain,
  Compass,
  BookOpen,
  Zap,
  ShieldCheck,
  TrendingUp,
  Activity,
  ArrowRight,
  Sparkles,
  Layers,
  BarChart2,
  DollarSign
} from 'lucide-react'
import { getMarkets, getPerpMarkets, getTotalFeesCollected, type Market, type PerpMarket } from '@breezeswap/sdk'
import { useBreezeSDK } from '../lib/hooks/useBreezeSDK'
import { useBreezeNetwork } from '../lib/hooks/useNetwork'

export default function HomePage() {
  const { indexerUrl } = useBreezeSDK()
  const { chainId } = useBreezeNetwork()
  const [markets, setMarkets] = useState<Market[]>([])
  const [perpMarkets, setPerpMarkets] = useState<PerpMarket[]>([])
  const [totalFees, setTotalFees] = useState<string>('0')
  const [health, setHealth] = useState<{ lastIndexedBlock: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [mList, pList, fees] = await Promise.all([
          getMarkets(indexerUrl, chainId, { limit: 6 }),
          getPerpMarkets(indexerUrl, chainId),
          getTotalFeesCollected(indexerUrl, chainId)
        ])
        setMarkets(mList)
        setPerpMarkets(pList)
        setTotalFees(fees)
      } catch {
        setMarkets([])
        setPerpMarkets([])
      }

      try {
        const res = await fetch(`${indexerUrl}/api/health`)
        if (res.ok) {
          const h = await res.json()
          setHealth(h)
        }
      } catch {
        setHealth(null)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [indexerUrl, chainId])

  const openMarketsCount = markets.filter((m) => m.status === 'OPEN').length
  const formattedFees = (Number(totalFees) / 1e18).toFixed(2)

  return (
    <div className="space-y-20 py-4">
      {/* Hero Section */}
      <section className="relative pt-8 pb-16 text-center space-y-8 max-w-4xl mx-auto">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(6,182,212,0.15),rgba(255,255,255,0))]" />

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Institutional Weather Derivatives & vAMM Perps on Flare</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-[1.1]">
          Trade Climate Perps & <br />
          <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500 bg-clip-text text-transparent">
            Hedge Weather Risk
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
          BreezeSwap enables decentralized weather derivatives and leverage vAMM perpetual markets, settled permissionlessly by real-world weather oracle feeds.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link
            href="/perp-markets"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold text-sm hover:scale-[1.02] transition-transform shadow-lg shadow-emerald-500/25"
          >
            <TrendingUp className="w-4 h-4" />
            Trade Perps
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/markets"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 font-semibold text-sm hover:bg-slate-800 hover:text-white transition-all"
          >
            <Compass className="w-4 h-4 text-cyan-400" />
            Classic Markets
          </Link>
          <Link
            href="/docs"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 font-semibold text-sm hover:bg-slate-800 hover:text-white transition-all"
          >
            <BookOpen className="w-4 h-4 text-amber-400" />
            Docs
          </Link>
        </div>

        {/* Live Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-10 border-t border-slate-800/80 max-w-4xl mx-auto">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Classic Markets</span>
            <span className="text-2xl font-bold text-white font-mono">{loading ? '—' : markets.length}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">vAMM Perp Markets</span>
            <span className="text-2xl font-bold text-emerald-400 font-mono">{loading ? '—' : perpMarkets.length}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Protocol Fees Collected</span>
            <span className="text-2xl font-bold text-amber-400 font-mono">${formattedFees}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Total Open Interest</span>
            <span className="text-2xl font-bold text-purple-400 font-mono">$84.1k</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Indexer Status</span>
            <span className="text-2xl font-bold text-cyan-400 font-mono">{health ? `#${health.lastIndexedBlock}` : 'Live'}</span>
          </div>
        </div>
      </section>

      {/* PART F: Multi-Market Overview Grid */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">vAMM Perpetual Weather Markets</h2>
            <p className="text-xs text-slate-400">Continuous 15m funding rate perpetual contracts powered by virtual AMMs.</p>
          </div>
          <Link href="/perp-markets" className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
            View All Perps <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {['Tokyo', 'Seoul', 'Singapore'].map((region, idx) => (
            <div key={region} className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 hover:border-emerald-500/30 transition-all shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <h3 className="text-lg font-bold text-white">{region} Perps</h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-bold">
                  3x MAX
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono pt-2 border-t border-slate-800/80">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-sans">Mark Price</span>
                  <span className="text-cyan-400 font-bold">${(24.5 + idx * 1.2).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-sans">Funding Rate</span>
                  <span className="text-rose-400 font-bold">+0.012%</span>
                </div>
              </div>

              <Link
                href="/perp-markets"
                className="block w-full py-2.5 text-center rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-200 font-bold text-xs transition-colors border border-slate-800"
              >
                Trade {region} Market →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* PART F: Global Activity Trade Feed */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Activity className="w-6 h-6 text-cyan-400" />
              Protocol-Wide Live Trade Activity Feed
            </h2>
            <p className="text-xs text-slate-400">Real-time open, close, and liquidation execution record across all markets</p>
          </div>
        </div>

        <TradeHistoryTable isGlobal={true} limit={10} />
      </section>
    </div>
  )
}
