'use client'

import React from 'react'
import { AlertTriangle, FlaskConical } from 'lucide-react'
import { useBreezeNetwork } from '../lib/hooks/useNetwork'

/**
 * The testnet notice.
 *
 * Deliberately quiet. It used to be a full-width solid yellow bar, which made
 * the single loudest element on every page a piece of standing boilerplate
 * — and trained the reader to ignore the strip where the *wrong network*
 * warning also appears.
 */
export function NetworkBanner() {
  const { isWrongNetwork, isSwitching, switchToSupported } = useBreezeNetwork()

  if (isWrongNetwork) {
    return (
      <div
        role="alert"
        className="w-full bg-short text-[#2b0710] py-2 px-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs font-semibold"
      >
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden />
        <span>Unsupported network — BreezeSwap is deployed on Coston2 only.</span>
        <button
          type="button"
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
    <div className="w-full border-b border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] py-1.5 px-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-ink-muted">
      <FlaskConical className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden />
      <span>
        <span className="text-ink font-medium">Coston2 testnet</span> · chain 114 · test funds only.
        Not deployed on Flare mainnet.
      </span>
    </div>
  )
}
