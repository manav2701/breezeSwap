'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ConnectKitButton } from 'connectkit'
import { useAccount } from 'wagmi'
import { RefreshCw, Wallet, XCircle } from 'lucide-react'
import {
  getUserPositions,
  getUserPerpPositions,
  closePerpPosition,
  type Position,
  type PerpPosition,
} from '@breezeswap/sdk'
import { PositionCard } from '../../components/PositionCard'
import { useBreezeSDK } from '../../lib/hooks/useBreezeSDK'
import { useBreezeNetwork } from '../../lib/hooks/useNetwork'
import { calculateUnrealizedPnl } from '../../lib/perpPnl'
import { formatMoney } from '../../lib/chartTheme'

/** Fallback mark when the position row carries no entry price. */
const FALLBACK_MARK = 25

export default function PortfolioPage() {
  const { indexerUrl, walletClient, publicClient } = useBreezeSDK()
  const { chainId } = useBreezeNetwork()
  const { address, isConnected } = useAccount()

  const [positions, setPositions] = useState<Position[]>([])
  const [perpPositions, setPerpPositions] = useState<PerpPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [closingId, setClosingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadPositions = useCallback(async () => {
    if (!address) return
    setLoading(true)
    try {
      const [classic, perp] = await Promise.all([
        getUserPositions(indexerUrl, address, chainId),
        getUserPerpPositions(indexerUrl, address, chainId),
      ])
      setPositions(classic ?? [])
      setPerpPositions(perp ?? [])
    } catch {
      setPositions([])
      setPerpPositions([])
    } finally {
      setLoading(false)
    }
  }, [indexerUrl, address, chainId])

  useEffect(() => {
    if (isConnected && address) {
      loadPositions()
    } else {
      setPositions([])
      setPerpPositions([])
      setLoading(false)
    }
  }, [isConnected, address, loadPositions])

  const activePerps = useMemo(() => perpPositions.filter((p) => p.isOpen), [perpPositions])

  /**
   * Portfolio totals.
   *
   * Collateral and entry price are both 18-decimal on-chain values. A position
   * with no recorded entry price falls back to the reference mark so the tile
   * shows a defensible number rather than an infinite PnL.
   */
  const totals = useMemo(() => {
    let margin = 0
    let pnl = 0

    for (const p of activePerps) {
      const collateral = Number(p.collateral || 0) / 1e18
      if (Number.isFinite(collateral)) margin += collateral

      const entry = Number(p.entryMarkPrice || 0) / 1e18 || FALLBACK_MARK
      const risk = calculateUnrealizedPnl(p, entry)
      if (Number.isFinite(risk.unrealizedPnl)) pnl += risk.unrealizedPnl
    }

    return { margin, pnl, value: margin + pnl }
  }, [activePerps])

  async function handleClosePerp(marketAddress: string, positionId: string) {
    if (!walletClient || !publicClient) return
    setClosingId(positionId)
    setError(null)
    try {
      await closePerpPosition(
        walletClient as any,
        publicClient as any,
        marketAddress as `0x${string}`,
        BigInt(positionId)
      )
      loadPositions()
    } catch (err: any) {
      setError(err?.shortMessage || err?.message || 'Closing the position failed.')
    } finally {
      setClosingId(null)
    }
  }

  if (!isConnected) {
    return (
      <div className="py-24 max-w-md mx-auto text-center space-y-6">
        <span className="w-14 h-14 rounded-2xl inset flex items-center justify-center mx-auto">
          <Wallet className="w-6 h-6 text-accent" aria-hidden />
        </span>
        <div className="space-y-2">
          <h1 className="display-2 text-ink">Connect your wallet</h1>
          <p className="text-sm text-ink-muted leading-relaxed">
            Your open positions, unrealised PnL and liquidation distance live here. Nothing is
            stored server-side — it all reads from the chain.
          </p>
        </div>
        <div className="flex justify-center">
          <ConnectKitButton />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {/* Summary */}
      <section className="panel p-5 sm:p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow mb-2">Portfolio</p>
            <h1 className="display-2 text-ink">Your positions</h1>
          </div>
          <button
            type="button"
            onClick={loadPositions}
            className="btn btn-ghost btn-icon"
            aria-label="Refresh positions"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          </button>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5 border-t border-[color:var(--color-hairline)]">
          <div className="inset p-4 min-w-0">
            <dt className="metric-label">Portfolio value</dt>
            <dd className="metric-value metric-value-lg mt-1">{formatMoney(totals.value)}</dd>
          </div>
          <div className="inset p-4 min-w-0">
            <dt className="metric-label">Margin posted</dt>
            <dd className="metric-value metric-value-lg text-accent mt-1">
              {formatMoney(totals.margin)}
            </dd>
          </div>
          <div className="inset p-4 min-w-0">
            <dt className="metric-label">Unrealised PnL</dt>
            <dd
              className={`metric-value metric-value-lg mt-1 ${
                totals.pnl >= 0 ? 'value-long' : 'value-short'
              }`}
            >
              {totals.pnl >= 0 ? '+' : '−'}
              {formatMoney(Math.abs(totals.pnl))}
            </dd>
          </div>
        </dl>
      </section>

      {error && (
        <div className="panel p-4 text-sm value-short border-[color:rgba(244,63,94,0.3)]">
          {error}
        </div>
      )}

      {/* Perpetuals */}
      <section className="space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[color:var(--color-hairline)]">
          <h2 className="display-3 text-ink">
            Perpetual positions{' '}
            <span className="numeric text-ink-faint font-normal">({activePerps.length})</span>
          </h2>
        </header>

        {loading ? (
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <div key={i} className="panel skeleton h-40" />
            ))}
          </div>
        ) : activePerps.length === 0 ? (
          <div className="panel p-10 text-center space-y-3">
            <p className="text-sm text-ink-muted">No open perpetual positions on this chain.</p>
            <Link href="/perp-markets" className="btn btn-ghost btn-sm">
              Browse perpetual markets
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {activePerps.map((p) => {
              const entry = Number(p.entryMarkPrice || 0) / 1e18 || FALLBACK_MARK
              const risk = calculateUnrealizedPnl(p, entry)
              // The gauge fills as the position gets *safer*, capped at 100%
              // so a far-from-liquidation position does not overflow the bar.
              const safety = Math.min(100, Math.max(4, risk.distanceToLiquidationPercent * 2))

              return (
                <article key={p.id} className="panel p-5 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[color:var(--color-hairline)]">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`chip ${p.isLong ? 'chip-long' : 'chip-short'}`}>
                        {p.isLong ? '▲ Long' : '▼ Short'} {p.leverage}×
                      </span>
                      <h3 className="display-3 text-ink truncate">
                        {p.market?.regionName || 'vAMM market'}
                      </h3>
                      <span className="numeric text-xs text-ink-faint">#{p.positionId}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleClosePerp(p.marketAddress, p.positionId)}
                      disabled={closingId === p.positionId}
                      className="btn btn-ghost btn-sm"
                    >
                      <XCircle className="w-3.5 h-3.5" aria-hidden />
                      {closingId === p.positionId ? 'Closing…' : 'Close'}
                    </button>
                  </div>

                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="min-w-0">
                      <dt className="metric-label">Entry price</dt>
                      <dd className="numeric text-base text-ink font-medium mt-1">
                        {formatMoney(entry)}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="metric-label">Unrealised PnL</dt>
                      <dd
                        className={`numeric text-base font-medium mt-1 ${
                          risk.unrealizedPnl >= 0 ? 'value-long' : 'value-short'
                        }`}
                      >
                        {risk.unrealizedPnl >= 0 ? '+' : '−'}
                        {formatMoney(Math.abs(risk.unrealizedPnl))}
                        <span className="text-xs text-ink-faint ml-1.5">
                          {risk.pnlPercent.toFixed(1)}%
                        </span>
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="metric-label">Liquidation</dt>
                      <dd className="numeric text-base text-warn font-medium mt-1">
                        {formatMoney(risk.liquidationPrice)}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="metric-label">Risk</dt>
                      <dd
                        className={`text-base font-medium mt-1 ${
                          risk.riskLevel === 'CRITICAL'
                            ? 'value-short'
                            : risk.riskLevel === 'HIGH'
                              ? 'text-warn'
                              : 'value-long'
                        }`}
                      >
                        {risk.riskLevel.charAt(0) + risk.riskLevel.slice(1).toLowerCase()}
                      </dd>
                    </div>
                  </dl>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-ink-faint">
                      <span>Distance to liquidation</span>
                      <span className="numeric">
                        {risk.distanceToLiquidationPercent.toFixed(1)}%
                      </span>
                    </div>
                    <div
                      className="h-1.5 rounded-full bg-[color:var(--color-inset)] overflow-hidden"
                      role="img"
                      aria-label={`${risk.distanceToLiquidationPercent.toFixed(1)} percent from liquidation, risk level ${risk.riskLevel}`}
                    >
                      <div
                        className={`h-full rounded-full transition-[width] duration-500 ${
                          risk.riskLevel === 'CRITICAL'
                            ? 'bg-short'
                            : risk.riskLevel === 'HIGH'
                              ? 'bg-warn'
                              : 'bg-long'
                        }`}
                        style={{ width: `${safety}%` }}
                      />
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {/* Classic */}
      <section className="space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[color:var(--color-hairline)]">
          <h2 className="display-3 text-ink">
            Classic positions{' '}
            <span className="numeric text-ink-faint font-normal">({positions.length})</span>
          </h2>
        </header>

        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="panel skeleton h-52" />
            ))}
          </div>
        ) : positions.length === 0 ? (
          <div className="panel p-10 text-center space-y-3">
            <p className="text-sm text-ink-muted">No classic positions on this chain.</p>
            <Link href="/markets" className="btn btn-ghost btn-sm">
              Browse markets
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {positions.map((p) => (
              <PositionCard key={p.id} position={p} onRedeemed={loadPositions} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
