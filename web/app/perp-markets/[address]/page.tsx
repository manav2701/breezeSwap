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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="flex items-center gap-3">
          <span className="p-3 rounded-2xl bg-[#fde047] text-black shadow-lg shadow-yellow-500/20">
            <TrendingUp className="w-7 h-7" />
          </span>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight uppercase">
              {market?.regionName || 'Tokyo'} vAMM Perpetual
            </h1>
            <span className="text-xs font-mono text-[#fde047]">{marketAddress}</span>
          </div>
        </div>

        <span className="px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-xs font-bold w-fit flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          ACTIVE vAMM PERPETUAL
        </span>
      </div>

      {/* Institutional Stats Header */}
      <PerpStatsHeader marketAddress={marketAddress} />

      {/* Funding Rate Sparkline */}
      <FundingRateSparkline marketAddress={marketAddress} />

      {/* Main Grid: Chart & Depth + Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column (2/3): Chart, Depth Ladder, Trade History */}
        <div className="lg:col-span-2 space-y-8">
          {/* Mark Price Historical Chart */}
          <MarkPriceChart marketAddress={marketAddress} />

          {/* Depth & Liquidity Ladder */}
          <DepthLadder reserves={mockReserves} tradingFeeBps={10} />

          {/* Market Trade History Table */}
          <div className="space-y-4">
            <h3 className="text-base font-black text-white tracking-tight uppercase flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-[#fde047]" />
              Live Trade Activity Feed
            </h3>
            <TradeHistoryTable marketAddress={marketAddress} limit={30} />
          </div>
        </div>

        {/* Right Column (1/3): Trade Terminal */}
        <div className="lg:col-span-1">
          <div className="glass-panel p-6 sm:p-8 space-y-6 sticky top-24">
            <h3 className="text-lg font-black uppercase text-white tracking-tight">Execute vAMM Trade</h3>

            {/* Long / Short Pill Toggle */}
            <div className="grid grid-cols-2 gap-2 p-1.5 rounded-full bg-black/80 border border-white/10 text-xs font-black">
              <button
                onClick={() => setIsLong(true)}
                className={`py-3 rounded-full transition-all ${
                  isLong ? 'bg-emerald-500 text-black shadow-lg font-extrabold' : 'text-slate-400 hover:text-white'
                }`}
              >
                LONG ↗
              </button>
              <button
                onClick={() => setIsLong(false)}
                className={`py-3 rounded-full transition-all ${
                  !isLong ? 'bg-rose-500 text-black shadow-lg font-extrabold' : 'text-slate-400 hover:text-white'
                }`}
              >
                SHORT ↘
              </button>
            </div>

            {/* Collateral Input */}
            <div className="space-y-2 text-xs">
              <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Margin Collateral (USDT)</label>
              <input
                type="number"
                value={collateralInput}
                onChange={(e) => setCollateralInput(e.target.value)}
                className="w-full bg-black/80 border border-white/10 text-white rounded-2xl p-4 text-sm font-mono focus:outline-none focus:border-[#fde047] font-bold"
              />
            </div>

            {/* Leverage Slider */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Leverage Multiplier</label>
                <span className="font-mono font-extrabold text-[#fde047]">{leverage}x</span>
              </div>
              <input
                type="range"
                min="1"
                max="3"
                step="1"
                value={leverage}
                onChange={(e) => setLeverage(Number(e.target.value))}
                className="w-full accent-[#fde047]"
              />
            </div>

            {/* Live Trade Preview & Slippage Box */}
            <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-2.5 text-xs font-mono text-slate-300">
              <div className="flex items-center justify-between">
                <span>Posted Margin:</span>
                <span className="text-white font-bold">{parseFloat(collateralInput) || 0} USDT</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Trading Fee (0.10%):</span>
                <span className="text-rose-400 font-bold">-{(Number(quote.feeAmount) / 1e6).toFixed(2)} USDT</span>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 pt-2">
                <span>Net Position Margin:</span>
                <span className="text-emerald-400 font-bold">{(Number(quote.netCollateral) / 1e6).toFixed(2)} USDT</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Notional Position Size:</span>
                <span className="text-white font-bold">${((Number(quote.netCollateral) / 1e6) * leverage).toFixed(2)} USD</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Est. Entry Price:</span>
                <span className="text-[#fde047] font-bold">${quote.entryPrice.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 pt-2">
                <span>Slippage Impact:</span>
                <span className={`font-bold ${quote.priceImpactBps > 100 ? 'text-rose-400' : 'text-amber-400'}`}>
                  {(quote.priceImpactBps / 100).toFixed(2)}%
                </span>
              </div>
            </div>

            <button
              onClick={handleOpenTrade}
              disabled={submitting || !isConnected}
              className={`w-full py-4 rounded-full font-black text-xs uppercase tracking-wider text-black transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                isLong ? 'bg-emerald-400 hover:bg-emerald-300 shadow-lg shadow-emerald-500/20' : 'bg-rose-400 hover:bg-rose-300 shadow-lg shadow-rose-500/20'
              }`}
            >
              {submitting ? 'Submitting Trade...' : `Open ${isLong ? 'Long' : 'Short'} ${leverage}x Position`}
            </button>

            {txHash && (
              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/50 text-xs text-emerald-300 flex items-center justify-between font-mono">
                <span>Trade submitted!</span>
                <TxLink hash={txHash} />
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
