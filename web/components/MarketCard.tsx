import React from 'react'
import Link from 'next/link'
import { StatusBadge } from './StatusBadge'
import { CloudRain, Thermometer, ArrowUpRight, Calendar, Layers } from 'lucide-react'
import type { Market } from '@breezeswap/sdk'
import { timeUntilExpiry } from '@breezeswap/sdk'

const REGION_FLAGS: Record<string, string> = {
  Tokyo: '🇯🇵',
  Seoul: '🇰🇷',
  Singapore: '🇸🇬',
  Dubai: '🇦🇪',
  London: '🇬🇧',
}

function ensureMarketMapped(m: any): Market {
  if (!m) return m
  const rawLow = m.threshold_low ?? m.thresholdLow ?? 0
  const rawHigh = m.threshold_high ?? m.thresholdHigh ?? null
  const rawFinal = m.final_oracle_value ?? m.finalOracleValue ?? null

  return {
    contractAddress: m.contractAddress || m.contract_address || '',
    chainId: m.chainId || m.chain_id || 114,
    regionId: m.regionId || m.region_id || '',
    regionName: m.regionName || m.region_name || null,
    weatherVariable: m.weatherVariable || m.weather_variable || 'RAINFALL',
    payoffType: m.payoffType || m.payoff_type || 'CAPPED',
    thresholdLow: typeof rawLow === 'number' ? (rawLow > 1000 ? rawLow / 1e6 : rawLow) : Number(rawLow) / 1e6,
    thresholdHigh: rawHigh !== null && rawHigh !== undefined ? (typeof rawHigh === 'number' ? (rawHigh > 1000 ? rawHigh / 1e6 : rawHigh) : Number(rawHigh) / 1e6) : null,
    expiryTimestamp: m.expiryTimestamp || m.expiry_timestamp || '',
    collateralToken: m.collateralToken || m.collateral_token || '',
    status: m.status || 'OPEN',
    finalOracleValue: rawFinal !== null && rawFinal !== undefined ? (typeof rawFinal === 'number' ? (rawFinal > 1000 ? rawFinal / 1e6 : rawFinal) : Number(rawFinal) / 1e6) : null,
    longPayoutRatio: m.longPayoutRatio !== undefined && m.longPayoutRatio !== null ? m.longPayoutRatio : (m.long_payout_ratio ? Number(m.long_payout_ratio) : null),
    shortPayoutRatio: m.shortPayoutRatio !== undefined && m.shortPayoutRatio !== null ? m.shortPayoutRatio : (m.short_payout_ratio ? Number(m.short_payout_ratio) : null),
    settledAt: m.settledAt || m.settled_at || null,
    createdAt: m.createdAt || m.created_at || '',
    blockNumber: m.blockNumber || m.block_number || 0,
    txHash: m.txHash || m.tx_hash || ''
  }
}

export function MarketCard({ market: rawMarket }: { market: Market }) {
  const market = ensureMarketMapped(rawMarket)
  const flag = REGION_FLAGS[market.regionName || ''] || '🌐'
  const isRainfall = market.weatherVariable === 'RAINFALL'
  const unit = isRainfall ? 'mm' : '°C'

  return (
    <div className="glass-panel glass-panel-hover p-6 flex flex-col justify-between group">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{flag}</span>
            <div>
              <h3 className="text-lg font-black text-white group-hover:text-[#fde047] transition-colors">
                {market.regionName || 'Global Region'}
              </h3>
              <div className="flex items-center gap-1 text-xs text-slate-400 font-mono uppercase">
                {isRainfall ? (
                  <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
                ) : (
                  <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>{market.weatherVariable}</span>
              </div>
            </div>
          </div>
          <StatusBadge status={market.status} />
        </div>

        <div className="space-y-3 my-5 py-4 border-y border-white/10 text-xs font-mono">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5 font-sans font-medium uppercase text-[10px]">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              Payoff Structure
            </span>
            <span className="font-bold text-black bg-[#fde047] px-3 py-0.5 rounded-full text-[10px]">
              {market.payoffType}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-sans font-medium uppercase text-[10px]">Threshold</span>
            <span className="font-bold text-white">
              {market.thresholdHigh ? `${market.thresholdLow} – ${market.thresholdHigh} ${unit}` : `${market.thresholdLow} ${unit}`}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5 font-sans font-medium uppercase text-[10px]">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Expiry
            </span>
            <span className="text-slate-300 font-medium">
              {timeUntilExpiry(market.expiryTimestamp)}
            </span>
          </div>
        </div>
      </div>

      <div className="pt-2">
        <Link
          href={`/markets/${market.contractAddress}`}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-full bg-white/10 group-hover:bg-[#fde047] text-slate-200 group-hover:text-black text-xs font-extrabold uppercase tracking-wider transition-all duration-300"
        >
          View Market Detail
          <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}
