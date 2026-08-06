import React from 'react'

/**
 * A region's identity tile.
 *
 * This replaces the flag emoji the cards used to carry. Windows has no glyphs
 * for regional-indicator pairs, so `🇯🇵` rendered as the literal letters "JP"
 * in a proportional face — which read as a rendering bug rather than a flag.
 * A deliberate monogram works on every platform and sits better with the rest
 * of the type.
 *
 * The tint is derived from the region name rather than stored per region, so a
 * market in a city nobody has hardcoded still gets a stable colour instead of
 * falling back to grey.
 */

const TINTS = [
  { bg: 'rgba(253, 224, 71, 0.12)', fg: '#fde047', ring: 'rgba(253, 224, 71, 0.24)' },
  { bg: 'rgba(125, 211, 252, 0.12)', fg: '#7dd3fc', ring: 'rgba(125, 211, 252, 0.24)' },
  { bg: 'rgba(52, 211, 153, 0.12)', fg: '#34d399', ring: 'rgba(52, 211, 153, 0.24)' },
  { bg: 'rgba(196, 181, 253, 0.12)', fg: '#c4b5fd', ring: 'rgba(196, 181, 253, 0.24)' },
  { bg: 'rgba(251, 191, 36, 0.12)', fg: '#fbbf24', ring: 'rgba(251, 191, 36, 0.24)' },
]

function tintFor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return TINTS[h % TINTS.length]
}

function initials(name: string) {
  const cleaned = name.trim()
  if (!cleaned) return '??'
  const words = cleaned.split(/\s+/)
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase()
  return cleaned.slice(0, 2).toUpperCase()
}

export function RegionMark({
  region,
  size = 'md',
}: {
  region: string | null | undefined
  size?: 'sm' | 'md'
}) {
  const name = region || 'Global'
  const tint = tintFor(name)
  const dims = size === 'sm' ? 'w-8 h-8 text-[11px]' : 'w-10 h-10 text-xs'

  return (
    <span
      className={`${dims} rounded-xl flex items-center justify-center shrink-0 numeric font-semibold tracking-tight`}
      style={{
        backgroundColor: tint.bg,
        color: tint.fg,
        boxShadow: `inset 0 0 0 1px ${tint.ring}`,
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}
