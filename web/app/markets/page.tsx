'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { MarketCard } from '../../components/MarketCard'
import { PlusCircle, Search, Filter, RefreshCw } from 'lucide-react'
import { getMarkets, type Market } from '@breezeswap/sdk'
import { useBreezeSDK } from '../../lib/hooks/useBreezeSDK'

export default function MarketsPage() {
  const { indexerUrl } = useBreezeSDK()
  const [markets, setMarkets] = useState<Market[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'SETTLED'>('ALL')
  const [regionFilter, setRegionFilter] = useState<string>('ALL')
  const [variableFilter, setVariableFilter] = useState<'ALL' | 'RAINFALL' | 'TEMPERATURE'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  async function loadMarkets() {
    setLoading(true)
    try {
      const data = await getMarkets(indexerUrl)
      setMarkets(data)
    } catch {
      setMarkets([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMarkets()
  }, [indexerUrl])

  const filteredMarkets = markets.filter((m) => {
    if (statusFilter !== 'ALL' && m.status !== statusFilter) return false
    if (regionFilter !== 'ALL' && m.regionName !== regionFilter) return false
    if (variableFilter !== 'ALL' && m.weatherVariable !== variableFilter) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const regionMatch = (m.regionName || '').toLowerCase().includes(query)
      const addressMatch = m.contractAddress.toLowerCase().includes(query)
      if (!regionMatch && !addressMatch) return false
    }
    return true
  })

  return (
    <div className="space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Weather Markets</h1>
          <p className="text-xs text-slate-400">Browse, filter, and trade active weather derivative contracts.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadMarkets}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
            title="Refresh Markets"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <Link
            href="/create"
            className="flex items-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold text-xs hover:opacity-90 transition-all shadow-lg shadow-emerald-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            Create Market
          </Link>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search region or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
          {(['ALL', 'OPEN', 'SETTLED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === s ? 'bg-slate-800 text-cyan-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Region Filter */}
        <div className="relative">
          <Filter className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-cyan-500 transition-colors appearance-none"
          >
            <option value="ALL">All Regions</option>
            <option value="Tokyo">Tokyo 🇯🇵</option>
            <option value="Seoul">Seoul 🇰🇷</option>
            <option value="Singapore">Singapore 🇸🇬</option>
            <option value="Dubai">Dubai 🇦🇪</option>
            <option value="London">London 🇬🇧</option>
          </select>
        </div>

        {/* Weather Variable Filter */}
        <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
          {(['ALL', 'RAINFALL', 'TEMPERATURE'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVariableFilter(v)}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors ${
                variableFilter === v ? 'bg-slate-800 text-cyan-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {v === 'ALL' ? 'All Metrics' : v}
            </button>
          ))}
        </div>
      </div>

      {/* Market Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-2xl bg-slate-900/40 border border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : filteredMarkets.length === 0 ? (
        <div className="p-16 text-center rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <p className="text-slate-300 font-semibold">No matching markets found</p>
          <p className="text-xs text-slate-500">Try adjusting your search query or region/status filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filteredMarkets.map((m) => (
            <MarketCard key={m.contractAddress} market={m} />
          ))}
        </div>
      )}
    </div>
  )
}
