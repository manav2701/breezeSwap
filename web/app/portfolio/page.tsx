'use client'

import React, { useEffect, useState } from 'react'
import { PositionCard } from '../../components/PositionCard'
import { ConnectKitButton } from 'connectkit'
import { PieChart, DollarSign, Clock, CheckCircle2, Wallet } from 'lucide-react'
import { getUserPositions, type Position } from '@breezeswap/sdk'
import { useBreezeSDK } from '../../lib/hooks/useBreezeSDK'
import { useAccount } from 'wagmi'

export default function PortfolioPage() {
  const { indexerUrl } = useBreezeSDK()
  const { address, isConnected } = useAccount()
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)

  async function loadPositions() {
    if (!address) return
    setLoading(true)
    try {
      const data = await getUserPositions(indexerUrl, address)
      setPositions(data)
    } catch {
      setPositions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isConnected && address) {
      loadPositions()
    } else {
      setPositions([])
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
          Connect your Web3 wallet to inspect active weather positions, pending payouts, and historical redemption records on Flare Coston2.
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
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">User Portfolio</h1>
        <p className="text-xs text-slate-400 font-mono mt-1">Wallet: {address}</p>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <PieChart className="w-4 h-4 text-cyan-400" />
            <span>Total Positions</span>
          </div>
          <span className="text-2xl font-bold text-white font-mono">{loading ? '—' : positions.length}</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Active Open</span>
          </div>
          <span className="text-2xl font-bold text-amber-400 font-mono">{loading ? '—' : activePositions.length}</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span>Pending Redemption</span>
          </div>
          <span className="text-2xl font-bold text-emerald-400 font-mono">{loading ? '—' : redeemablePositions.length}</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <CheckCircle2 className="w-4 h-4 text-purple-400" />
            <span>Redeemed</span>
          </div>
          <span className="text-2xl font-bold text-purple-400 font-mono">{loading ? '—' : redeemedPositions.length}</span>
        </div>
      </div>

      {/* Section 1: Pending Redemption */}
      {redeemablePositions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-emerald-400 flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Settled — Ready for Payout Redemption
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {redeemablePositions.map((p) => (
              <PositionCard key={p.id} position={p} onRedeemed={loadPositions} />
            ))}
          </div>
        </div>
      )}

      {/* Section 2: Active Positions */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-400" />
          Active Weather Positions
        </h2>
        {activePositions.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400">
            No active open positions found for this wallet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {activePositions.map((p) => (
              <PositionCard key={p.id} position={p} onRedeemed={loadPositions} />
            ))}
          </div>
        )}
      </div>

      {/* Section 3: Redeemed History */}
      {redeemedPositions.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <h2 className="text-lg font-bold text-slate-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-purple-400" />
            Historical Redeemed Positions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {redeemedPositions.map((p) => (
              <PositionCard key={p.id} position={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
