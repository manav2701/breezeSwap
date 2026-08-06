'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { PlusCircle, RefreshCw, Search } from 'lucide-react'
import { getMarkets, type Market } from '@breezeswap/sdk'
import { MarketCard } from '../../components/MarketCard'
import { Reveal } from '../../components/motion/Reveal'
import { useBreezeSDK } from '../../lib/hooks/useBreezeSDK'
import { useBreezeNetwork } from '../../lib/hooks/useNetwork'

const STATUSES = ['ALL', 'OPEN', 'SETTLED'] as const
const VARIABLES = ['ALL', 'RAINFALL', 'TEMPERATURE'] as const
const REGIONS = ['ALL', 'Tokyo', 'Seoul', 'Singapore', 'Dubai', 'London'] as const

const VARIABLE_LABELS: Record<(typeof VARIABLES)[number], string> = {
  ALL: 'All',
  RAINFALL: 'Rainfall',
  TEMPERATURE: 'Temperature',
}

const STATUS_LABELS: Record<(typeof STATUSES)[number], string> = {
  ALL: 'All',
  OPEN: 'Open',
  SETTLED: 'Settled',
}

export default function MarketsPage() {
  const { indexerUrl } = useBreezeSDK()
  const { chainId } = useBreezeNetwork()

  const [markets, setMarkets] = useState<Market[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('ALL')
  const [region, setRegion] = useState<string>('ALL')
  const [variable, setVariable] = useState<(typeof VARIABLES)[number]>('ALL')
  const [query, setQuery] = useState('')

  async function loadMarkets() {
    setLoading(true)
    try {
      setMarkets((await getMarkets(indexerUrl, chainId)) ?? [])
    } catch {
      setMarkets([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMarkets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexerUrl, chainId])

  const filtered = useMemo(
    () =>
      markets.filter((m) => {
        if (status !== 'ALL' && m.status !== status) return false
        if (region !== 'ALL' && m.regionName !== region) return false
        if (variable !== 'ALL' && m.weatherVariable !== variable) return false
        if (query) {
          const q = query.toLowerCase()
          const matchesRegion = (m.regionName || '').toLowerCase().includes(q)
          const matchesAddress = m.contractAddress.toLowerCase().includes(q)
          if (!matchesRegion && !matchesAddress) return false
        }
        return true
      }),
    [markets, status, region, variable, query]
  )

  const hasFilters = status !== 'ALL' || region !== 'ALL' || variable !== 'ALL' || query !== ''

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b border-[color:var(--color-hairline)]">
        <div className="max-w-2xl">
          <p className="eyebrow mb-2">Classic markets</p>
          <h1 className="display-2 text-ink">Fixed-expiry weather contracts</h1>
          <p className="text-sm text-ink-muted mt-2 leading-relaxed">
            Pooled binary, linear and capped options that settle once against a verified reading.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadMarkets}
            className="btn btn-ghost btn-icon"
            aria-label="Refresh markets"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          </button>
          <Link href="/create" className="btn btn-primary">
            <PlusCircle className="w-4 h-4" aria-hidden />
            Create market
          </Link>
        </div>
      </header>

      {/* Filters — one row above the results, per the interaction spec. */}
      <div className="panel p-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="relative">
          <Search
            className="w-4 h-4 text-ink-faint absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden
          />
          <input
            type="search"
            placeholder="Search region or address"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search markets"
            className="field pl-9"
          />
        </div>

        <div className="segmented" role="group" aria-label="Status filter">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              data-active={status === s}
              aria-pressed={status === s}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          aria-label="Region filter"
          className="field"
        >
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r === 'ALL' ? 'All regions' : r}
            </option>
          ))}
        </select>

        <div className="segmented" role="group" aria-label="Weather metric filter">
          {VARIABLES.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVariable(v)}
              data-active={variable === v}
              aria-pressed={variable === v}
            >
              {VARIABLE_LABELS[v]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="panel skeleton h-56" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="panel p-14 text-center space-y-3">
          <p className="text-sm text-ink-muted">
            {markets.length === 0
              ? 'No classic markets deployed on this chain yet.'
              : 'No markets match these filters.'}
          </p>
          {hasFilters && markets.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setStatus('ALL')
                setRegion('ALL')
                setVariable('ALL')
                setQuery('')
              }}
              className="btn btn-ghost btn-sm"
            >
              Clear filters
            </button>
          ) : (
            <Link href="/create" className="btn btn-ghost btn-sm">
              Create the first one
            </Link>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-ink-faint">
            <span className="numeric">{filtered.length}</span> of{' '}
            <span className="numeric">{markets.length}</span> markets
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((m, i) => (
              <Reveal key={m.contractAddress} index={i} className="h-full">
                <MarketCard market={m} />
              </Reveal>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
