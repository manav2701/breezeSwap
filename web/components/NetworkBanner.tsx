'use client'

import React from 'react'
import { AlertTriangle, ShieldCheck } from 'lucide-react'
import { useBreezeNetwork } from '../lib/hooks/useNetwork'

export function NetworkBanner() {
  const { isMainnet } = useBreezeNetwork()

  if (isMainnet) {
    return (
      <div className="w-full bg-emerald-500/10 border-b border-emerald-500/20 py-1.5 px-4 text-center text-xs font-semibold text-emerald-300 flex items-center justify-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <span>You are connected to <strong>Flare Mainnet (Chain ID 14)</strong> — Transactions execute on-chain with real assets.</span>
      </div>
    )
  }

  return (
    <div className="w-full bg-amber-500/10 border-b border-amber-500/20 py-1.5 px-4 text-center text-xs font-semibold text-amber-300 flex items-center justify-center gap-2">
      <AlertTriangle className="w-4 h-4 text-amber-400" />
      <span>You are on <strong>Coston2 Testnet (Chain ID 114)</strong> — Simulated test funds only. Switch networks via top navbar.</span>
    </div>
  )
}
