import React from 'react'
import Link from 'next/link'
import { StatusBadge } from './StatusBadge'
import { RegionMark } from './RegionMark'
import { CloudRain, Thermometer, ArrowRight } from 'lucide-react'
import type { Market } from '@breezeswap/sdk'
import { timeUntilExpiry } from '@breezeswap/sdk'

/**
 * The indexer returns snake_case, the SDK returns camelCase, and thresholds
 * arrive either as display units or as raw 1e6 oracle units depending on which
 * endpoint served them. Normalise once, here, so the card never renders
 * "50000000 mm".
 */
function ensureMarketMapped(m: any): Market {
  if (!m) return m
  const scale = (raw: unknown): number | null => {
    if (raw === null || raw === undefined || raw === '') return null
    const n = Number(raw)
    if (!Number.isFinite(n)) return null
    // Oracle units are 1e6-scaled; a real rainfall/temperature reading is never
    // in the thousands, so a large value is an unscaled one.
    return n > 1000 ? n / 1e6 : n
  }

  return {
    contractAddress: m.contractAddress || m.contract_address || '',
    chainId: m.chainId || m.chain_id || 114,
    regionId: m.regionId || m.region_id || '',
    regionName: m.regionName || m.region_name || null,
    weatherVariable: m.weatherVariable || m.weather_variable || 'RAINFALL',
    payoffType: m.payoffType || m.payoff_type || 'CAPPED',
    thresholdLow: scale(m.threshold_low ?? m.thresholdLow) ?? 0,
    thresholdHigh: scale(m.threshold_high ?? m.thresholdHigh),
    expiryTimestamp: m.expiryTimestamp || m.expiry_timestamp || '',
    collateralToken: m.collateralToken || m.collateral_token || '',
    status: m.status || 'OPEN',
    finalOracleValue: scale(m.final_oracle_value ?? m.finalOracleValue),
    longPayoutRatio:
      m.longPayoutRatio ?? (m.long_payout_ratio != null ? Number(m.long_payout_ratio) : null),
    shortPayoutRatio:
      m.shortPayoutRatio ?? (m.short_payout_ratio != null ? Number(m.short_payout_ratio) : null),
    settledAt: m.settledAt || m.settled_at || null,
    createdAt: m.createdAt || m.created_at || '',
    blockNumber: m.blockNumber || m.block_number || 0,
    txHash: m.txHash || m.tx_hash || '',
  }
}

export function MarketCard({ market: rawMarket }: { market: Market }) {
  const market = ensureMarketMapped(rawMarket)
  const isRainfall = market.weatherVariable === 'RAINFALL'
  const unit = isRainfall ? 'mm' : '°C'
  const Icon = isRainfall ? CloudRain : Thermometer

  const range =
    market.thresholdHigh != null
      ? `${market.thresholdLow}–${market.thresholdHigh}${unit}`
      : `≥ ${market.thresholdLow}${unit}`

  return (
    <Link
      href={`/markets/${market.contractAddress}`}
      className="panel panel-hover p-5 flex flex-col gap-5 group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <RegionMark region={market.regionName} />
          <div className="min-w-0">
            <h3 className="display-3 text-ink truncate group-hover:text-accent transition-colors">
              {market.regionName || 'Global region'}
            </h3>
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-faint mt-0.5">
              <Icon className="w-3.5 h-3.5" aria-hidden />
              {isRainfall ? 'Rainfall' : 'Temperature'}
            </span>
          </div>
        </div>
        <StatusBadge status={market.status} />
      </div>

      <dl className="grid grid-cols-3 gap-3">
        <div className="inset px-3 py-2.5 min-w-0">
          <dt className="metric-label">Payoff</dt>
          <dd className="text-sm text-ink font-medium mt-0.5 truncate">{market.payoffType}</dd>
        </div>
        <div className="inset px-3 py-2.5 min-w-0">
          <dt className="metric-label">Strike</dt>
          <dd className="numeric text-sm text-ink font-medium mt-0.5 truncate" title={range}>
            {range}
          </dd>
        </div>
        <div className="inset px-3 py-2.5 min-w-0">
          <dt className="metric-label">Expiry</dt>
          <dd className="text-sm text-ink font-medium mt-0.5 truncate">
            {timeUntilExpiry(market.expiryTimestamp)}
          </dd>
        </div>
      </dl>

      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted group-hover:text-accent transition-colors mt-auto">
        View market
        <ArrowRight
          className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>
    </Link>
  )
}
