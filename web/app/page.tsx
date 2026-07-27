'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { MarketCard } from '../components/MarketCard'
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
  Layers
} from 'lucide-react'
import { getMarkets, type Market } from '@breezeswap/sdk'
import { useBreezeSDK } from '../lib/hooks/useBreezeSDK'
import { useBreezeNetwork } from '../lib/hooks/useNetwork'

export default function HomePage() {
  const { indexerUrl } = useBreezeSDK()
  const { chainId } = useBreezeNetwork()
  const [markets, setMarkets] = useState<Market[]>([])
  const [health, setHealth] = useState<{ lastIndexedBlock: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getMarkets(indexerUrl, chainId, { limit: 6 })
        setMarkets(data)
      } catch {
        setMarkets([])
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

  return (
    <div className="space-y-20">
      {/* Hero Section */}
      <section className="relative pt-12 pb-16 text-center space-y-8 max-w-4xl mx-auto">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(6,182,212,0.15),rgba(255,255,255,0))]" />

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>First Weather Derivatives Protocol on Flare Network</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-[1.1]">
          Trade Climate Futures & <br />
          <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500 bg-clip-text text-transparent">
            Hedge Weather Risk
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
          BreezeSwap enables decentralized weather derivative markets settled automatically by verified Open-Meteo real oracle data on Flare Coston2.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link
            href="/markets"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-sm hover:scale-[1.02] transition-transform shadow-lg shadow-cyan-500/25"
          >
            <Compass className="w-4 h-4" />
            Browse Markets
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/docs"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 font-semibold text-sm hover:bg-slate-800 hover:text-white transition-all"
          >
            <BookOpen className="w-4 h-4 text-amber-400" />
            Read Protocol Docs
          </Link>
        </div>

        {/* Live Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-10 border-t border-slate-800/80 max-w-4xl mx-auto">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Total Markets</span>
            <span className="text-2xl font-bold text-white font-mono">{loading ? '—' : markets.length}</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Open Markets</span>
            <span className="text-2xl font-bold text-emerald-400 font-mono">{loading ? '—' : openMarketsCount}</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Protocol Fees</span>
            <span className="text-2xl font-bold text-amber-400 font-mono">0.10%</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Oracle Region Feeds</span>
            <span className="text-2xl font-bold text-purple-400 font-mono">5 Cities</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Indexer Last Block</span>
            <span className="text-2xl font-bold text-cyan-400 font-mono">{health ? `#${health.lastIndexedBlock}` : 'Live'}</span>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">How BreezeSwap Works</h2>
          <p className="text-sm text-slate-400">Three simple steps to hedge climate volatility or trade weather positions.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4 hover:border-slate-700 transition-all">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Compass className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">1. Select a Weather Market</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Pick a region (Tokyo, Seoul, Singapore, Dubai, London), weather metric (Rainfall or Temperature), and choose LONG or SHORT based on threshold parameters.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4 hover:border-slate-700 transition-all">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">2. Mint Position Token</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Deposit collateral (mUSDT or FTestXRP) into the market vault to mint an ERC-1155 position token representing your payout claim.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4 hover:border-slate-700 transition-all">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">3. Oracle Settlement</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              At market expiry, Flare oracle feeds submit final weather readings. Payouts are calculated mathematically and redeemed permissionlessly.
            </p>
          </div>
        </div>
      </section>

      {/* Why BreezeSwap Section */}
      <section className="p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-white">Why BreezeSwap on Flare?</h2>
            <p className="text-xs text-slate-400">Built for institutional weather risk management and retail climate hedging.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <h4 className="text-sm font-bold text-white">Instant Settlement</h4>
            <p className="text-xs text-slate-400">No insurance claims adjusters or waiting weeks for payouts.</p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h4 className="text-sm font-bold text-white">Trustless & On-Chain</h4>
            <p className="text-xs text-slate-400">Automated by open-source smart contracts on Flare Coston2.</p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            <h4 className="text-sm font-bold text-white">Transferable Tokens</h4>
            <p className="text-xs text-slate-400">Positions are ERC-1155 tokens that can be transferred or sold prior to settlement.</p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
            <Activity className="w-5 h-5 text-purple-400" />
            <h4 className="text-sm font-bold text-white">Real Weather Data</h4>
            <p className="text-xs text-slate-400">Grounded in historical Open-Meteo rainfall and temperature numbers.</p>
          </div>
        </div>
      </section>

      {/* Featured / Recent Markets */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Active Markets</h2>
            <p className="text-xs text-slate-400">Live weather derivative contracts on Flare Coston2 testnet.</p>
          </div>
          <Link href="/markets" className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
            View All Markets <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {markets.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400 text-sm">
            No live markets retrieved yet. Launch the indexer or click &quot;Create Market&quot; to deploy one!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {markets.slice(0, 3).map((m) => (
              <MarketCard key={m.contractAddress} market={m} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
