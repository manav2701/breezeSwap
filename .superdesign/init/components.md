# BreezeSwap Shared UI Components

## MarketCard
- Source: `web/components/MarketCard.tsx`
- Description: Displays a classic weather option market card with region, status, threshold, expiry countdown, and payout type.

```tsx
import React from 'react'
import Link from 'next/link'
import { Calendar, Compass, ArrowUpRight, CheckCircle2, RefreshCw } from 'lucide-react'
import type { Market } from '@breezeswap/sdk'

export function MarketCard({ market }: { market: Market }) {
  const isSettled = market.status === 'SETTLED'
  const isCapped = market.payoffType === 'CAPPED'

  return (
    <Link
      href={`/markets/${market.contractAddress}`}
      className="group relative block rounded-3xl bg-slate-900/60 border border-slate-800/80 p-6 hover:border-cyan-500/50 hover:bg-slate-900/90 transition-all duration-300 shadow-xl overflow-hidden"
    >
      <div className="flex items-center justify-between gap-2 mb-4">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 text-cyan-400 text-xs font-semibold font-mono border border-slate-700">
          <Compass className="w-3.5 h-3.5" />
          {market.regionName || 'Global'}
        </span>

        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono uppercase ${
            isSettled
              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          }`}
        >
          {isSettled ? <CheckCircle2 className="w-3 h-3" /> : <RefreshCw className="w-3 h-3 animate-spin" />}
          {market.status}
        </span>
      </div>

      <div className="space-y-1 mb-6">
        <h3 className="text-xl font-bold text-white group-hover:text-cyan-300 transition-colors">
          {market.weatherVariable} Derivative
        </h3>
        <p className="text-xs text-slate-400">
          {market.payoffType} curve payout above {market.thresholdLow} {market.weatherVariable === 'RAINFALL' ? 'mm' : '°C'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 py-3 px-4 rounded-2xl bg-slate-950/60 border border-slate-800/60 mb-6 text-xs font-mono">
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-sans font-semibold">Low Target</span>
          <span className="text-slate-200 font-bold">{market.thresholdLow}</span>
        </div>
        {isCapped && (
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-sans font-semibold">High Cap</span>
            <span className="text-slate-200 font-bold">{market.thresholdHigh ?? '—'}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/60 pt-4 font-mono">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <span>{new Date(market.expiryTimestamp).toLocaleDateString()}</span>
        </div>
        <span className="text-cyan-400 font-semibold group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-0.5">
          Trade <ArrowUpRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Link>
  )
}
```

## PerpStatsHeader
- Source: `web/components/PerpStatsHeader.tsx`
- Description: Header component displaying vAMM mark price, oracle price, funding rate, live countdown timer, 24h volume, and open interest ratio bar.
