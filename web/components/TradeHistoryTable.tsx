'use client'

import React, { useEffect, useState } from 'react'
import { ExternalLink, ArrowUpRight, ArrowDownRight, AlertOctagon } from 'lucide-react'
import { getTradeHistory, getGlobalTradeHistory, type TradeHistoryEntry } from '@breezeswap/sdk'
import { useBreezeSDK } from '../lib/hooks/useBreezeSDK'
import { useBreezeNetwork } from '../lib/hooks/useNetwork'

interface TradeHistoryTableProps {
  marketAddress?: string
  isGlobal?: boolean
  limit?: number
}

export function TradeHistoryTable({ marketAddress, isGlobal = false, limit = 20 }: TradeHistoryTableProps) {
  const { indexerUrl } = useBreezeSDK()
  const { chainId } = useBreezeNetwork()
  const [trades, setTrades] = useState<TradeHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadHistory() {
      try {
        let data: TradeHistoryEntry[] = []
        if (isGlobal) {
          data = await getGlobalTradeHistory(indexerUrl, chainId, limit)
        } else if (marketAddress) {
          data = await getTradeHistory(indexerUrl, marketAddress, chainId, limit)
        }
        setTrades(data)
      } catch (err) {
        console.warn('Trade history fetch error:', err)
      } finally {
        setLoading(false)
      }
    }

    loadHistory()
    const interval = setInterval(loadHistory, 15_000)
    return () => clearInterval(interval)
  }, [indexerUrl, marketAddress, isGlobal, chainId, limit])

  const formatRelativeTime = (isoString: string) => {
    if (!isoString) return '-'
    const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
    if (diffSec < 60) return `${diffSec}s ago`
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
    return `${Math.floor(diffSec / 86400)}d ago`
  }

  const formatAddr = (addr?: string) => {
    if (!addr) return '0x...'
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400 text-xs animate-pulse bg-slate-900/40 rounded-2xl border border-slate-800">
        Loading trade history...
      </div>
    )
  }

  if (trades.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 text-xs bg-slate-900/40 rounded-2xl border border-slate-800">
        No recent trades recorded for this market yet.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
      <table className="w-full text-left text-xs text-slate-300">
        <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
          <tr>
            <th className="p-3.5">Time</th>
            <th className="p-3.5">Trader</th>
            <th className="p-3.5">Type</th>
            <th className="p-3.5">Side</th>
            <th className="p-3.5">Size ($)</th>
            <th className="p-3.5">Price</th>
            <th className="p-3.5">Realized PnL</th>
            <th className="p-3.5 text-right">Tx</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60 font-mono">
          {trades.map((t) => {
            const isLong = t.side === 'LONG'
            const isLiquidation = t.type === 'LIQUIDATION'
            const isClose = t.type === 'CLOSE'

            const pnlNum = t.pnl ? Number(t.pnl) : null

            return (
              <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="p-3.5 text-slate-400 font-sans" title={t.timestamp}>
                  {formatRelativeTime(t.timestamp)}
                </td>
                <td className="p-3.5 text-cyan-400">{formatAddr(t.trader)}</td>
                <td className="p-3.5 font-sans">
                  {isLiquidation ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                      <AlertOctagon className="w-3 h-3" />
                      LIQUIDATED
                    </span>
                  ) : isClose ? (
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold border border-slate-700">
                      CLOSE
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 text-[10px] font-bold border border-sky-500/30">
                      OPEN
                    </span>
                  )}
                </td>
                <td className="p-3.5">
                  <span
                    className={`inline-flex items-center gap-0.5 font-bold ${
                      isLong ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isLong ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {t.side}
                  </span>
                </td>
                <td className="p-3.5 font-semibold text-slate-200">${Number(t.size).toLocaleString()}</td>
                <td className="p-3.5 text-slate-300">${t.price}</td>
                <td className="p-3.5 font-bold">
                  {pnlNum === null ? (
                    <span className="text-slate-500">-</span>
                  ) : pnlNum > 0 ? (
                    <span className="text-emerald-400">+${pnlNum.toFixed(2)}</span>
                  ) : pnlNum < 0 ? (
                    <span className="text-rose-400">-${Math.abs(pnlNum).toFixed(2)}</span>
                  ) : (
                    <span className="text-slate-400">$0.00</span>
                  )}
                </td>
                <td className="p-3.5 text-right font-sans">
                  {t.txHash ? (
                    <a
                      href={`https://${chainId === 14 ? 'flare' : 'coston2'}-explorer.flare.network/tx/${t.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
                    >
                      <ExternalLink className="w-3 h-3 text-cyan-400" />
                    </a>
                  ) : (
                    <span className="text-slate-600">-</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
