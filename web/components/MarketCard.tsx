import React from 'react'
import Link from 'next/link'
import { StatusBadge } from './StatusBadge'
import { CloudRain, Thermometer, ArrowRight, Calendar, Layers } from 'lucide-react'
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
    <div className="group relative rounded-2xl bg-slate-900/80 border border-slate-800 p-5 hover:border-cyan-500/50 hover:shadow-xl hover:shadow-cyan-500/10 transition-all duration-300 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{flag}</span>
            <div>
              <h3 className="text-base font-bold text-white group-hover:text-cyan-400 transition-colors">
                {market.regionName || 'Global Region'}
              </h3>
              <div className="flex items-center gap-1 text-xs text-slate-400">
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

        <div className="space-y-2.5 my-4 py-3 border-y border-slate-800/80 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              Payoff Structure
            </span>
            <span className="font-semibold text-slate-200 bg-slate-800 px-2 py-0.5 rounded-md">
              {market.payoffType}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Threshold</span>
            <span className="font-semibold text-cyan-400 font-mono">
              {market.thresholdHigh ? `${market.thresholdLow} – ${market.thresholdHigh} ${unit}` : `${market.thresholdLow} ${unit}`}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
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
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 group-hover:bg-cyan-500 text-slate-200 group-hover:text-slate-950 text-sm font-semibold transition-all duration-300"
        >
          View Market Detail
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}
