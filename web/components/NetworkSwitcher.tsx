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
        type="button"
        onClick={switchToSupported}
        disabled={isSwitching}
        className="btn btn-sm btn-short"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden />
        {isSwitching ? 'Switching…' : 'Wrong network'}
      </button>
    )
  }

  return (
    <span className="chip">
      <span className="pulse-dot text-long" aria-hidden />
      Coston2
    </span>
  )
}
