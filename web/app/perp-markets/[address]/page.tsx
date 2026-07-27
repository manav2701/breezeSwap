'use client'

import React, { useEffect, useState, use } from 'react'
import { useAccount } from 'wagmi'
import { TrendingUp, Zap, Clock, ShieldCheck, ArrowUpRight, ArrowDownRight, RefreshCw, BarChart2, CheckCircle2 } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import {
  getPerpMarket, getFundingHistory, getMarkPriceHistory, getPerpMarketPositions,
  calculatePerpQuote, openPerpPosition, closePerpPosition,
  CONTRACT_ADDRESSES, COSTON2_CHAIN_ID, type PerpMarket, type PerpPosition, type FundingHistoryItem, type MarkPriceHistoryItem
} from '@breezeswap/sdk'
import { useBreezeSDK } from '../../../lib/hooks/useBreezeSDK'
import { TxLink } from '../../../components/TxLink'

const CHART_MOCK = [
  { time: '12:00', price: 24.8 },
  { time: '12:15', price: 25.1 },
  { time: '12:30', price: 24.9 },
  { time: '12:45', price: 25.3 },
  { time: '13:00', price: 25.0 }
]

export default function PerpMarketDetailPage({ params }: { params: Promise<{ address: string }> }) {
  const resolvedParams = use(params)
  const marketAddress = resolvedParams.address as `0x${string}`

  const { address, isConnected } = useAccount()
  const { indexerUrl, walletClient, publicClient } = useBreezeSDK()

  const [market, setMarket] = useState<PerpMarket | null>(null)
  const [positions, setPositions] = useState<PerpPosition[]>([])
  const [fundingHistory, setFundingHistory] = useState<FundingHistoryItem[]>([])
  const [priceHistory, setPriceHistory] = useState<MarkPriceHistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  // Form states
  const [isLong, setIsLong] = useState(true)
  const [collateralInput, setCollateralInput] = useState('100')
  const [leverage, setLeverage] = useState(2)
  const [submitting, setSubmitting] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)

  // Simulated reserves for quote preview (1M collateral, 40k weather)
  const mockReserves = {
    collateralReserve: 1_000_000n * 10n ** 18n,
    weatherReserve: 40_000n * 10n ** 18n
  }

  const colInWei = BigInt(Math.round((parseFloat(collateralInput) || 0) * 1e6)) * 10n ** 12n
  const quote = calculatePerpQuote(mockReserves, colInWei, leverage, isLong)

  useEffect(() => {
    async function loadDetail() {
      setLoading(true)
      try {
        const [m, pos, fHist, pHist] = await Promise.all([
          getPerpMarket(indexerUrl, marketAddress),
          getPerpMarketPositions(indexerUrl, marketAddress),
          getFundingHistory(indexerUrl, marketAddress),
          getMarkPriceHistory(indexerUrl, marketAddress, 60)
        ])
        if (m) setMarket(m)
        setPositions(pos)
        setFundingHistory(fHist)
        setPriceHistory(pHist)
      } catch (err) {
        console.warn('Perp detail load fallback:', err)
      } finally {
        setLoading(false)
      }
    }
    loadDetail()
  }, [indexerUrl, marketAddress])

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

  async function handleCloseTrade(posId: string) {
    if (!walletClient || !publicClient) return
    try {
      await closePerpPosition(walletClient as any, publicClient as any, marketAddress, BigInt(posId))
      alert('Close transaction submitted!')
    } catch (err: any) {
      alert(err?.shortMessage || err?.message || 'Close position failed')
    }
  }

  return (
    <div className="space-y-8">
      {/* Header & Stats Bar */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold text-white">
                {market?.regionName || 'Tokyo'} vAMM Perpetual Weather Market
              </h1>
              <span className="text-xs font-mono text-slate-400">{marketAddress}</span>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-xs font-bold w-fit">
            ACTIVE vAMM
          </span>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-800/80">
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Mark Price</span>
            <span className="text-xl font-bold text-cyan-400 font-mono">25.00</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Oracle Price</span>
            <span className="text-xl font-bold text-slate-200 font-mono">25.00</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Funding (15m Rate)</span>
            <span className="text-xl font-bold text-rose-400 font-mono">+0.05%</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Open Interest (L/S)</span>
            <span className="text-sm font-bold text-slate-200 font-mono">55% Long / 45% Short</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Chart + Trade Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Chart Column (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-cyan-400" />
                Live Mark Price Chart
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">Constant Product Curve (x · y = k)</span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={CHART_MOCK}>
                  <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
                  <YAxis domain={['auto', 'auto']} stroke="#64748b" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', borderRadius: '12px' }} />
                  <Line type="monotone" dataKey="price" stroke="#38bdf8" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Position History Table */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Market Trade Activity</h3>
            {positions.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No trades recorded on this perp market yet.</p>
            ) : (
              <div className="space-y-2">
                {positions.map((p) => (
                  <div key={p.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.isLong ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                        {p.isLong ? 'LONG' : 'SHORT'} {p.leverage}x
                      </span>
                      <span className="text-slate-400">{p.traderAddress ? `${p.traderAddress.slice(0, 8)}...` : 'Trader'}</span>
                    </div>

                    <div className="flex items-center gap-4 text-slate-300">
                      <span>{(Number(p.collateral) / 1e6).toFixed(2)} mUSDT</span>
                      <TxLink hash={p.openTxHash} label="Tx" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Trade Terminal Form Column (1/3) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-5 sticky top-24">
            <h3 className="text-base font-bold text-white">Execute vAMM Trade</h3>

            {/* Long / Short Toggle */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold">
              <button
                onClick={() => setIsLong(true)}
                className={`py-2 rounded-lg transition-all ${isLong ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
              >
                LONG
              </button>
              <button
                onClick={() => setIsLong(false)}
                className={`py-2 rounded-lg transition-all ${!isLong ? 'bg-rose-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
              >
                SHORT
              </button>
            </div>

            {/* Collateral Input */}
            <div className="space-y-1.5 text-xs">
              <label className="text-slate-400 font-medium">Margin Collateral (mUSDT)</label>
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
                <label className="text-slate-400 font-medium">Leverage Cap</label>
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

            {/* Trade Preview Box */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs font-mono text-slate-400">
              <div className="flex items-center justify-between">
                <span>Posted Margin Collateral:</span>
                <span className="text-white font-bold">{parseFloat(collateralInput) || 0} mUSDT</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Trading Fee (0.10%):</span>
                <span className="text-rose-400 font-bold">-{(Number(quote.feeAmount) / 1e6).toFixed(2)} mUSDT</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-800/80 pt-1.5">
                <span>Net Position Margin:</span>
                <span className="text-emerald-400 font-bold">{(Number(quote.netCollateral) / 1e6).toFixed(2)} mUSDT</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Notional Position Size:</span>
                <span className="text-white font-bold">${((Number(quote.netCollateral) / 1e6) * leverage).toFixed(2)} USD</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Est. Entry Price:</span>
                <span className="text-cyan-400 font-bold">{quote.entryPrice.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Price Impact (Slippage):</span>
                <span className="text-amber-400 font-bold">{(quote.priceImpactBps / 100).toFixed(2)}%</span>
              </div>
            </div>

            <button
              onClick={handleOpenTrade}
              disabled={submitting || !isConnected}
              className={`w-full py-3 rounded-xl font-bold text-xs text-slate-950 transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                isLong ? 'bg-emerald-400 hover:bg-emerald-300' : 'bg-rose-400 hover:bg-rose-300'
              }`}
            >
              {submitting ? 'Submitting Trade...' : `Open ${isLong ? 'Long' : 'Short'} ${leverage}x Position`}
            </button>

            {txHash && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-xs text-emerald-300 flex items-center justify-between">
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
