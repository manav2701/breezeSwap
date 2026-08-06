'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, RefreshCw } from 'lucide-react'
import {
  getPerpMarkets,
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
  {
    contractAddress: CONTRACT_ADDRESSES[COSTON2_CHAIN_ID].dubaiPerpMarket,
    chainId: COSTON2_CHAIN_ID,
    regionId: 'DUBAI_TEMPERATURE',
    regionName: 'Dubai',
    collateralToken: CONTRACT_ADDRESSES[COSTON2_CHAIN_ID].mockUsdt,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    blockNumber: 0,
    txHash: '',
    markPrice: 40.0,
    oraclePrice: 40.2,
    fundingRate: 0.01,
    totalLongOpenInterest: '1200000000000000000000',
    totalShortOpenInterest: '1100000000000000000000',
  },
]

function oiToNumber(raw?: string) {
  const n = Number(raw ?? '0') / 1e18
  return Number.isFinite(n) ? n : 0
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
        setMarkets(live)
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
