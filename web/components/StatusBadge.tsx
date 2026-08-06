import React from 'react'

/**
 * Market lifecycle state.
 *
 * Both variants carry the word, not just a colour — this badge is the only
 * thing distinguishing a tradeable market from a settled one on a card.
 */
export function StatusBadge({ status }: { status: 'OPEN' | 'SETTLED' | string }) {
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
