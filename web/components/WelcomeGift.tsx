'use client'

import { useEffect, useRef, useState } from 'react'
import { useAccount } from 'wagmi'
import { Gift, X, ExternalLink, Loader2 } from 'lucide-react'
import { useBreezeNetwork } from '../lib/hooks/useNetwork'

/**
 * Gives a wallet its first collateral, once, and tells it that happened.
 *
 * A new visitor connects, sees three markets and a mint form, and cannot use any of it,
 * because the collateral is a demo token they have no way to obtain. The drip removes that
 * dead end.
 *
 * Eligibility is checked before anything is offered, so a returning wallet is never shown a
 * prize it cannot collect. The claim is keyed to the address rather than to the browser: a
 * cleared local storage should not mint a second claim, and the same wallet on a second
 * device should not be offered one.
 *
 * Failures are deliberately silent. A faucet that is empty or unconfigured is not something
 * a visitor can act on, and an error toast on first connect reads as the product being
 * broken rather than a demo running out of play money.
 */

const EXPLORER = 'https://coston2-explorer.flare.network/tx/'

export function WelcomeGift() {
  const { address, isConnected } = useAccount()
  const { isSupported } = useBreezeNetwork()

  const [state, setState] = useState<'idle' | 'claiming' | 'granted'>('idle')
  const [amount, setAmount] = useState('1000')
  const [txHash, setTxHash] = useState<string | null>(null)

  // Guards against the effect firing twice for one address, which React does in
  // development and which would otherwise fire two claims for the same wallet.
  const attempted = useRef<string | null>(null)

  useEffect(() => {
    if (!isConnected || !address || !isSupported) return
    if (attempted.current === address) return
    attempted.current = address

    let cancelled = false

    ;(async () => {
      try {
        const check = await fetch(`/api/faucet?address=${address}`)
        if (!check.ok) return
        const eligibility = await check.json()
        if (cancelled || !eligibility?.eligible) return

        setState('claiming')

        const res = await fetch('/api/faucet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address }),
        })
        const data = await res.json()
        if (cancelled) return

        if (res.ok && data?.ok) {
          setAmount(data.amount ?? '1000')
          setTxHash(data.txHash ?? null)
          setState('granted')
        } else {
          setState('idle')
        }
      } catch {
        if (!cancelled) setState('idle')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [address, isConnected, isSupported])

  if (state === 'idle') return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-gift-title"
    >
      <div className="panel panel-solid max-w-sm w-full p-7 text-center relative">
        {state === 'granted' && (
          <button
            type="button"
            onClick={() => setState('idle')}
            className="absolute top-3 right-3 btn btn-ghost btn-icon"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <span className="w-14 h-14 rounded-2xl inset mx-auto flex items-center justify-center mb-5">
          {state === 'claiming' ? (
            <Loader2 className="w-6 h-6 text-accent animate-spin" aria-hidden />
          ) : (
            <Gift className="w-6 h-6 text-accent" aria-hidden />
          )}
        </span>

        {state === 'claiming' ? (
          <>
            <h2 id="welcome-gift-title" className="display-3 text-ink">
              Setting up your wallet
            </h2>
            <p className="text-sm text-ink-muted mt-2 leading-relaxed">
              Sending you some demo collateral so you can actually trade. This takes a few
              seconds.
            </p>
          </>
        ) : (
          <>
            <h2 id="welcome-gift-title" className="display-2 text-ink">
              Welcome to BreezeSwap
            </h2>
            <p className="text-sm text-ink-muted mt-2 leading-relaxed">
              We have sent you
            </p>
            <p className="metric-value-lg text-accent numeric my-3">{amount} bUSDT</p>
            <p className="text-sm text-ink-muted leading-relaxed">
              This is demo collateral on a test network, not real money. Use it to take a
              position on any market and see how settlement works.
            </p>

            {txHash && (
              <a
                href={`${EXPLORER}${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-ink-faint hover:text-accent transition-colors mt-4"
              >
                View the transaction
                <ExternalLink className="w-3 h-3" aria-hidden />
              </a>
            )}

            <button
              type="button"
              onClick={() => setState('idle')}
              className="btn btn-primary w-full mt-6"
            >
              Start trading
            </button>
          </>
        )}
      </div>
    </div>
  )
}
