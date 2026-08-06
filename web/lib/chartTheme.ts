/**
 * One source of truth for every chart in the app.
 *
 * Before this existed each chart hard-coded its own axis stroke, tooltip
 * background and series colour, so the payoff curve, the mark price area and
 * the funding bars looked like three products. Everything visual a Recharts
 * chart needs is spread from here.
 *
 * Colour assignment follows the job the colour does, not the order the series
 * happens to be declared in:
 *   - LONG / SHORT are a *status* pair, always accompanied by their label.
 *   - A single-series chart uses ACCENT (or COOL for the secondary chart on the
 *     same screen) — never a rotating hue.
 */

export const CHART = {
  /* Series */
  long: '#34d399',
  short: '#f43f5e',
  accent: '#fde047',
  cool: '#7dd3fc',
  warn: '#fbbf24',
  neutral: '#7a8492',

  /* Chrome */
  axis: '#7a8492',
  grid: 'rgba(255, 255, 255, 0.07)',
  reference: 'rgba(255, 255, 255, 0.28)',
  ink: '#f4f6f9',
  inkMuted: '#a2abb9',
} as const

/**
 * Recharts styles its default tooltip inline, so it cannot be themed from CSS
 * alone. `wrapperClassName` gets our class; `contentStyle` neutralises the
 * inline defaults that would otherwise win.
 */
export const tooltipProps = {
  wrapperClassName: 'chart-tooltip',
  contentStyle: {
    background: 'transparent',
    border: 'none',
    borderRadius: 0,
    boxShadow: 'none',
    padding: 0,
  },
  itemStyle: { color: CHART.ink },
  labelStyle: { color: CHART.axis },
  cursor: { stroke: CHART.reference, strokeWidth: 1, strokeDasharray: '3 3' },
} as const

/** Shared axis chrome. Recessive by design — the data is the figure. */
export const axisProps = {
  stroke: 'transparent',
  tick: { fill: CHART.axis, fontSize: 10 },
  tickLine: false,
  axisLine: false,
} as const

export const gridProps = {
  stroke: CHART.grid,
  strokeDasharray: '3 3',
  vertical: false,
} as const

/* ------------------------------------------------------------------ */
/* Formatters                                                          */
/* ------------------------------------------------------------------ */

/** Compact axis money: 1.2K / 3.4M, never a 9-digit tick label. */
export function formatAxisMoney(v: number): string {
  if (!Number.isFinite(v)) return '—'
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`
  if (abs >= 1_000) return `$${(v / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`
  return `$${v.toFixed(abs < 10 ? 2 : 0)}`
}

/** Full-precision money for tooltips and metric values. */
export function formatMoney(v: number, decimals = 2): string {
  if (!Number.isFinite(v)) return '—'
  return `$${v.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

export function formatPercent(v: number, decimals = 2): string {
  if (!Number.isFinite(v)) return '—'
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(decimals)}%`
}

/**
 * Pads a numeric domain so a flat or near-flat series does not render as a
 * line glued to the top of the plot area. Recharts' `['auto','auto']` collapses
 * to a zero-height domain when every value is identical.
 */
export function paddedDomain(values: number[], padRatio = 0.12): [number, number] {
  const finite = values.filter((v) => Number.isFinite(v))
  if (finite.length === 0) return [0, 1]
  const min = Math.min(...finite)
  const max = Math.max(...finite)
  if (min === max) {
    const pad = Math.abs(min) * padRatio || 1
    return [min - pad, max + pad]
  }
  const pad = (max - min) * padRatio
  return [min - pad, max + pad]
}
