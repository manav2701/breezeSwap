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
    <div className="space-y-8 py-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tight text-white">Classic Weather Swaps</h1>
          <p className="text-xs text-slate-400 font-mono">Browse, filter, and trade CME-style pooled binary and capped weather options.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadMarkets}
            className="p-3 rounded-full bg-white/10 border border-white/10 text-slate-300 hover:text-black hover:bg-[#fde047] transition-all"
            title="Refresh Markets"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <Link
            href="/create"
            className="btn-cyber-yellow py-3 px-6 text-xs uppercase tracking-wider font-extrabold flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            Create Market
          </Link>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 glass-panel">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Search region or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/80 border border-white/10 text-white rounded-full pl-9 pr-4 py-2.5 text-xs font-mono focus:outline-none focus:border-[#fde047] transition-colors"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1 bg-black/80 p-1 rounded-full border border-white/10">
          {(['ALL', 'OPEN', 'SETTLED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`flex-1 py-1.5 px-3 rounded-full text-[10px] font-extrabold uppercase transition-all ${
                statusFilter === s ? 'bg-[#fde047] text-black shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Region Filter */}
        <div className="relative">
          <Filter className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="w-full bg-black/80 border border-white/10 text-white rounded-full pl-9 pr-4 py-2.5 text-xs font-mono focus:outline-none focus:border-[#fde047] transition-colors appearance-none"
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
        <div className="flex items-center gap-1 bg-black/80 p-1 rounded-full border border-white/10">
          {(['ALL', 'RAINFALL', 'TEMPERATURE'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVariableFilter(v)}
              className={`flex-1 py-1.5 px-3 rounded-full text-[10px] font-extrabold uppercase transition-all ${
                variableFilter === v ? 'bg-[#fde047] text-black shadow-sm' : 'text-slate-400 hover:text-white'
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
            <div key={i} className="h-64 glass-panel animate-pulse bg-white/5" />
          ))}
        </div>
      ) : filteredMarkets.length === 0 ? (
        <div className="p-16 glass-panel text-center space-y-3 font-mono">
          <p className="text-slate-300 font-bold">No matching markets found</p>
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
