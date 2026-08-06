'use client'

import React from 'react'
import { AlertTriangle, FlaskConical } from 'lucide-react'
import { useBreezeNetwork } from '../lib/hooks/useNetwork'

export function NetworkBanner() {
  const { isWrongNetwork, isSwitching, switchToSupported } = useBreezeNetwork()

  if (isWrongNetwork) {
    return (
      <div className="w-full bg-red-500 py-1.5 px-4 text-center text-xs font-black text-white flex items-center justify-center gap-2 font-mono">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>Unsupported network — BreezeSwap is deployed on Coston2 only.</span>
        <button
          onClick={switchToSupported}
          disabled={isSwitching}
          className="underline underline-offset-2 hover:no-underline disabled:opacity-60"
        >
          {isSwitching ? 'Switching…' : 'Switch to Coston2'}
        </button>
      </div>
    )
  }

  return (
    <div className="w-full bg-[#fde047] py-1.5 px-4 text-center text-xs font-black text-[#0a0a0a] flex items-center justify-center gap-2 font-mono">
      <FlaskConical className="w-4 h-4 shrink-0" />
      <span>
        <strong>Coston2 Testnet (Chain ID 114)</strong> — test funds only. BreezeSwap is not deployed on Flare Mainnet.
      </span>
    </div>
  )
}
