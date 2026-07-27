'use client'

import React, { useEffect, useState, use } from 'react'
import { useAccount } from 'wagmi'
import { TrendingUp, Zap, Clock, ShieldCheck, ArrowUpRight, ArrowDownRight, RefreshCw, BarChart2, Layers } from 'lucide-react'
import {
  getPerpMarket, getPerpMarketPositions, calculatePerpQuote, openPerpPosition, closePerpPosition,
  type PerpMarket, type PerpPosition, type Reserves
} from '@breezeswap/sdk'
import { useBreezeSDK } from '../../../lib/hooks/useBreezeSDK'
import { useBreezeNetwork } from '../../../lib/hooks/useNetwork'
import { TxLink } from '../../../components/TxLink'
import { PerpStatsHeader } from '../../../components/PerpStatsHeader'
import { FundingRateSparkline } from '../../../components/FundingRateSparkline'
import { MarkPriceChart } from '../../../components/MarkPriceChart'
import { DepthLadder } from '../../../components/DepthLadder'
import { TradeHistoryTable } from '../../../components/TradeHistoryTable'

export default function PerpMarketDetailPage({ params }: { params: Promise<{ address: string }> }) {
  const resolvedParams = use(params)
  const marketAddress = resolvedParams.address as `0x${string}`

  const { address, isConnected } = useAccount()
  const { indexerUrl, walletClient, publicClient } = useBreezeSDK()
  const { chainId } = useBreezeNetwork()

  const [market, setMarket] = useState<PerpMarket | null>(null)
  const [positions, setPositions] = useState<PerpPosition[]>([])
  const [loading, setLoading] = useState(true)

  // Form states
  const [isLong, setIsLong] = useState(true)
  const [collateralInput, setCollateralInput] = useState('100')
  const [leverage, setLeverage] = useState(2)
  const [submitting, setSubmitting] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)

  // Default virtual reserves for quote calculation (1M collateral, 40k size)
  const mockReserves: Reserves = {
    collateralReserve: 1_000_000n * 10n ** 18n,
    weatherReserve: 40_000n * 10n ** 18n
  }

  const colInWei = BigInt(Math.round((parseFloat(collateralInput) || 0) * 1e6)) * 10n ** 12n
  const quote = calculatePerpQuote(mockReserves, colInWei, leverage, isLong, 10)

  useEffect(() => {
    async function loadDetail() {
      setLoading(true)
      try {
        const [m, pos] = await Promise.all([
          getPerpMarket(indexerUrl, marketAddress, chainId),
          getPerpMarketPositions(indexerUrl, marketAddress, chainId)
        ])
        if (m) setMarket(m)
        setPositions(pos)
      } catch (err) {
        console.warn('Perp detail load fallback:', err)
      } finally {
        setLoading(false)
      }
    }
    loadDetail()
  }, [indexerUrl, marketAddress, chainId])

  async function handleOpenTrade() {
    if (!walletClient || !publicClient) return
    setSubmitting(true)
    setTxHash(null)
    try {
      const colWei = BigInt(Math.round(parseFloat(collateralInput) * 1e6))
      const hash = await openPerpPosition(
        walletClient as any,
        publicClient as any,
        marketAddress,
        isLong,
        colWei,
        BigInt(leverage)
      )
      setTxHash(hash)
    } catch (err: any) {
      alert(err?.shortMessage || err?.message || 'Open position failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8 py-4">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-3">
          <span className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <TrendingUp className="w-7 h-7" />
          </span>
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              {market?.regionName || 'Tokyo'} vAMM Perpetual Market
            </h1>
            <span className="text-xs font-mono text-cyan-400">{marketAddress}</span>
          </div>
        </div>

        <span className="px-3.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-xs font-bold w-fit flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          ACTIVE vAMM PERPETUAL
        </span>
      </div>

      {/* PART B.2: Institutional Stats Header */}
      <PerpStatsHeader marketAddress={marketAddress} />

      {/* PART B.3: Funding Rate Sparkline */}
      <FundingRateSparkline marketAddress={marketAddress} />

      {/* Main Grid: Chart & Depth + Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column (2/3): Chart, Depth Ladder, Trade History */}
        <div className="lg:col-span-2 space-y-8">
          {/* PART D: Mark Price Historical Chart */}
          <MarkPriceChart marketAddress={marketAddress} />

          {/* PART C.1: Depth & Liquidity Ladder */}
          <DepthLadder reserves={mockReserves} tradingFeeBps={10} />

          {/* PART A.3: Market Trade History Table */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-cyan-400" />
              Live Trade Activity Feed
            </h3>
            <TradeHistoryTable marketAddress={marketAddress} limit={30} />
          </div>
        </div>

        {/* Right Column (1/3): Trade Terminal */}
        <div className="lg:col-span-1">
          <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-5 sticky top-24 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Execute vAMM Trade</h3>

            {/* Long / Short Toggle */}
            <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-bold">
              <button
                onClick={() => setIsLong(true)}
                className={`py-2.5 rounded-xl transition-all ${
                  isLong ? 'bg-emerald-500 text-slate-950 shadow-lg font-extrabold' : 'text-slate-400 hover:text-white'
                }`}
              >
                LONG ↗
              </button>
              <button
                onClick={() => setIsLong(false)}
                className={`py-2.5 rounded-xl transition-all ${
                  !isLong ? 'bg-rose-500 text-slate-950 shadow-lg font-extrabold' : 'text-slate-400 hover:text-white'
                }`}
              >
                SHORT ↘
              </button>
            </div>

            {/* Collateral Input */}
            <div className="space-y-1.5 text-xs">
              <label className="text-slate-400 font-semibold">Margin Collateral (bUSDT / mUSDT)</label>
              <input
                type="number"
                value={collateralInput}
                onChange={(e) => setCollateralInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-xs font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Leverage Slider */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <label className="text-slate-400 font-semibold">Leverage Multiplier</label>
                <span className="font-mono font-bold text-cyan-400">{leverage}x</span>
              </div>
              <input
                type="range"
                min="1"
                max="3"
                step="1"
                value={leverage}
                onChange={(e) => setLeverage(Number(e.target.value))}
                className="w-full accent-cyan-400"
              />
            </div>

            {/* PART C.2: Live Trade Preview & Slippage Box */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs font-mono text-slate-400">
              <div className="flex items-center justify-between">
                <span>Posted Margin:</span>
                <span className="text-white font-bold">{parseFloat(collateralInput) || 0} USDT</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Trading Fee (0.10%):</span>
                <span className="text-rose-400 font-bold">-{(Number(quote.feeAmount) / 1e6).toFixed(2)} USDT</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-800/80 pt-2">
                <span>Net Position Margin:</span>
                <span className="text-emerald-400 font-bold">{(Number(quote.netCollateral) / 1e6).toFixed(2)} USDT</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Notional Position Size:</span>
                <span className="text-white font-bold">${((Number(quote.netCollateral) / 1e6) * leverage).toFixed(2)} USD</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Est. Entry Price:</span>
                <span className="text-cyan-400 font-bold">${quote.entryPrice.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-800/80 pt-2">
                <span>Slippage Impact:</span>
                <span className={`font-bold ${quote.priceImpactBps > 100 ? 'text-rose-400' : 'text-amber-400'}`}>
                  {(quote.priceImpactBps / 100).toFixed(2)}%
                </span>
              </div>
            </div>

            <button
              onClick={handleOpenTrade}
              disabled={submitting || !isConnected}
              className={`w-full py-3.5 rounded-2xl font-bold text-xs text-slate-950 transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                isLong ? 'bg-emerald-400 hover:bg-emerald-300 shadow-lg shadow-emerald-500/20' : 'bg-rose-400 hover:bg-rose-300 shadow-lg shadow-rose-500/20'
              }`}
            >
              {submitting ? 'Submitting Trade...' : `Open ${isLong ? 'Long' : 'Short'} ${leverage}x Position`}
            </button>

            {txHash && (
              <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-800/50 text-xs text-emerald-300 flex items-center justify-between">
                <span>Trade submitted successfully!</span>
                <TxLink hash={txHash} />
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
