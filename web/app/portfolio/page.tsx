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
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mx-auto">
          <Wallet className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white">Connect Your Wallet</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          Connect your Web3 wallet to inspect active classic & perpetual weather positions, pending payouts, and historical redemption records.
        </p>
        <div className="flex justify-center">
          <ConnectKitButton />
        </div>
      </div>
    )
  }

  // PART E.3: Portfolio Summary Aggregation
  let totalMarginUsed = 0
  let totalUnrealizedPnl = 0

  const activePerpPositions = perpPositions.filter((p) => p.isOpen)

  activePerpPositions.forEach((p) => {
    const col = Number(p.collateral || 0) / 1e18
    totalMarginUsed += col
    // Estimate mark price (e.g. 25.0) or entry price as fallback
    const entryPrice = Number(p.entryMarkPrice || 0) / 1e18 || 25.0
    const risk = calculateUnrealizedPnl(p, entryPrice)
    totalUnrealizedPnl += risk.unrealizedPnl
  })

  const totalPortfolioValue = totalMarginUsed + totalUnrealizedPnl

  return (
    <div className="space-y-10 py-4">
      {/* Title */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <PieChart className="w-6 h-6" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Institutional Portfolio Dashboard</h1>
            <p className="text-xs text-slate-400">Live risk monitoring, unrealized PnL, and liquidation margin management</p>
          </div>
        </div>

        {/* PART E.3: Portfolio Summary Header */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800 font-mono">
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block font-sans">Total Portfolio Value</span>
            <span className="text-2xl font-bold text-white">${totalPortfolioValue.toFixed(2)}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block font-sans">Total Margin Used</span>
            <span className="text-2xl font-bold text-cyan-400">${totalMarginUsed.toFixed(2)}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block font-sans">Total Unrealized PnL</span>
            <span className={`text-2xl font-bold ${totalUnrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalUnrealizedPnl >= 0 ? `+$${totalUnrealizedPnl.toFixed(2)}` : `-$${Math.abs(totalUnrealizedPnl).toFixed(2)}`}
            </span>
          </div>
        </div>
      </div>

      {/* Perpetual Positions Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Active vAMM Perpetual Positions ({activePerpPositions.length})
          </h2>
          <span className="text-xs font-mono text-slate-400">Real-Time Risk Engine</span>
        </div>

        {activePerpPositions.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800/60 text-center text-xs text-slate-500">
            No active perpetual positions found for your wallet on this chain.
          </div>
        ) : (
          <div className="space-y-4">
            {activePerpPositions.map((p) => {
              const entryMark = Number(p.entryMarkPrice || 0) / 1e18 || 25.0
              const risk = calculateUnrealizedPnl(p, entryMark)

              return (
                <div key={p.id} className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-lg font-mono">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3 font-sans">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold ${p.isLong ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                        {p.isLong ? 'LONG ↗' : 'SHORT ↘'} {p.leverage}x
                      </span>
                      <h3 className="text-sm font-bold text-white">{p.market?.regionName || 'vAMM Market'}</h3>
                      <span className="text-xs text-slate-500 font-mono">#{p.positionId}</span>
                    </div>

                    <button
                      onClick={() => handleClosePerp(p.marketAddress, p.positionId)}
                      disabled={closingPosId === p.positionId}
                      className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 text-xs font-semibold transition-all disabled:opacity-50 flex items-center gap-1.5 w-fit"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      {closingPosId === p.positionId ? 'Closing...' : 'Close Position'}
                    </button>
                  </div>

                  {/* PART E.2: Live PnL & Risk Indicator Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-sans font-semibold block">Entry Mark Price</span>
                      <span className="text-slate-200 font-bold">${entryMark.toFixed(2)}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-sans font-semibold block">Unrealized PnL</span>
                      <span className={`font-bold ${risk.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {risk.unrealizedPnl >= 0 ? `+$${risk.unrealizedPnl.toFixed(2)}` : `-$${Math.abs(risk.unrealizedPnl).toFixed(2)}`}
                        <span className="text-[10px] font-normal ml-1">({risk.pnlPercent.toFixed(1)}%)</span>
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-sans font-semibold block">Liquidation Price</span>
                      <span className="text-amber-400 font-bold">${risk.liquidationPrice.toFixed(2)}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-sans font-semibold block">Risk Level</span>
                      <span className={`font-bold font-sans ${
                        risk.riskLevel === 'CRITICAL' ? 'text-rose-400' : risk.riskLevel === 'HIGH' ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {risk.riskLevel} RISK ({risk.distanceToLiquidationPercent.toFixed(1)}% buffer)
                      </span>
                    </div>
                  </div>

                  {/* PART E.2: Liquidation Risk Distance Bar */}
                  <div className="space-y-1 pt-1 font-sans">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                      <span>Liquidation Proximity Safety Gauge</span>
                      <span>{risk.distanceToLiquidationPercent.toFixed(1)}% to Margin Call</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800 p-0.5">
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
      <div className="space-y-4 pt-4 border-t border-slate-800">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-cyan-400" />
          Classic Derivatives ({positions.length})
        </h2>

        {positions.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800/60 text-center text-xs text-slate-500">
            No Classic derivative positions found.
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
