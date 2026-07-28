'use client'

import React from 'react'
import { COSTON2_CHAIN_ID, FLARE_MAINNET_CHAIN_ID } from '@breezeswap/sdk'
import { useBreezeNetwork } from '../lib/hooks/useNetwork'

export function NetworkSwitcher() {
  const { chainId, isMainnet, setNetwork } = useBreezeNetwork()

  return (
    <div className="relative inline-block text-left">
      <div className="flex items-center gap-1 rounded-full bg-[#141414] border border-white/10 p-1 text-xs font-black font-mono">
        <button
          onClick={() => setNetwork(COSTON2_CHAIN_ID)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${
            !isMainnet
              ? 'bg-[#fde047] text-[#0a0a0a] font-black shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${!isMainnet ? 'bg-[#0a0a0a]' : 'bg-[#fde047]'}`} />
          Coston2
        </button>

        <button
          onClick={() => setNetwork(FLARE_MAINNET_CHAIN_ID)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${
            isMainnet
              ? 'bg-emerald-400 text-[#0a0a0a] font-black shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isMainnet ? 'bg-[#0a0a0a]' : 'bg-emerald-400'}`} />
          Mainnet
        </button>
      </div>
    </div>
  )
}
