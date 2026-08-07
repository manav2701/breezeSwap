'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  CloudRain,
  Gauge,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import {
  getMarkets,
  getPerpMarkets,
  getGlobalTradeHistory,
  calculateMarkPrice,
  calculatePerpQuote,
  type Market,
  type PerpMarket,
  type TradeHistoryEntry,
  type Reserves,
} from '@breezeswap/sdk'
import { useBreezeSDK } from '../lib/hooks/useBreezeSDK'
import { useBreezeNetwork } from '../lib/hooks/useNetwork'
import { MarketCard } from '../components/MarketCard'
import { TxLink } from '../components/TxLink'
import { DemoBadge } from '../components/DemoBadge'
import { InlineError, LoadError } from '../components/LoadError'
import { errorMessage } from '../lib/errorMessage'
import { Reveal } from '../components/motion/Reveal'
import { AnimatedNumber } from '../components/motion/AnimatedNumber'
import { OracleGlobe } from '../components/hero/OracleGlobe'
import { formatMoney } from '../lib/chartTheme'
import { demoTrades } from '../lib/demoData'

/**
 * Reference pool used for the landing page's slippage preview.
 *
 * 1,000,000 collateral against 40,000 exposure puts the mark at $25.00 —
 * matching the Tokyo rainfall perp's initial reserves. The rows below are
 * *computed* from this through the same `calculatePerpQuote` the trade
 * terminal uses; they used to be hardcoded strings, which meant the marketing
 * numbers drifted away from what the product actually quotes.
 */
const PREVIEW_RESERVES: Reserves = {
  collateralReserve: 1_000_000n * 10n ** 18n,
  weatherReserve: 40_000n * 10n ** 18n,
}

const PREVIEW_SIZES = [1_000, 5_000, 10_000, 25_000]

const STEPS = [
  {
    icon: Gauge,
    title: 'Pick a reading',
    body: 'Choose a region and a threshold — 50mm of rain in Tokyo this week, 40°C in Dubai. That reading is the whole contract.',
  },
  {
    icon: Wallet,
    title: 'Take a side',
    body: 'Post collateral from your own wallet on the long or short side. No account, no underwriter, no approval queue.',
  },
  {
    icon: ShieldCheck,
    title: 'Get settled',
    body: 'At expiry the oracle reading lands on-chain and the contract pays out by formula. Anyone can trigger it; nobody can block it.',
  },
]

