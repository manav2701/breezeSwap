'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, RefreshCw } from 'lucide-react'
import {
  getPerpMarkets,
  getPerpMarketStats,
  CONTRACT_ADDRESSES,
  COSTON2_CHAIN_ID,
  decodeRegionId,
  type PerpMarket,
} from '@breezeswap/sdk'
import { useBreezeSDK } from '../../lib/hooks/useBreezeSDK'
import { useBreezeNetwork } from '../../lib/hooks/useNetwork'
import { DemoBadge } from '../../components/DemoBadge'
import { RegionMark } from '../../components/RegionMark'
import { Reveal } from '../../components/motion/Reveal'
import { formatMoney } from '../../lib/chartTheme'

/**
 * The three markets deployed by `DeployPerpTestnet.s.sol`. Shown when the
 * indexer has not caught up yet so the page is never a blank grid — the
 * addresses are real, the prices are placeholders and labelled as such.
 */
const FALLBACK_PERPS: PerpMarket[] = [
  {
    contractAddress: CONTRACT_ADDRESSES[COSTON2_CHAIN_ID].tokyoPerpMarket,
    chainId: COSTON2_CHAIN_ID,
    regionId: 'TOKYO_RAINFALL',
    regionName: 'Tokyo',
    collateralToken: CONTRACT_ADDRESSES[COSTON2_CHAIN_ID].mockUsdt,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    blockNumber: 0,
    txHash: '',
    markPrice: 25.0,
    oraclePrice: 25.0,
    fundingRate: 0.05,
    totalLongOpenInterest: '1000000000000000000000',
    totalShortOpenInterest: '800000000000000000000',
  },
  {
    contractAddress: CONTRACT_ADDRESSES[COSTON2_CHAIN_ID].seoulPerpMarket,
    chainId: COSTON2_CHAIN_ID,
    regionId: 'SEOUL_RAINFALL',
    regionName: 'Seoul',
    collateralToken: CONTRACT_ADDRESSES[COSTON2_CHAIN_ID].mockUsdt,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    blockNumber: 0,
    txHash: '',
    markPrice: 20.0,
    oraclePrice: 19.8,
    fundingRate: -0.02,
    totalLongOpenInterest: '500000000000000000000',
    totalShortOpenInterest: '750000000000000000000',
  },
  // Dubai was removed with the deployment that superseded the pre-waterfall stack. The
  // current protocol lists Tokyo and Seoul, both in one peril group, because two correlated
  // rainfall markets are the configuration `PerilExposureRegistry` exists to bound. A
  // fallback entry for a market that no longer exists would render a card linking to an
  // address with no contract behind it.
]

function oiToNumber(raw?: string) {
  const n = Number(raw ?? '0') / 1e18
  return Number.isFinite(n) ? n : 0
}

/**
 * Normalise an indexer row into the SDK's shape.
 *
 * @dev The indexer serves Postgres columns verbatim, so every field arrives snake_case
 * while `PerpMarket` is camelCase. Reading `m.regionId` off a raw row therefore yields
 * `undefined`, and passing that to `decodeRegionId` threw, which took the entire page to
 * the error boundary rather than losing one label.
 *
 * It stayed hidden because the page falls back to hardcoded markets whenever the API
 * returns an empty list, and the perp table was empty: the fallback rows are already
 * camelCase, so the mapping was never exercised until real rows existed. The classic
 * market list has had `ensureMarketMapped` for exactly this reason; perps never got one.
 */
function ensurePerpMapped(m: any): PerpMarket {
  return {
    ...m,
    contractAddress: m.contractAddress ?? m.contract_address ?? '',
    chainId: m.chainId ?? m.chain_id ?? 114,
    regionId: m.regionId ?? m.region_id ?? '',
    regionName: m.regionName ?? m.region_name ?? null,
    collateralToken: m.collateralToken ?? m.collateral_token ?? '',
    status: m.status ?? 'ACTIVE',
    createdAt: m.createdAt ?? m.created_at ?? '',
    blockNumber: m.blockNumber ?? m.block_number ?? 0,
    txHash: m.txHash ?? m.tx_hash ?? '',
    totalLongOpenInterest: m.totalLongOpenInterest ?? m.total_long_open_interest ?? '0',
    totalShortOpenInterest: m.totalShortOpenInterest ?? m.total_short_open_interest ?? '0',
  }
}

