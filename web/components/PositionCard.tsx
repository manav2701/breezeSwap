'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { TxLink } from './TxLink'
import { ArrowUpRight, CheckCircle2, Clock, DollarSign } from 'lucide-react'
import type { Position } from '@breezeswap/sdk'
import { formatCollateral, formatExpiry, redeem } from '@breezeswap/sdk'
import { useBreezeSDK } from '../lib/hooks/useBreezeSDK'

export function PositionCard({ position, onRedeemed }: { position: Position; onRedeemed?: () => void }) {
  const { walletClient, publicClient } = useBreezeSDK()
  const [loading, setLoading] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isLong = position.side === 'LONG'
  const isSettled = position.market?.status === 'SETTLED'
  const isRedeemed = position.redeemed

  async function handleRedeem() {
    if (!walletClient || !publicClient) return
    setLoading(true)
    setError(null)
    try {
      const hash = await redeem(
        walletClient as any,
        publicClient as any,
        position.marketAddress as `0x${string}`,
        BigInt(position.tokenId),
        BigInt(position.collateralAmount)
      )
      setTxHash(hash)
      if (onRedeemed) onRedeemed()
    } catch (err: any) {
      setError(err.message || 'Redemption failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-4 hover:border-slate-700 transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              isLong
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}
          >
            {position.side}
          </span>
          <div>
            <h4 className="text-sm font-bold text-white">
              {position.market?.regionName || 'Market'} — {position.market?.weatherVariable}
            </h4>
            <p className="text-xs text-slate-400">Token ID: #{position.tokenId}</p>
          </div>
        </div>

        <Link
          href={`/markets/${position.marketAddress}`}
          className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
        >
          Market <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 py-3 border-y border-slate-800/80 text-xs">
        <div>
          <span className="text-slate-400 block mb-0.5">Collateral Deposited</span>
          <span className="font-semibold text-slate-200 font-mono">
            {formatCollateral(position.collateralAmount, 6, 'mUSDT')}
          </span>
        </div>

        <div>
          <span className="text-slate-400 block mb-0.5">Minted Tx</span>
          <TxLink hash={position.txHash} />
        </div>

        {isRedeemed && (
          <div>
            <span className="text-slate-400 block mb-0.5">Redeemed Amount</span>
            <span className="font-semibold text-emerald-400 font-mono">
              {formatCollateral(position.redeemedAmount || '0', 6, 'mUSDT')}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-1">
        {isRedeemed ? (
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Redeemed (<TxLink hash={position.redeemTxHash || ''} label="Tx" />)
          </div>
        ) : isSettled ? (
          <button
            onClick={handleRedeem}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold text-xs hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
          >
            <DollarSign className="w-4 h-4" />
            {loading ? 'Redeeming...' : 'Redeem Payout'}
          </button>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Active — Awaiting Expiry
          </div>
        )}
      </div>

      {txHash && (
        <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-xs text-emerald-300">
          Redeemed successfully! <TxLink hash={txHash} />
        </div>
      )}

      {error && (
        <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/50 text-xs text-rose-300">
          {error}
        </div>
      )}
    </div>
  )
}
