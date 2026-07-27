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
      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 text-xs text-slate-400 text-center animate-pulse">
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
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3 shadow-xl">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider">vAMM Depth & Liquidity Impact Ladder</h3>
        <span className="text-[10px] text-cyan-400 font-mono">Current Mark: ${markPrice.toFixed(2)}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300 font-mono">
          <thead className="text-[10px] uppercase text-slate-400 border-b border-slate-800 bg-slate-950/60">
            <tr>
              <th className="p-2 font-sans">Trade Size ($)</th>
              <th className="p-2 font-sans text-emerald-400">Long Entry</th>
              <th className="p-2 font-sans text-emerald-400">Long Impact</th>
              <th className="p-2 font-sans text-rose-400">Short Entry</th>
              <th className="p-2 font-sans text-rose-400">Short Impact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {ladder.map((row) => (
              <tr key={row.size} className="hover:bg-slate-800/30 transition-colors">
                <td className="p-2 font-bold text-slate-200">${row.size.toLocaleString()}</td>
                <td className="p-2 text-emerald-300">${row.longPrice.toFixed(2)}</td>
                <td className="p-2 text-emerald-400 font-sans">+{row.longSlippage.toFixed(2)}%</td>
                <td className="p-2 text-rose-300">${row.shortPrice.toFixed(2)}</td>
                <td className="p-2 text-rose-400 font-sans">-{row.shortSlippage.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