export default function PerpMarketsPage() {
  const { indexerUrl } = useBreezeSDK()
  const { chainId } = useBreezeNetwork()
  const [markets, setMarkets] = useState<PerpMarket[]>(FALLBACK_PERPS)
  const [loading, setLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(true)

  async function loadPerps() {
    setLoading(true)
    try {
      const live = await getPerpMarkets(indexerUrl, chainId)
      if (live && live.length > 0) {
        const mapped = live.map(ensurePerpMapped)

        // The list endpoint returns table rows only, so mark price, funding and open
        // interest live behind a per-market stats call. Without this every card rendered
        // "$0.00", which reads as a broken market rather than an idle one. Settled, not
        // awaited in sequence, so one slow market cannot hold up the grid, and a failure
        // leaves that card's figures at zero instead of emptying the page.
        const withStats = await Promise.all(
          mapped.map(async (m) => {
            try {
              const s = await getPerpMarketStats(indexerUrl, m.contractAddress, chainId)
              if (!s) return m
              return {
                ...m,
                markPrice: Number(s.markPrice),
                oraclePrice: Number(s.oraclePrice),
                fundingRate: Number(s.currentFundingRate),
                totalLongOpenInterest: s.openInterestLong,
                totalShortOpenInterest: s.openInterestShort,
              }
            } catch {
              return m
            }
          })
        )

        setMarkets(withStats)
        setIsDemo(false)
      } else {
        setMarkets(FALLBACK_PERPS)
        setIsDemo(true)
      }
    } catch {
      setMarkets(FALLBACK_PERPS)
      setIsDemo(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPerps()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexerUrl, chainId])

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b border-[color:var(--color-hairline)]">
        <div className="max-w-2xl">
          <p className="eyebrow mb-2">Perpetuals</p>
          <h1 className="display-2 text-ink">Trade weather without an expiry date</h1>
          <p className="text-sm text-ink-muted mt-2 leading-relaxed">
            A virtual AMM quotes both sides continuously. Funding settles every 15 minutes and
            leverage goes to 3×.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isDemo && !loading && <DemoBadge label="Placeholder prices" />}
          <button
            type="button"
            onClick={loadPerps}
            className="btn btn-ghost btn-icon"
            aria-label="Refresh markets"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          </button>
        </div>
      </header>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {markets.map((m, i) => {
          const longOi = oiToNumber(m.totalLongOpenInterest)
          const shortOi = oiToNumber(m.totalShortOpenInterest)
          const totalOi = longOi + shortOi
          const longShare = totalOi > 0 ? (longOi / totalOi) * 100 : 50
          const funding = m.fundingRate ?? 0
          const name = m.regionName || decodeRegionId(m.regionId)

          return (
            <Reveal key={m.contractAddress} index={i} className="h-full">
              <Link
                href={`/perp-markets/${m.contractAddress}`}
                className="panel panel-hover p-5 h-full flex flex-col gap-5 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <RegionMark region={name} />
                    <div className="min-w-0">
                      <h2 className="display-3 text-ink truncate group-hover:text-accent transition-colors">
                        {name}
                      </h2>
                      <span className="text-xs text-ink-faint">Perpetual · 3× max</span>
                    </div>
                  </div>
                  <span className="chip chip-long shrink-0">
                    <span className="pulse-dot" aria-hidden />
                    Active
                  </span>
                </div>

                <dl className="grid grid-cols-2 gap-4">
                  <div className="min-w-0">
                    <dt className="metric-label">Mark</dt>
                    <dd className="metric-value text-accent mt-0.5">
                      {formatMoney(m.markPrice ?? 0)}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="metric-label">Oracle</dt>
                    <dd className="metric-value mt-0.5">{formatMoney(m.oraclePrice ?? 0)}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="metric-label">Funding / 15m</dt>
                    <dd
                      className={`numeric text-sm font-medium mt-1 ${
                        funding > 0 ? 'value-short' : funding < 0 ? 'value-long' : 'text-ink-muted'
                      }`}
                    >
                      {funding > 0 ? '+' : ''}
                      {funding.toFixed(2)}%
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="metric-label">Open interest</dt>
                    <dd className="numeric text-sm text-ink font-medium mt-1">
                      {formatMoney(totalOi, 0)}
                    </dd>
                  </div>
                </dl>

                {/* Long/short balance — proportion of a whole, so one split bar. */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-ink-faint">
                    <span className="numeric">{longShare.toFixed(0)}% long</span>
                    <span className="numeric">{(100 - longShare).toFixed(0)}% short</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[color:var(--color-inset)] overflow-hidden flex gap-[2px]">
                    <div
                      className="h-full rounded-full bg-long"
                      style={{ width: `${longShare}%` }}
                    />
                    <div
                      className="h-full rounded-full bg-short"
                      style={{ width: `${100 - longShare}%` }}
                    />
                  </div>
                </div>

                <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted group-hover:text-accent transition-colors mt-auto">
                  Open terminal
                  <ArrowRight
                    className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </Link>
            </Reveal>
          )
        })}
      </div>
    </div>
  )
}
