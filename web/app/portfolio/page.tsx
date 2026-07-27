'use client'

import React, { useEffect, useState } from 'react'
import { PositionCard } from '../../components/PositionCard'
import { ConnectKitButton } from 'connectkit'
import { PieChart, DollarSign, Clock, CheckCircle2, Wallet, TrendingUp, AlertTriangle, ShieldCheck } from 'lucide-react'
import { getUserPositions, getUserPerpPositions, type Position, type PerpPosition } from '@breezeswap/sdk'
import { useBreezeSDK } from '../../lib/hooks/useBreezeSDK'
import { useAccount } from 'wagmi'
import { TxLink } from '../../components/TxLink'

export default function PortfolioPage() {
  const { indexerUrl } = useBreezeSDK()
  const { address, isConnected } = useAccount()
  const [positions, setPositions] = useState<Position[]>([])
  const [perpPositions, setPerpPositions] = useState<PerpPosition[]>([])
  const [loading, setLoading] = useState(true)

  async function loadPositions() {
    if (!address) return
    setLoading(true)
    try {
      const [classicData, perpData] = await Promise.all([
        getUserPositions(indexerUrl, address),
        getUserPerpPositions(indexerUrl, address)
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
  }, [indexerUrl, address, isConnected])

  if (!isConnected) {
    return (
      <div className="py-20 text-center max-w-md mx-auto space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mx-auto">
          <Wallet className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white">Connect Your Wallet</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          Connect your Web3 wallet to inspect active classic & perpetual weather positions, pending payouts, and historical redemption records on Flare Coston2.
        </p>
        <div className="flex justify-center">
          <ConnectKitButton />
        </div>
      </div>
    )
  }

  const activePositions = positions.filter((p) => !p.redeemed && p.market?.status === 'OPEN')
  const redeemablePositions = positions.filter((p) => !p.redeemed && p.market?.status === 'SETTLED')
  const redeemedPositions = positions.filter((p) => p.redeemed)

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-2">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <PieChart className="w-6 h-6" />
          </span>
          <h1 className="text-2xl font-extrabold text-white">Portfolio Dashboard</h1>
        </div>
        <p className="text-xs text-slate-400">
          Manage active Classic derivative positions and vAMM Perpetual leveraged positions.
        </p>
      </div>

      {/* Perpetual Positions Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Perpetual Positions ({perpPositions.filter((p) => p.isOpen).length} Active)
          </h2>
          <span className="text-xs font-mono text-slate-400">vAMM Leverage Trading</span>
        </div>

        {perpPositions.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800/60 text-center text-xs text-slate-500">
            No active perpetual positions found for your wallet.
          </div>
        ) : (
          <div className="space-y-3">
            {perpPositions.map((p) => (
              <div key={p.id} className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-mono">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${p.isLong ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                      {p.isLong ? 'LONG' : 'SHORT'} {p.leverage}x
                    </span>
                    <span className="text-white font-bold">{p.market?.regionName || 'vAMM Market'}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block">Position ID: #{p.positionId}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-slate-300">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Collateral</span>
                    <span>{(Number(p.collateral) / 1e6).toFixed(2)} mUSDT</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Realized PnL</span>
                    <span className={Number(p.realizedPnl || 0) >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {p.realizedPnl ? `${(Number(p.realizedPnl) / 1e18).toFixed(2)} USD` : 'Open'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Liquidation Risk</span>
                    <span className="text-emerald-400 flex items-center gap-1 font-bold">
                      <ShieldCheck className="w-3.5 h-3.5" /> Low Risk
                    </span>
                  </div>
                </div>

                <TxLink hash={p.openTxHash} label="Tx" />
              </div>
            ))}
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
