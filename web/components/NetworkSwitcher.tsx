'use client'

import React from 'react'
import { Globe, ChevronDown, Check } from 'lucide-react'
import { COSTON2_CHAIN_ID, FLARE_MAINNET_CHAIN_ID } from '@breezeswap/sdk'
import { useBreezeNetwork } from '../lib/hooks/useNetwork'

export function NetworkSwitcher() {
  const { chainId, isMainnet, setNetwork } = useBreezeNetwork()

  return (
    <div className="relative inline-block text-left">
      <div className="flex items-center gap-1 rounded-xl bg-slate-900 border border-slate-800 p-1 text-xs font-bold font-mono">
        <button
          onClick={() => setNetwork(COSTON2_CHAIN_ID)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
            !isMainnet
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          Coston2
        </button>

        <button
          onClick={() => setNetwork(FLARE_MAINNET_CHAIN_ID)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
            isMainnet
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Flare Mainnet
        </button>
      </div>
    </div>
  )
}
