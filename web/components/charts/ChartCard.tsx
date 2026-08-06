'use client'

import React from 'react'

type ChartCardProps = {
  title: string
  /** One line under the title saying what the reader is looking at. */
  subtitle?: string
  /** Right-aligned controls — interval toggles, a mark-price chip. */
  actions?: React.ReactNode
  /** Plot height in px. Fixed so the SVG can never size itself off-panel. */
  height?: number
  loading?: boolean
  /** Rendered instead of the plot when there is nothing to draw. */
  empty?: boolean
  emptyLabel?: string
  /** Legend / footnote strip under the plot. */
  footer?: React.ReactNode
  className?: string
  children: React.ReactNode
}

/**
 * The frame every chart sits in.
 *
 * Two things here are load-bearing rather than decorative:
 *
 *  - the plot area has a *fixed pixel height* and `min-w-0`. A Recharts
 *    ResponsiveContainer measures its parent; inside a flex or grid column
 *    whose basis is `auto`, an unconstrained parent lets the SVG grow and push
 *    the column — and then the page — wider than the viewport.
 *  - loading and empty render at that same height, so a panel does not
 *    collapse and then jump when data lands.
 */
export function ChartCard({
  title,
  subtitle,
  actions,
  height = 260,
  loading = false,
  empty = false,
  emptyLabel = 'No data for this range yet.',
  footer,
  className = '',
  children,
}: ChartCardProps) {
  return (
    <section className={`panel p-5 sm:p-6 ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 pb-4 mb-4 border-b border-[color:var(--color-hairline)]">
        <div className="min-w-0">
          <h3 className="display-3 text-ink">{title}</h3>
          {subtitle && <p className="text-xs text-ink-faint mt-1 leading-relaxed">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </header>

      <div className="chart-frame" style={{ height }}>
        {loading ? (
          <div className="h-full w-full flex flex-col items-center justify-center gap-3">
            <div className="w-6 h-6 rounded-full border-2 border-[color:var(--color-hairline-strong)] border-t-accent animate-spin" />
            <span className="text-xs text-ink-faint">Loading…</span>
          </div>
        ) : empty ? (
          <div className="h-full w-full flex flex-col items-center justify-center gap-2 px-6 text-center">
            <div className="w-9 h-9 rounded-xl inset flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-ink-faint" fill="none" aria-hidden>
                <path
                  d="M3 17l5-6 4 4 4-7 5 6"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="text-xs text-ink-faint max-w-xs leading-relaxed">{emptyLabel}</p>
          </div>
        ) : (
          children
        )}
      </div>

      {footer && (
        <div className="mt-4 pt-3 border-t border-[color:var(--color-hairline)]">{footer}</div>
      )}
    </section>
  )
}

/**
 * Legend swatch + label.
 *
 * Charts with two or more series always render these: with a green/red pair
 * the word is what carries identity for a colour-vision-deficient reader, not
 * the swatch beside it.
 */
export function LegendKey({
  color,
  label,
  value,
}: {
  color: string
  label: string
  value?: string
}) {
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-[color:var(--color-surface)]"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="text-ink-muted">{label}</span>
      {value && <span className="numeric text-ink font-medium">{value}</span>}
    </span>
  )
}
