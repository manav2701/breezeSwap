import React from 'react'
import { ExternalLink } from 'lucide-react'

export function TxLink({ hash, label }: { hash: string; label?: string }) {
  if (!hash) return <span>—</span>
  const truncated = `${hash.slice(0, 6)}...${hash.slice(-4)}`
  const explorerUrl = `https://coston2-explorer.flare.network/tx/${hash}`

  return (
    <a
      href={explorerUrl}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-mono text-xs hover:underline transition-colors"
    >
      {label || truncated}
      <ExternalLink className="w-3 h-3" />
    </a>
  )
}