export default function Home() {
  const { indexerUrl } = useBreezeSDK()
  const { chainId } = useBreezeNetwork()

  const [classicMarkets, setClassicMarkets] = useState<Market[]>([])
  const [perpMarkets, setPerpMarkets] = useState<PerpMarket[]>([])
  const [trades, setTrades] = useState<TradeHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [tradesAreDemo, setTradesAreDemo] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        // `getGlobalTradeHistory(url, chainId, limit)` — the arguments were
        // previously passed as (url, 10, chainId), which queried chain 10 with
        // a limit of 114 and so never returned this network's trades.
        const [cMarkets, pMarkets, history] = await Promise.all([
          getMarkets(indexerUrl, chainId),
          getPerpMarkets(indexerUrl, chainId),
          getGlobalTradeHistory(indexerUrl, chainId, 8),
        ])
        if (cancelled) return

        setClassicMarkets(cMarkets ?? [])
        setPerpMarkets(pMarkets ?? [])
        setLoadError(null)

        if (history && history.length > 0) {
          setTrades(history)
          setTradesAreDemo(false)
        } else {
          setTrades(demoTrades('protocol-feed', 6) as unknown as TradeHistoryEntry[])
          setTradesAreDemo(true)
        }
      } catch (err) {
        // The market lists and the open-interest tile are left as they were, but
        // the failure has to be named: a landing page that reports "0 open
        // markets" and a sample trade feed on a 15-second timer looked like a
        // protocol with no activity rather than an unreachable indexer.
        console.error('Failed to load landing page data', err)
        if (cancelled) return
        setTrades(demoTrades('protocol-feed', 6) as unknown as TradeHistoryEntry[])
        setTradesAreDemo(true)
        setLoadError(errorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadData()
    const timer = window.setInterval(loadData, 15_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [indexerUrl, chainId])

  /** Open interest is stored as an 18-decimal string per side. */
  const totalOpenInterest = useMemo(
    () =>
      perpMarkets.reduce((acc, m) => {
        const long = Number(m.totalLongOpenInterest || '0') / 1e18
        const short = Number(m.totalShortOpenInterest || '0') / 1e18
        return acc + (Number.isFinite(long) ? long : 0) + (Number.isFinite(short) ? short : 0)
      }, 0),
    [perpMarkets]
  )

  const markPrice = useMemo(() => calculateMarkPrice(PREVIEW_RESERVES), [])

  const slippagePreview = useMemo(
    () =>
      PREVIEW_SIZES.map((size) => {
        const quote = calculatePerpQuote(PREVIEW_RESERVES, BigInt(size) * 10n ** 18n, 1, true, 10)
        const impact = markPrice > 0 ? ((quote.entryPrice - markPrice) / markPrice) * 100 : 0
        return { size, entry: quote.entryPrice, impact }
      }),
    [markPrice]
  )

  const openMarkets = classicMarkets.filter((m) => m.status === 'OPEN').length

  return (
    <div className="space-y-16 sm:space-y-20 pb-8">
      {/* ============================================================== */}
      {/* Hero                                                           */}
      {/* ============================================================== */}
      <section className="hero-band px-6 py-12 sm:px-10 sm:py-16 lg:px-14 lg:py-20">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] gap-12 items-center">
          <div className="min-w-0 space-y-7">
            <span className="chip chip-accent">
              <CloudRain className="w-3.5 h-3.5" aria-hidden />
              Weather derivatives on Flare
            </span>

            <h1 className="display-1 text-ink text-balance">
              Hedge the weather,
              <br />
              <span className="text-accent">settle by formula.</span>
            </h1>

            <p className="lede max-w-xl">
              Take a position on rainfall or temperature and get paid automatically from a verified
              oracle reading. No claim, no adjuster, no counterparty to chase.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link href="/perp-markets" className="btn btn-primary btn-lg">
                Start trading
                <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
              <Link href="/docs" className="btn btn-ghost btn-lg">
                How it works
              </Link>
            </div>

            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-5 pt-4 border-t border-[color:var(--color-hairline)] max-w-xl">
              <div className="min-w-0">
                <dt className="metric-label">Perp open interest</dt>
                <dd className="metric-value text-accent mt-1">
                  <AnimatedNumber value={totalOpenInterest} prefix="$" decimals={0} />
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="metric-label">Open markets</dt>
                <dd className="metric-value mt-1">
                  <AnimatedNumber value={openMarkets} decimals={0} />
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="metric-label">Max leverage</dt>
                <dd className="metric-value mt-1 numeric">3×</dd>
              </div>
            </dl>
          </div>

          <div className="hidden lg:block relative aspect-square">
            <OracleGlobe className="w-full h-full" />
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* How it works                                                   */}
      {/* ============================================================== */}
      <section>
        <header className="max-w-2xl mb-8">
          <p className="eyebrow mb-2">How it works</p>
          <h2 className="display-2 text-ink">Three steps, no paperwork</h2>
        </header>

        <div className="grid gap-5 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <Reveal key={step.title} index={i} className="h-full">
              <article className="panel p-6 h-full flex flex-col gap-4">
                <span className="w-10 h-10 rounded-xl inset flex items-center justify-center shrink-0">
                  <step.icon className="w-[18px] h-[18px] text-accent" aria-hidden />
                </span>
                <div>
                  <h3 className="display-3 text-ink mb-2">
                    <span className="numeric text-ink-faint mr-2">{String(i + 1).padStart(2, '0')}</span>
                    {step.title}
                  </h3>
                  <p className="text-sm text-ink-muted leading-relaxed">{step.body}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============================================================== */}
      {/* Liquidity preview + live activity                              */}
      {/* ============================================================== */}
      <section className="grid gap-6 lg:grid-cols-12">
        {/* Slippage preview */}
        <div className="lg:col-span-5 panel flex flex-col">
          <header className="p-5 sm:p-6 pb-4 border-b border-[color:var(--color-hairline)] flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="display-3 text-ink">What a trade costs</h3>
              <p className="text-xs text-ink-faint mt-1">
                Long fill against the Tokyo rainfall pool, fee included.
              </p>
            </div>
            <span className="chip chip-accent shrink-0">
              Mark <span className="numeric">{formatMoney(markPrice)}</span>
            </span>
          </header>

          <div className="table-scroll flex-1">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order size</th>
                  <th>Est. fill</th>
                  <th className="text-right">Impact</th>
                </tr>
              </thead>
              <tbody>
                {slippagePreview.map((row) => (
                  <tr key={row.size}>
                    <td className="numeric text-ink font-medium">{formatMoney(row.size, 0)}</td>
                    <td className="numeric">{formatMoney(row.entry)}</td>
                    <td
                      className={`numeric text-right font-medium ${
                        row.impact > 2 ? 'value-short' : row.impact > 0.5 ? 'text-warn' : 'value-long'
                      }`}
                    >
                      {row.impact.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-5 sm:p-6 pt-4 border-t border-[color:var(--color-hairline)]">
            <Link href="/perp-markets" className="btn btn-primary w-full">
              Open the trade terminal
              <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
          </div>
        </div>

        {/* Activity feed */}
        <div className="lg:col-span-7 panel flex flex-col">
          <header className="p-5 sm:p-6 pb-4 border-b border-[color:var(--color-hairline)] flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="display-3 text-ink">Recent activity</h3>
              <p className="text-xs text-ink-faint mt-1">
                Positions opened, closed and liquidated across the protocol.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {loadError && <InlineError message="Live feed unavailable" />}
              {tradesAreDemo ? (
                <DemoBadge />
              ) : (
                <span className="chip chip-long">
                  <span className="pulse-dot" aria-hidden />
                  Live
                </span>
              )}
            </div>
          </header>

          <div className="table-scroll flex-1">
            {loading && trades.length === 0 ? (
              <div className="p-6 space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="skeleton h-9 rounded-lg" />
                ))}
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Trader</th>
                    <th>Action</th>
                    <th>Side</th>
                    <th>Size</th>
                    <th>Price</th>
                    <th className="text-right">Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.slice(0, 6).map((t, idx) => (
                    <tr key={t.id ?? idx}>
                      <td className="numeric text-ink-muted">
                        {t.trader ? `${t.trader.slice(0, 6)}…${t.trader.slice(-4)}` : '0x…'}
                      </td>
                      <td>
                        <span
                          className={`chip ${
                            t.type === 'LIQUIDATION'
                              ? 'chip-short'
                              : t.type === 'OPEN'
                                ? 'chip-info'
                                : ''
                          }`}
                        >
                          {t.type === 'LIQUIDATION' ? 'Liquidated' : t.type === 'OPEN' ? 'Open' : 'Close'}
                        </span>
                      </td>
                      {/* The word carries the side, not the colour. */}
                      <td className={t.side === 'LONG' ? 'value-long' : 'value-short'}>
                        <span className="inline-flex items-center gap-1 font-medium">
                          {t.side === 'LONG' ? '▲' : '▼'} {t.side}
                        </span>
                      </td>
                      <td className="numeric text-ink">{formatMoney(Number(t.size), 0)}</td>
                      <td className="numeric">{formatMoney(Number(t.price))}</td>
                      <td className="text-right">
                        <TxLink hash={t.txHash} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="p-5 sm:p-6 pt-4 border-t border-[color:var(--color-hairline)] flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-ink-faint">
              Total open interest{' '}
              <span className="numeric text-ink font-medium">{formatMoney(totalOpenInterest, 0)}</span>
            </span>
            <Link
              href="/perp-markets"
              className="inline-flex items-center gap-1.5 font-medium text-accent hover:underline"
            >
              All perpetual markets
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* Feature pair                                                   */}
      {/* ============================================================== */}
      <section className="grid gap-6 md:grid-cols-2">
        <Reveal>
          <article className="panel p-8 h-full flex flex-col justify-between gap-6 relative">
            {/* One accent-washed panel on the page, not five. */}
            <div
              className="absolute inset-0 opacity-60 pointer-events-none"
              style={{
                background:
                  'radial-gradient(ellipse 70% 90% at 15% 0%, rgba(253,224,71,0.13), transparent 65%)',
              }}
              aria-hidden
            />
            <div className="relative">
              <span className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center mb-5">
                <ShieldCheck className="w-[18px] h-[18px] text-[#0a0a0a]" aria-hidden />
              </span>
              <h3 className="display-2 text-ink mb-3">Settlement nobody can veto</h3>
              <p className="text-sm text-ink-muted leading-relaxed max-w-md">
                Payouts are computed on-chain from the oracle reading. There is no margin keeper to
                trust, no adjuster to argue with, and no address that can stop your redemption.
              </p>
            </div>
            <Link
              href="/docs"
              className="relative inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline w-fit"
            >
              Read the contract docs
              <ArrowUpRight className="w-4 h-4" aria-hidden />
            </Link>
          </article>
        </Reveal>

        <Reveal index={1}>
          <article className="panel p-8 h-full flex flex-col justify-between gap-6">
            <div>
              <span className="w-10 h-10 rounded-xl inset flex items-center justify-center mb-5">
                <Activity className="w-[18px] h-[18px] text-cool" aria-hidden />
              </span>
              <h3 className="display-2 text-ink mb-3">Liquidity that is always there</h3>
              <p className="text-sm text-ink-muted leading-relaxed max-w-md">
                A constant-product virtual AMM quotes both sides continuously, so you can open or
                close a weather position at 3am in a month nobody is writing insurance for.
              </p>
            </div>
            <Link
              href="/perp-markets"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-cool hover:underline w-fit"
            >
              Explore perpetuals
              <ArrowUpRight className="w-4 h-4" aria-hidden />
            </Link>
          </article>
        </Reveal>
      </section>

      {/* ============================================================== */}
      {/* Classic markets                                                */}
      {/* ============================================================== */}
      <section>
        <header className="flex flex-wrap items-end justify-between gap-4 mb-6 pb-4 border-b border-[color:var(--color-hairline)]">
          <div>
            <p className="eyebrow mb-2">Classic markets</p>
            <h2 className="display-2 text-ink">Fixed-expiry weather contracts</h2>
          </div>
          <Link href="/markets" className="btn btn-ghost">
            Browse all
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </header>

        {loading ? (
          <div className="grid gap-5 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="panel skeleton h-56" />
            ))}
          </div>
        ) : loadError && classicMarkets.length === 0 ? (
          <LoadError message={loadError} what="markets" />
        ) : classicMarkets.length === 0 ? (
          <div className="panel p-12 text-center space-y-3">
            <p className="text-sm text-ink-muted">No classic markets deployed on this chain yet.</p>
            <Link href="/create" className="btn btn-ghost btn-sm">
              Create the first one
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {classicMarkets.slice(0, 3).map((m, i) => (
              <Reveal key={m.contractAddress} index={i} className="h-full">
                <MarketCard market={m} />
              </Reveal>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
