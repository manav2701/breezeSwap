'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CloudRain,
  TrendingUp,
  Compass,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Activity,
  ChevronRight,
  Layers,
  Sparkles,
  RefreshCw
} from 'lucide-react'
import {
  getMarkets,
  getPerpMarkets,
  getGlobalTradeHistory,
  type Market,
  type PerpMarket,
  type TradeHistoryEntry
} from '@breezeswap/sdk'
import { useBreezeSDK } from '../lib/hooks/useBreezeSDK'
import { useBreezeNetwork } from '../lib/hooks/useNetwork'
import { MarketCard } from '../components/MarketCard'
import { TxLink } from '../components/TxLink'

export default function Home() {
  const { indexerUrl } = useBreezeSDK()
  const { chainId, isMainnet } = useBreezeNetwork()
  const chainName = isMainnet ? 'Flare Mainnet' : 'Coston2 Testnet'
  const [classicMarkets, setClassicMarkets] = useState<Market[]>([])
  const [perpMarkets, setPerpMarkets] = useState<PerpMarket[]>([])
  const [tradeHistory, setTradeHistory] = useState<TradeHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const [cMarkets, pMarkets, trades] = await Promise.all([
          getMarkets(indexerUrl, chainId),
          getPerpMarkets(indexerUrl, chainId),
          getGlobalTradeHistory(indexerUrl, 10, chainId)
        ])
        setClassicMarkets(cMarkets)
        setPerpMarkets(pMarkets)
        setTradeHistory(trades)
      } catch (err) {
        console.error('Failed to load landing data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
    const interval = setInterval(loadData, 15000)
    return () => clearInterval(interval)
  }, [indexerUrl, chainId])

  // Aggregate Total Open Interest
  const totalOpenInterest = perpMarkets.reduce(
    (acc, m) => acc + ((parseFloat(m.totalLongOpenInterest || '0') + parseFloat(m.totalShortOpenInterest || '0')) / 1e18),
    0
  )

  return (
    <div className="space-y-12 pb-16">
      {/* ============================================================ */}
      {/* 1. ASYMMETRICAL CYBER YELLOW LIQUID HERO SECTION             */}
      {/* ============================================================ */}
      <section className="relative w-full liquid-hero-bg p-8 sm:p-12 md:p-16 text-[#0a0a0a] shadow-2xl overflow-hidden">
        <div className="max-w-5xl space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black text-[#fde047] text-xs font-mono font-bold uppercase tracking-widest shadow-md">
            <Sparkles className="w-4 h-4 text-[#fde047]" />
            First Weather Perpetuals on Flare Network
          </div>

          <h1 className="text-5xl sm:text-7xl md:text-8xl font-extrabold tracking-tight uppercase leading-[0.95] text-[#0a0a0a]">
            Weather Risk,<br />
            <span className="underline decoration-black decoration-4 underline-offset-8">Zero Counterparty.</span>
          </h1>

          <p className="text-lg sm:text-xl font-medium text-[#0a0a0a]/90 max-w-2xl leading-relaxed">
            Hedge agricultural, energy, and climate exposure with fixed-term CME-style weather swaps and continuous vAMM weather perpetuals featuring 15-minute funding rates.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-4">
            <Link href="/perp-markets" className="btn-cyber-yellow bg-black text-white hover:bg-slate-900 px-8 py-4 text-sm uppercase tracking-wider font-extrabold flex items-center gap-2">
              Start Trading <ArrowUpRight className="w-5 h-5 text-[#fde047]" />
            </Link>
            <Link href="/markets" className="btn-onyx-outline px-8 py-4 text-sm uppercase tracking-wider font-extrabold">
              View Classic Markets
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 2. DUAL TERMINAL GRID: DEPTH LADDER & REAL-TIME ACTIVITY     */}
      {/* Strictly Bounded inside Glass Panels (No Spill / Overlays)  */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT: Depth Ladder Preview */}
        <div className="lg:col-span-5 glass-panel p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#fde047]" />
                <h3 className="text-sm font-extrabold uppercase tracking-widest text-white">vAMM Liquidity Ladder</h3>
              </div>
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono font-bold text-[#fde047] uppercase">
                Tokyo / Rainfall
              </span>
            </div>

            <div className="space-y-3 font-mono text-xs mb-8">
              <div className="flex justify-between items-center text-slate-400 uppercase text-[10px] font-sans font-bold pb-1 border-b border-white/5">
                <span>Notional Size</span>
                <span>Est. Entry Price</span>
                <span>Slippage</span>
              </div>
              <div className="flex justify-between items-center py-2 px-3 rounded-xl bg-white/5 border border-white/5 text-slate-200">
                <span className="font-bold text-white">$1,000</span>
                <span>$25.02</span>
                <span className="text-emerald-400 font-bold">0.08%</span>
              </div>
              <div className="flex justify-between items-center py-2 px-3 rounded-xl bg-white/5 border border-white/5 text-slate-200">
                <span className="font-bold text-white">$5,000</span>
                <span>$25.10</span>
                <span className="text-emerald-400 font-bold">0.40%</span>
              </div>
              <div className="flex justify-between items-center py-2 px-3 rounded-xl bg-white/5 border border-white/5 text-slate-200">
                <span className="font-bold text-white">$10,000</span>
                <span>$25.25</span>
                <span className="text-amber-400 font-bold">1.00%</span>
              </div>
              <div className="flex justify-between items-center py-2 px-3 rounded-xl bg-white/5 border border-white/5 text-slate-200">
                <span className="font-bold text-white">$25,000</span>
                <span>$25.62</span>
                <span className="text-rose-400 font-bold">2.48%</span>
              </div>
            </div>
          </div>

          <Link href="/perp-markets" className="w-full btn-cyber-yellow py-3.5 text-center text-xs uppercase tracking-widest font-extrabold flex items-center justify-center gap-2">
            Open Trade Console <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* RIGHT: Real-Time Protocol Trade Activity Feed */}
        <div className="lg:col-span-7 glass-panel p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-extrabold uppercase tracking-widest text-white">Real-Time Protocol Activity</h3>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono font-bold text-emerald-400 uppercase">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Feed
              </span>
            </div>

            {loading ? (
              <div className="py-12 flex justify-center text-slate-500 font-mono text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mr-2 text-[#fde047]" /> Syncing on-chain activity...
              </div>
            ) : tradeHistory.length === 0 ? (
              <div className="py-12 text-center text-slate-500 font-mono text-xs">
                No recent trades recorded on {chainName}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] font-mono font-bold uppercase text-slate-400">
                      <th className="py-2 px-3">Trader</th>
                      <th className="py-2 px-3">Action</th>
                      <th className="py-2 px-3">Side</th>
                      <th className="py-2 px-3">Size</th>
                      <th className="py-2 px-3">Price</th>
                      <th className="py-2 px-3 text-right">Tx</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-xs">
                    {tradeHistory.slice(0, 5).map((t, idx) => (
                      <tr key={idx} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-3 text-[#fde047] font-bold">
                          {t.trader ? `${t.trader.slice(0, 6)}...${t.trader.slice(-4)}` : '0x...'}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            t.type === 'OPEN'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : t.type === 'LIQUIDATION'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          }`}>
                            {t.type}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold">
                          <span className={t.side === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}>
                            {t.side}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-white font-bold">${Number(t.size).toLocaleString()}</td>
                        <td className="py-3 px-3 text-slate-300">${t.price}</td>
                        <td className="py-3 px-3 text-right">
                          <TxLink hash={t.txHash} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-white/10 mt-6 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">Total Protocol OI: <strong className="text-[#fde047]">${totalOpenInterest.toLocaleString()}</strong></span>
            <Link href="/perp-markets" className="text-[#fde047] font-bold hover:underline inline-flex items-center gap-1">
              View All Perp Markets <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. HIGH-IMPACT FEATURE CARDS                                 */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Card A: Cyber Yellow Feature Card */}
        <div className="bg-[#fde047] text-[#0a0a0a] rounded-3xl p-8 sm:p-10 shadow-2xl flex flex-col justify-between space-y-6">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center mb-6">
              <ShieldCheck className="w-6 h-6 text-[#fde047]" />
            </div>
            <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tight leading-tight">
              Permissionless Risk Settlement
            </h3>
            <p className="text-sm font-medium text-[#0a0a0a]/90 mt-3 leading-relaxed">
              Trade directly from your self-custodial wallet with zero centralized margin keepers. Automatic oracle settlements powered by Flare Data Connector.
            </p>
          </div>
          <Link href="/docs" className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider underline underline-offset-4">
            Inspect Audit Docs <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Card B: Glassmorphic Ultra-Low Slippage Card */}
        <div className="glass-panel p-8 sm:p-10 flex flex-col justify-between space-y-6">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-6">
              <Zap className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white leading-tight">
              Constant-Product vAMM Liquidity
            </h3>
            <p className="text-sm text-slate-300 mt-3 leading-relaxed">
              Synthetic reserve curves ($x \cdot y = k$) ensure continuous liquidity even when traditional insurance counterparties are unavailable.
            </p>
          </div>
          <Link href="/perp-markets" className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#fde047] hover:underline">
            Explore Perpetuals <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 4. ACTIVE MARKET DIRECTORIES                                */}
      {/* ============================================================ */}
      <section className="space-y-6 pt-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-white">Featured Weather Markets</h2>
            <p className="text-xs text-slate-400 mt-1">Live binary and linear options contracts on {chainName}</p>
          </div>
          <Link href="/markets" className="btn-cyber-yellow px-5 py-2 text-xs uppercase tracking-wider font-extrabold">
            All Markets
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-panel p-6 h-48 animate-pulse bg-white/5" />
            ))}
          </div>
        ) : classicMarkets.length === 0 ? (
          <div className="glass-panel p-12 text-center text-slate-400 font-mono text-sm">
            No active classic markets found on {chainName}.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {classicMarkets.slice(0, 3).map((m) => (
              <MarketCard key={m.contractAddress} market={m} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
