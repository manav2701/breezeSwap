import React from 'react'

/**
 * Market lifecycle state.
 *
 * Three states, not two. A market past its expiry timestamp is still `OPEN`
 * on-chain until someone calls permissionless settlement — that gap is
 * routine, not an error, but showing a plain "Open" badge next to an
 * "Expired" timestamp reads as a contradiction. `isExpired` disambiguates it
 * with its own label and colour rather than reusing the tradeable-market chip.
 */
export function StatusBadge({
  status,
  isExpired = false,
}: {
  status: 'OPEN' | 'SETTLED' | string
  isExpired?: boolean
}) {
  if (status === 'OPEN' && isExpired) {
    return (
      <span className="chip chip-warn" title="Expiry has passed. Settlement is permissionless — anyone can trigger it.">
        <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-warn)]" aria-hidden />
        Awaiting settlement
      </span>
    )
  }

  if (status === 'OPEN') {
    return (
      <span className="chip chip-long">
        <span className="pulse-dot" aria-hidden />
        Open
      </span>
    )
  }

  return (
    <span className="chip">
      <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-ink-faint)]" aria-hidden />
      Settled
    </span>
  )
}
