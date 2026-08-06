import React from 'react'
import { ExternalLink } from 'lucide-react'

/**
 * A hash or address linked to the Coston2 explorer.
 *
 * Always renders truncated. A full 66-character hash is the single most
 * reliable way to blow a table column past its container, and the middle of a
 * hash carries no information a reader uses.
 */
export function TxLink({
  hash,
  label,
  type = 'tx',
}: {
  hash: string
  label?: string
  type?: 'tx' | 'address'
}) {
  if (!hash) return <span className="text-ink-faint">—</span>

  const truncated = `${hash.slice(0, 6)}…${hash.slice(-4)}`
  const explorerUrl = `https://coston2-explorer.flare.network/${type}/${hash}`

  return (
    <a
      href={explorerUrl}
      target="_blank"
      rel="noreferrer"
      title={hash}
      className="inline-flex items-center gap-1 numeric text-xs text-ink-muted hover:text-accent transition-colors max-w-full"
    >
      <span className="truncate-hash">{label || truncated}</span>
      <ExternalLink className="w-3 h-3 shrink-0" aria-hidden />
    </a>
  )
}
