'use client'

import React from 'react'
import { calculatePerpQuote, calculateMarkPrice, type Reserves } from '@breezeswap/sdk'

interface DepthLadderProps {
  reserves?: Reserves
  tradingFeeBps?: number
}

const SIZE_STEPS = [500, 1000, 2500, 5000, 10000, 25000]

export function DepthLadder({ reserves, tradingFeeBps = 10 }: DepthLadderProps) {
  if (!reserves || reserves.collateralReserve === 0n || reserves.weatherReserve === 0n) {
    return (
      <div className="p-6 glass-panel text-xs text-slate-400 text-center animate-pulse font-mono">
        Loading liquidity depth ladder...
      </div>
    )
  }

  const markPrice = calculateMarkPrice(reserves)

  const ladder = SIZE_STEPS.map((size) => {
    const colWei = BigInt(size) * 10n ** 18n
    const longQuote = calculatePerpQuote(reserves, colWei, 1, true, tradingFeeBps)
    const shortQuote = calculatePerpQuote(reserves, colWei, 1, false, tradingFeeBps)

    const longSlippage = markPrice > 0 ? ((longQuote.entryPrice - markPrice) / markPrice) * 100 : 0
    const shortSlippage = markPrice > 0 ? ((markPrice - shortQuote.entryPrice) / markPrice) * 100 : 0

    return {
      size,
      longPrice: longQuote.entryPrice,
      shortPrice: shortQuote.entryPrice,
      longSlippage,
      shortSlippage
    }
  })

  return (
    <div className="glass-panel p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <h3 className="text-xs font-black text-white uppercase tracking-widest">vAMM Depth & Liquidity Impact</h3>
        <span className="text-[10px] text-[#fde047] font-mono font-bold bg-white/5 px-3 py-1 rounded-full border border-white/10">
          Mark: ${markPrice.toFixed(2)}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300 font-mono border-collapse">
          <thead className="text-[10px] uppercase tracking-widest text-slate-400 border-b border-white/10 bg-black/60 font-sans">
            <tr>
              <th className="p-3">Notional ($)</th>
              <th className="p-3 text-emerald-400">Long Entry</th>
              <th className="p-3 text-emerald-400">Long Impact</th>
              <th className="p-3 text-rose-400">Short Entry</th>
              <th className="p-3 text-rose-400">Short Impact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {ladder.map((row) => (
              <tr key={row.size} className="hover:bg-white/5 transition-colors">
                <td className="p-3 font-bold text-white">${row.size.toLocaleString()}</td>
                <td className="p-3 text-emerald-300">${row.longPrice.toFixed(2)}</td>
                <td className="p-3 text-emerald-400 font-sans font-bold">+{row.longSlippage.toFixed(2)}%</td>
                <td className="p-3 text-rose-300">${row.shortPrice.toFixed(2)}</td>
                <td className="p-3 text-rose-400 font-sans font-bold">-{row.shortSlippage.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
