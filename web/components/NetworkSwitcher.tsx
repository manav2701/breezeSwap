'use client'

import React from 'react'
import { useBreezeNetwork } from '../lib/hooks/useNetwork'

/**
 * Network status pill.
 *
 * BreezeSwap is deployed on a single chain, so this reports the active network
 * and offers a switch only when the wallet is on an unsupported one — there is
 * nothing to toggle between.
 */
export function NetworkSwitcher() {
  const { isWrongNetwork, isSwitching, switchToSupported } = useBreezeNetwork()

  if (isWrongNetwork) {
    return (
      <button
        onClick={switchToSupported}
        disabled={isSwitching}
        className="flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1.5 text-xs font-black font-mono text-white transition-all hover:bg-red-600 disabled:opacity-60"
      >
        <span className="w-2 h-2 rounded-full bg-white" />
        {isSwitching ? 'Switching…' : 'Wrong network'}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1.5 rounded-full bg-[#141414] border border-white/10 px-3 py-1.5 text-xs font-black font-mono text-white">
      <span className="w-2 h-2 rounded-full bg-[#fde047]" />
      Coston2
    </div>
  )
}
