'use client'

import React, { useEffect, useState } from 'react'
import { AlertOctagon } from 'lucide-react'
import { getTradeHistory, getGlobalTradeHistory, type TradeHistoryEntry } from '@breezeswap/sdk'
import { useBreezeSDK } from '../lib/hooks/useBreezeSDK'
import { useBreezeNetwork } from '../lib/hooks/useNetwork'
import { formatMoney } from '../lib/chartTheme'
import { TxLink } from './TxLink'
import { DemoBadge } from './DemoBadge'
import { InlineError } from './LoadError'
import { errorMessage } from '../lib/errorMessage'
import { demoTrades } from '../lib/demoData'

interface TradeHistoryTableProps {
  marketAddress?: string
  isGlobal?: boolean
  limit?: number
  basePrice?: number
}

function relativeTime(iso: string) {
  if (!iso) return '—'
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diffSec < 60) return `${diffSec}s ago`
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  return `${Math.floor(diffSec / 86400)}d ago`
}

export function TradeHistoryTable({
  marketAddress,
  isGlobal = false,
  limit = 20,
  basePrice = 25,
}: TradeHistoryTableProps) {
  const { indexerUrl } = useBreezeSDK()
  const { chainId } = useBreezeNetwork()
  const [trades, setTrades] = useState<TradeHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const data = isGlobal
          ? await getGlobalTradeHistory(indexerUrl, chainId, limit)
          : marketAddress
            ? await getTradeHistory(indexerUrl, marketAddress, chainId, limit)
            : []

        if (cancelled) return
        setError(null)
        if (data && data.length > 0) {
          setTrades(data)
          setIsDemo(false)
        } else {
          setTrades(
            demoTrades(marketAddress ?? 'global', Math.min(limit, 14), basePrice) as unknown as TradeHistoryEntry[]
          )
          setIsDemo(true)
        }
      } catch (err) {
        // Sample trades for a market with no history are informative; sample
        // trades because the request failed are fiction, and the "Sample data"
        // chip alone did not tell the two apart.
        console.error('Failed to load trade history', err)
        if (cancelled) return
        setTrades(
          demoTrades(marketAddress ?? 'global', Math.min(limit, 14), basePrice) as unknown as TradeHistoryEntry[]
        )
        setIsDemo(true)
        setError(errorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    const timer = window.setInterval(load, 15_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [indexerUrl, marketAddress, isGlobal, chainId, limit, basePrice])

  if (loading) {
    return (
      <div className="panel p-5 space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton h-9 rounded-lg" />
        ))}
      </div>
    )
  }

  if (trades.length === 0) {
    return (
      <div className="panel p-10 text-center text-sm text-ink-faint">
        No trades recorded for this market yet.
      </div>
    )
  }

  return (
    <section className="panel">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-[color:var(--color-hairline)]">
        <h3 className="display-3 text-ink">Trade activity</h3>
        {error && <InlineError message={`Live trades unavailable: ${error}`} />}
        {isDemo ? (
          <DemoBadge />
        ) : (
          <span className="chip chip-long">
            <span className="pulse-dot" aria-hidden />
            Live
          </span>
        )}
      </header>

      <div className="table-scroll max-h-[26rem] overflow-y-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Trader</th>
              <th>Action</th>
              <th>Side</th>
              <th>Size</th>
              <th>Price</th>
              <th>Realised PnL</th>
              <th className="text-right">Tx</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t, i) => {
              const isLong = t.side === 'LONG'
              const pnl = t.pnl == null ? null : Number(t.pnl)

              return (
                <tr key={t.id ?? i}>
                  <td className="text-ink-faint" title={t.timestamp}>
                    {relativeTime(t.timestamp)}
                  </td>
                  <td className="numeric">
                    {t.trader ? `${t.trader.slice(0, 6)}…${t.trader.slice(-4)}` : '0x…'}
                  </td>
                  <td>
                    {t.type === 'LIQUIDATION' ? (
                      <span className="chip chip-short">
                        <AlertOctagon className="w-3 h-3" aria-hidden />
                        Liquidated
                      </span>
                    ) : t.type === 'CLOSE' ? (
                      <span className="chip">Close</span>
                    ) : (
                      <span className="chip chip-info">Open</span>
                    )}
                  </td>
                  {/* Side is labelled as well as coloured. */}
                  <td className={isLong ? 'value-long' : 'value-short'}>
                    <span className="inline-flex items-center gap-1 font-medium">
                      {isLong ? '▲' : '▼'} {t.side}
                    </span>
                  </td>
                  <td className="numeric text-ink">{formatMoney(Number(t.size), 0)}</td>
                  <td className="numeric">{formatMoney(Number(t.price))}</td>
                  <td className="numeric">
                    {pnl === null ? (
                      <span className="text-ink-faint">—</span>
                    ) : (
                      <span className={pnl > 0 ? 'value-long' : pnl < 0 ? 'value-short' : ''}>
                        {pnl > 0 ? '+' : pnl < 0 ? '−' : ''}
                        {formatMoney(Math.abs(pnl))}
                      </span>
                    )}
                  </td>
                  <td className="text-right">
                    <TxLink hash={t.txHash} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
