'use client'

import React, { useEffect, useState } from 'react'
import { PositionCard } from '../../components/PositionCard'
import { ConnectKitButton } from 'connectkit'
import { PieChart, DollarSign, Clock, Wallet, TrendingUp, AlertTriangle, ShieldCheck, ExternalLink, XCircle } from 'lucide-react'
import { getUserPositions, getUserPerpPositions, closePerpPosition, type Position, type PerpPosition } from '@breezeswap/sdk'
import { useBreezeSDK } from '../../lib/hooks/useBreezeSDK'
import { useBreezeNetwork } from '../../lib/hooks/useNetwork'
import { useAccount } from 'wagmi'
import { TxLink } from '../../components/TxLink'
import { calculateUnrealizedPnl } from '../../lib/perpPnl'

export default function PortfolioPage() {
  const { indexerUrl, walletClient, publicClient } = useBreezeSDK()
  const { chainId } = useBreezeNetwork()
  const { address, isConnected } = useAccount()
  const [positions, setPositions] = useState<Position[]>([])
  const [perpPositions, setPerpPositions] = useState<PerpPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [closingPosId, setClosingPosId] = useState<string | null>(null)

  async function loadPositions() {
    if (!address) return
    setLoading(true)
    try {
      const [classicData, perpData] = await Promise.all([
        getUserPositions(indexerUrl, address, chainId),
        getUserPerpPositions(indexerUrl, address, chainId)
      ])
      setPositions(classicData)
      setPerpPositions(perpData)
    } catch {
      setPositions([])
      setPerpPositions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isConnected && address) {
      loadPositions()
    } else {
      setPositions([])
      setPerpPositions([])
      setLoading(false)
    }
  }, [indexerUrl, address, isConnected, chainId])

  async function handleClosePerp(marketAddress: string, positionId: string) {
    if (!walletClient || !publicClient) return
    setClosingPosId(positionId)
    try {
      await closePerpPosition(walletClient as any, publicClient as any, marketAddress as `0x${string}`, BigInt(positionId))
      alert('Close position transaction submitted!')
      loadPositions()
    } catch (err: any) {
      alert(err?.shortMessage || err?.message || 'Close position failed')
    } finally {
      setClosingPosId(null)
    }
  }

  if (!isConnected) {
    return (
      <div className="py-20 text-center max-w-md mx-auto space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-[#fde047] flex items-center justify-center text-black mx-auto shadow-2xl">
          <Wallet className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-black uppercase text-white tracking-tight">Connect Your Wallet</h2>
        <p className="text-sm text-slate-300 leading-relaxed font-medium">
          Connect your Web3 wallet to inspect active classic & perpetual weather positions, pending payouts, and liquidation risk gauges.
        </p>
        <div className="flex justify-center pt-2">
          <ConnectKitButton />
        </div>
      </div>
    )
  }

  // Portfolio Summary Aggregation
  let totalMarginUsed = 0
  let totalUnrealizedPnl = 0

  const activePerpPositions = perpPositions.filter((p) => p.isOpen)

  activePerpPositions.forEach((p) => {
    const col = Number(p.collateral || 0) / 1e18
    totalMarginUsed += col
    const entryPrice = Number(p.entryMarkPrice || 0) / 1e18 || 25.0
    const risk = calculateUnrealizedPnl(p, entryPrice)
    totalUnrealizedPnl += risk.unrealizedPnl
  })

  const totalPortfolioValue = totalMarginUsed + totalUnrealizedPnl

  return (
    <div className="space-y-10 py-4">
      {/* Title Header */}
      <div className="glass-panel p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-4">
          <span className="p-3 rounded-2xl bg-[#fde047] text-black shadow-lg shadow-yellow-500/20">
            <PieChart className="w-7 h-7" />
          </span>
          <div>
            <h1 className="text-3xl font-black uppercase text-white tracking-tight">Portfolio Risk Dashboard</h1>
            <p className="text-xs text-slate-400 font-mono">Live risk engine, unrealized PnL, and liquidation margin management</p>
          </div>
        </div>

        {/* Summary Metric Header Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 border-t border-white/10 font-mono">
          <div className="p-5 rounded-2xl bg-black/60 border border-white/10">
            <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block tracking-wider">Total Portfolio Value</span>
            <span className="text-3xl font-black text-white">${totalPortfolioValue.toFixed(2)}</span>
          </div>

          <div className="p-5 rounded-2xl bg-black/60 border border-white/10">
            <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block tracking-wider">Total Margin Used</span>
            <span className="text-3xl font-black text-[#fde047]">${totalMarginUsed.toFixed(2)}</span>
          </div>

          <div className="p-5 rounded-2xl bg-black/60 border border-white/10">
            <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block tracking-wider">Total Unrealized PnL</span>
            <span className={`text-3xl font-black ${totalUnrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalUnrealizedPnl >= 0 ? `+$${totalUnrealizedPnl.toFixed(2)}` : `-$${Math.abs(totalUnrealizedPnl).toFixed(2)}`}
            </span>
          </div>
        </div>
      </div>

      {/* Perpetual Positions Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h2 className="text-xl font-black uppercase text-white flex items-center gap-3 tracking-tight">
            <TrendingUp className="w-6 h-6 text-emerald-400" />
            Active vAMM Perpetual Positions ({activePerpPositions.length})
          </h2>
          <span className="text-xs font-mono text-[#fde047] font-bold">Real-Time Risk Engine</span>
        </div>

        {activePerpPositions.length === 0 ? (
          <div className="p-12 glass-panel text-center text-xs text-slate-400 font-mono">
            No active perpetual positions found for your wallet on this chain.
          </div>
        ) : (
          <div className="space-y-6">
            {activePerpPositions.map((p) => {
              const entryMark = Number(p.entryMarkPrice || 0) / 1e18 || 25.0
              const risk = calculateUnrealizedPnl(p, entryMark)

              return (
                <div key={p.id} className="glass-panel p-6 space-y-6 font-mono">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4 font-sans">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${p.isLong ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                        {p.isLong ? 'LONG ↗' : 'SHORT ↘'} {p.leverage}x
                      </span>
                      <h3 className="text-lg font-black text-white">{p.market?.regionName || 'vAMM Market'}</h3>
                      <span className="text-xs text-slate-400 font-mono font-bold">#{p.positionId}</span>
                    </div>

                    <button
                      onClick={() => handleClosePerp(p.marketAddress, p.positionId)}
                      disabled={closingPosId === p.positionId}
                      className="px-4 py-2 rounded-full bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-extrabold uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-2 w-fit"
                    >
                      <XCircle className="w-4 h-4" />
                      {closingPosId === p.positionId ? 'Closing...' : 'Close Position'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block mb-1">Entry Mark Price</span>
                      <span className="text-white font-bold text-base">${entryMark.toFixed(2)}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block mb-1">Unrealized PnL</span>
                      <span className={`font-bold text-base ${risk.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {risk.unrealizedPnl >= 0 ? `+$${risk.unrealizedPnl.toFixed(2)}` : `-$${Math.abs(risk.unrealizedPnl).toFixed(2)}`}
                        <span className="text-xs font-normal ml-1 font-sans">({risk.pnlPercent.toFixed(1)}%)</span>
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block mb-1">Liquidation Price</span>
                      <span className="text-amber-400 font-bold text-base">${risk.liquidationPrice.toFixed(2)}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block mb-1">Risk Level</span>
                      <span className={`font-black text-sm font-sans uppercase ${
                        risk.riskLevel === 'CRITICAL' ? 'text-rose-400' : risk.riskLevel === 'HIGH' ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {risk.riskLevel} RISK ({risk.distanceToLiquidationPercent.toFixed(1)}%)
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 font-sans">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      <span>Liquidation Proximity Safety Gauge</span>
                      <span>{risk.distanceToLiquidationPercent.toFixed(1)}% to Margin Call</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-black/80 overflow-hidden border border-white/10 p-0.5">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          risk.riskLevel === 'CRITICAL'
                            ? 'bg-rose-500 animate-pulse'
                            : risk.riskLevel === 'HIGH'
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(5, risk.distanceToLiquidationPercent * 2))}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Classic Derivative Positions Section */}
      <div className="space-y-6 pt-6 border-t border-white/10">
        <h2 className="text-xl font-black uppercase text-white flex items-center gap-3 tracking-tight">
          <Clock className="w-6 h-6 text-[#fde047]" />
          Classic Derivatives ({positions.length})
        </h2>

        {positions.length === 0 ? (
          <div className="p-12 glass-panel text-center text-xs text-slate-400 font-mono">
            No Classic derivative positions found for your wallet on this chain.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {positions.map((p) => (
              <PositionCard key={p.id} position={p} onRedeemed={loadPositions} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
