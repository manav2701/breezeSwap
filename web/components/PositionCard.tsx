'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, CheckCircle2, Clock } from 'lucide-react'
import type { Position } from '@breezeswap/sdk'
import { redeem } from '@breezeswap/sdk'
import { TxLink } from './TxLink'
import { useBreezeSDK } from '../lib/hooks/useBreezeSDK'
import { useCollateralToken } from '../lib/hooks/useCollateralToken'
import { explainRevert } from '../lib/revertReason'
import { formatTokenAmount } from '../lib/formatToken'

export function PositionCard({
  position,
  onRedeemed,
}: {
  position: Position
  onRedeemed?: () => void
}) {
  const { walletClient, publicClient } = useBreezeSDK()
  // The indexer records the asset on the position row; the nested `market`
  // summary does not carry it.
  const { decimals, symbol } = useCollateralToken(position.collateralAsset)

  const amount = (raw: string | null | undefined) =>
    formatTokenAmount(raw ?? '0', decimals, symbol)
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
      onRedeemed?.()
    } catch (err: any) {
      setError(explainRevert(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <article className="panel p-5 flex flex-col gap-4 h-full">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5 min-w-0">
            {/* Word + arrow, so side never depends on colour alone. */}
            <span className={`chip shrink-0 ${isLong ? 'chip-long' : 'chip-short'}`}>
              {isLong ? '▲ Long' : '▼ Short'}
            </span>
            {/* ERC-1155 ids here are keccak-derived, so they run to 77 digits.
                Printed in full one overflowed its card and painted straight
                over the "Market" link beside it. */}
            <span
              className="numeric text-[11px] text-ink-faint truncate-hash max-w-[9ch]"
              title={`Token ID ${position.tokenId}`}
            >
              #{position.tokenId}
            </span>
          </div>
          <h3 className="display-3 text-ink truncate">
            {position.market?.regionName || 'Market'}
          </h3>
          <p className="text-xs text-ink-faint mt-0.5">
            {position.market?.weatherVariable === 'TEMPERATURE' ? 'Temperature' : 'Rainfall'}
          </p>
        </div>

        <Link
          href={`/markets/${position.marketAddress}`}
          className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-accent transition-colors shrink-0"
        >
          Market
          <ArrowUpRight className="w-3.5 h-3.5" aria-hidden />
        </Link>
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <div className="inset px-3 py-2.5 min-w-0">
          <dt className="metric-label">Collateral</dt>
          <dd className="numeric text-sm text-ink font-medium mt-0.5 truncate">
            {amount(position.collateralAmount)}
          </dd>
        </div>
        <div className="inset px-3 py-2.5 min-w-0">
          <dt className="metric-label">{isRedeemed ? 'Redeemed' : 'Minted tx'}</dt>
          <dd className="mt-0.5 truncate">
            {isRedeemed ? (
              <span className="numeric text-sm value-long">
                {amount(position.redeemedAmount)}
              </span>
            ) : (
              <TxLink hash={position.txHash} />
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-auto">
        {isRedeemed ? (
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="value-long inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />
              Redeemed
            </span>
            <TxLink hash={position.redeemTxHash || ''} />
          </div>
        ) : isSettled ? (
          <button
            type="button"
            onClick={handleRedeem}
            disabled={loading}
            className="btn btn-primary w-full"
          >
            {loading ? 'Redeeming…' : 'Redeem payout'}
          </button>
        ) : (
          <div className="inline-flex items-center gap-1.5 text-xs text-ink-faint">
            <Clock className="w-3.5 h-3.5" aria-hidden />
            Active — awaiting expiry
          </div>
        )}
      </div>

      {txHash && (
        <div className="inset p-3 flex items-center justify-between gap-3 text-xs">
          <span className="value-long">Redeemed</span>
          <TxLink hash={txHash} />
        </div>
      )}

      {error && (
        <div className="inset p-3 text-xs value-short border-[color:rgba(244,63,94,0.3)] break-words">
          {error}
        </div>
      )}
    </article>
  )
}
