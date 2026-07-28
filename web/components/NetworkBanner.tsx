'use client'

import React from 'react'
import { AlertTriangle, ShieldCheck } from 'lucide-react'
import { useBreezeNetwork } from '../lib/hooks/useNetwork'

export function NetworkBanner() {
  const { isMainnet } = useBreezeNetwork()

  if (isMainnet) {
    return (
      <div className="w-full bg-emerald-400 py-1.5 px-4 text-center text-xs font-black text-[#0a0a0a] flex items-center justify-center gap-2 font-mono">
        <ShieldCheck className="w-4 h-4 shrink-0 text-[#0a0a0a]" />
        <span>Connected to <strong>Flare Mainnet (Chain ID 14)</strong> — Transactions execute on-chain with real assets.</span>
      </div>
    )
  }

  return (
    <div className="w-full bg-[#fde047] py-1.5 px-4 text-center text-xs font-black text-[#0a0a0a] flex items-center justify-center gap-2 font-mono">
      <AlertTriangle className="w-4 h-4 shrink-0 text-[#0a0a0a]" />
      <span>Connected to <strong>Coston2 Testnet (Chain ID 114)</strong> — Simulated test funds only. Switch networks via navbar toggle.</span>
    </div>
  )
}
