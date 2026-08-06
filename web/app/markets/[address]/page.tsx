'use client'

import React, { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowLeft, CheckCircle2, CloudRain, Thermometer, Zap } from 'lucide-react'
import {
  getMarket,
  getMarketPositions,
  getWeatherReadings,
  approveCollateral,
  mintPosition,
  settle,
  formatCollateral,
  formatExpiry,
  timeUntilExpiry,
  type Market,
  type Position,
  type WeatherReading,
} from '@breezeswap/sdk'
import { PayoffChart } from '../../../components/PayoffChart'
import { WeatherChart } from '../../../components/WeatherChart'
import { StatusBadge } from '../../../components/StatusBadge'
import { TxLink } from '../../../components/TxLink'
import { useBreezeSDK } from '../../../lib/hooks/useBreezeSDK'
import { formatMoney } from '../../../lib/chartTheme'
import { demoWeatherReadings } from '../../../lib/demoData'
import MarketABI from '../../../../sdk/src/abis/BreezeMarket.json'

/** Oracle units are 1e6-scaled; readings themselves are never in the thousands. */
function scaleOracle(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return n > 1000 ? n / 1e6 : n
}

function ensureMarketMapped(m: any): Market | null {
  if (!m) return null
  return {
    contractAddress: m.contractAddress || m.contract_address || '',
    chainId: m.chainId || m.chain_id || 114,
    regionId: m.regionId || m.region_id || '',
    regionName: m.regionName || m.region_name || null,
    weatherVariable: m.weatherVariable || m.weather_variable || 'RAINFALL',
    payoffType: m.payoffType || m.payoff_type || 'CAPPED',
    thresholdLow: scaleOracle(m.threshold_low ?? m.thresholdLow) ?? 0,
    thresholdHigh: scaleOracle(m.threshold_high ?? m.thresholdHigh),
    expiryTimestamp: m.expiryTimestamp || m.expiry_timestamp || '',
    collateralToken: m.collateralToken || m.collateral_token || '',
    status: m.status || 'OPEN',
    finalOracleValue: scaleOracle(m.final_oracle_value ?? m.finalOracleValue),
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

function ensurePositionMapped(p: any): Position {
  return {
    id: p.id || '',
    marketAddress: p.marketAddress || p.market_address || '',
    tokenId: p.tokenId || p.token_id || '',
    holderAddress: p.holderAddress || p.holder_address || p.userAddress || p.user_address || '',
    side: p.side || 'LONG',
    collateralAsset: p.collateralAsset || p.collateral_asset || '',
    collateralAmount: p.collateralAmount || p.collateral_amount || '0',
    mintedAt: p.mintedAt || p.minted_at || p.createdAt || p.created_at || '',
    blockNumber: p.blockNumber || p.block_number || 0,
    txHash: p.txHash || p.tx_hash || '',
    redeemed: p.redeemed ?? false,
    redeemedAmount: p.redeemedAmount || p.redeemed_amount || null,
    redeemedAt: p.redeemedAt || p.redeemed_at || null,
    redeemTxHash: p.redeemTxHash || p.redeem_tx_hash || null,
    market: p.market,
  }
}

export default function MarketDetailPage({ params }: { params: Promise<{ address: string }> }) {
  const marketAddress = use(params).address.toLowerCase()
  const { indexerUrl, walletClient, publicClient, isConnected } = useBreezeSDK()

  const [market, setMarket] = useState<Market | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [readings, setReadings] = useState<WeatherReading[]>([])
  const [readingsAreDemo, setReadingsAreDemo] = useState(false)
  const [loading, setLoading] = useState(true)

  const [side, setSide] = useState<'LONG' | 'SHORT'>('LONG')
  const [collateralInput, setCollateralInput] = useState('10')
  const [mintLoading, setMintLoading] = useState(false)
  const [mintTxHash, setMintTxHash] = useState<string | null>(null)
  const [mintError, setMintError] = useState<string | null>(null)

  const [settleLoading, setSettleLoading] = useState(false)
  const [settleTxHash, setSettleTxHash] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    let m: Market | null = null

    try {
      m = ensureMarketMapped(await getMarket(indexerUrl, marketAddress))
      setMarket(m)
    } catch {
      setMarket(null)
    }

    if (m) {
      try {
        const live = m.regionId ? await getWeatherReadings(indexerUrl, m.regionId) : []
        if (live && live.length > 0) {
          setReadings(live)
          setReadingsAreDemo(false)
        } else {
          setReadings(
            demoWeatherReadings(
              marketAddress,
              m.thresholdLow,
              m.thresholdHigh
            ) as unknown as WeatherReading[]
          )
          setReadingsAreDemo(true)
        }
      } catch {
        setReadings(
          demoWeatherReadings(
            marketAddress,
            m.thresholdLow,
            m.thresholdHigh
          ) as unknown as WeatherReading[]
        )
        setReadingsAreDemo(true)
      }
    }

    try {
      const pos = await getMarketPositions(indexerUrl, marketAddress)
      setPositions((pos ?? []).map(ensurePositionMapped))
    } catch {
      setPositions([])
    } finally {
      setLoading(false)
    }
  }, [indexerUrl, marketAddress])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleApproveAndMint() {
    setMintLoading(true)
    setMintError(null)
    setMintTxHash(null)

    if (!walletClient || !publicClient || !market) {
      setMintError('Connect a wallet on Flare Coston2 to mint a position.')
      setMintLoading(false)
      return
    }

    try {
      const amount = BigInt(Math.round(Number(collateralInput) * 1e6))
      const tokenAddress = market.collateralToken as `0x${string}`
      const marketHex = market.contractAddress as `0x${string}`

      // The vault, not the market, holds the collateral — read its address from
      // the market rather than approving the market itself.
      let vaultAddress = marketHex
      try {
        const v = (await publicClient.readContract({
          address: marketHex,
          abi: MarketABI,
          functionName: 'vault',
        })) as `0x${string}`
        if (v && v !== '0x0000000000000000000000000000000000000000') vaultAddress = v
      } catch {
        /* Fall back to the market address. */
      }

      const approveTxHash = await approveCollateral(
        walletClient as any,
        publicClient as any,
        tokenAddress,
        vaultAddress,
        amount
      )
      if (approveTxHash) {
        await publicClient.waitForTransactionReceipt({ hash: approveTxHash })
      }

      const hash = await mintPosition(walletClient as any, publicClient as any, {
        marketAddress: marketHex,
        side,
        collateralAmount: amount,
      })

      setMintTxHash(hash)
      loadData()
    } catch (err: any) {
      setMintError(err?.shortMessage || err?.message || 'Minting the position failed.')
    } finally {
      setMintLoading(false)
    }
  }

  async function handleSettle() {
    if (!walletClient || !publicClient || !market) return
    setSettleLoading(true)
    try {
      const hash = await settle(
        walletClient as any,
        publicClient as any,
        market.contractAddress as `0x${string}`
      )
      setSettleTxHash(hash)
      loadData()
    } catch (err: any) {
      setMintError(err?.shortMessage || err?.message || 'Settlement failed.')
    } finally {
      setSettleLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-[color:var(--color-hairline-strong)] border-t-accent animate-spin" />
        <p className="text-sm text-ink-faint">Loading market…</p>
      </div>
    )
  }

  if (!market) {
    return (
      <div className="py-24 text-center space-y-4 max-w-md mx-auto">
        <h1 className="display-2 text-ink">Market not found</h1>
        <p className="text-sm text-ink-muted break-words">
          No market at <span className="numeric text-ink-faint">{marketAddress}</span> on this chain.
        </p>
        <Link href="/markets" className="btn btn-ghost">
          Back to markets
        </Link>
      </div>
    )
  }

  const isRainfall = market.weatherVariable === 'RAINFALL'
  const unit = isRainfall ? 'mm' : '°C'
  const Icon = isRainfall ? CloudRain : Thermometer

  // Collateral amounts are 6-decimal integer strings. Summing them as BigInt
  // avoids the float overflow that turned a large pool into "1e+21 mUSDT".
  const totalCollateral = positions.reduce((acc, p) => {
    try {
      return acc + BigInt(p.collateralAmount || '0')
    } catch {
      return acc
    }
  }, 0n)

  const longCount = positions.filter((p) => p.side === 'LONG').length
  const shortCount = positions.filter((p) => p.side === 'SHORT').length
  const isExpired = new Date(market.expiryTimestamp).getTime() <= Date.now()
  const canSettle = market.status === 'OPEN' && isExpired
  const collateralNum = Number.parseFloat(collateralInput)
  const validCollateral = Number.isFinite(collateralNum) && collateralNum > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <Link
          href="/markets"
          className="inline-flex items-center gap-1.5 text-xs text-ink-faint hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
          All markets
        </Link>

        <div className="panel p-5 sm:p-6 flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="display-2 text-ink">{market.regionName || 'Global region'}</h1>
              <StatusBadge status={market.status} />
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5 text-cool" aria-hidden />
                {isRainfall ? 'Rainfall' : 'Temperature'} · {market.payoffType}
              </span>
              <span>
                Expiry{' '}
                <span className="text-ink">{formatExpiry(market.expiryTimestamp)}</span>{' '}
                <span className="text-ink-faint">({timeUntilExpiry(market.expiryTimestamp)})</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                Contract <TxLink hash={market.contractAddress} type="address" />
              </span>
            </div>
          </div>

          {canSettle && (
            <button
              type="button"
              onClick={handleSettle}
              disabled={settleLoading}
              className="btn btn-primary shrink-0"
            >
              <Zap className="w-4 h-4" aria-hidden />
              {settleLoading ? 'Settling…' : 'Settle market'}
            </button>
          )}
        </div>
      </div>

      {settleTxHash && (
        <div className="panel p-4 flex items-center justify-between gap-3 text-sm">
          <span className="value-long inline-flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" aria-hidden />
            Market settled
          </span>
          <TxLink hash={settleTxHash} />
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <div className="min-w-0">
          <PayoffChart market={market} />
        </div>
        <div className="min-w-0">
          <WeatherChart
            readings={readings}
            thresholdLow={market.thresholdLow}
            thresholdHigh={market.thresholdHigh}
            variable={market.weatherVariable}
            isDemo={readingsAreDemo}
          />
        </div>
      </div>

      {/* Stats + mint */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        <section className="lg:col-span-4 panel p-5 sm:p-6 space-y-5 min-w-0">
          <h2 className="display-3 text-ink">Market statistics</h2>

          <dl className="space-y-3">
            <div className="inset px-4 py-3 flex items-center justify-between gap-3">
              <dt className="text-xs text-ink-muted">Collateral locked</dt>
              <dd className="numeric text-sm value-long font-medium">
                {formatCollateral(totalCollateral.toString(), 6, 'mUSDT')}
              </dd>
            </div>

            <div className="inset px-4 py-3 flex items-center justify-between gap-3">
              <dt className="text-xs text-ink-muted">Positions</dt>
              <dd className="numeric text-sm">
                <span className="value-long">{longCount} long</span>
                <span className="text-ink-faint"> / </span>
                <span className="value-short">{shortCount} short</span>
              </dd>
            </div>

            <div className="inset px-4 py-3 flex items-center justify-between gap-3">
              <dt className="text-xs text-ink-muted">Strike</dt>
              <dd className="numeric text-sm text-ink font-medium">
                {market.thresholdHigh != null
                  ? `${market.thresholdLow}–${market.thresholdHigh}${unit}`
                  : `≥ ${market.thresholdLow}${unit}`}
              </dd>
            </div>

            {market.status === 'SETTLED' && (
              <div className="inset px-4 py-3 space-y-2">
                <dt className="metric-label">Settlement result</dt>
                <dd className="numeric text-sm text-ink">
                  Oracle read {market.finalOracleValue}
                  {unit}
                </dd>
                <dd className="text-xs">
                  <span className="value-long numeric">
                    {((market.longPayoutRatio || 0) * 100).toFixed(1)}%
                  </span>
                  <span className="text-ink-faint"> long · </span>
                  <span className="value-short numeric">
                    {((market.shortPayoutRatio || 0) * 100).toFixed(1)}%
                  </span>
                  <span className="text-ink-faint"> short</span>
                </dd>
              </div>
            )}
          </dl>
        </section>

        <section className="lg:col-span-8 panel p-5 sm:p-6 space-y-5 min-w-0">
          {market.status === 'OPEN' ? (
            <>
              <div>
                <h2 className="display-3 text-ink">Mint a position</h2>
                <p className="text-xs text-ink-faint mt-1">
                  Deposit collateral to mint a transferable ERC-1155 position token.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSide('LONG')}
                  aria-pressed={side === 'LONG'}
                  className={`inset p-4 text-left transition-all ${
                    side === 'LONG'
                      ? 'border-[color:rgba(52,211,153,0.45)] bg-[color:rgba(52,211,153,0.08)]'
                      : 'hover:border-[color:var(--color-hairline-strong)]'
                  }`}
                >
                  <span
                    className={`text-sm font-medium ${side === 'LONG' ? 'value-long' : 'text-ink'}`}
                  >
                    ▲ Long
                  </span>
                  <span className="block text-xs text-ink-faint mt-1">
                    Pays out when the reading lands at or above {market.thresholdLow}
                    {unit}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSide('SHORT')}
                  aria-pressed={side === 'SHORT'}
                  className={`inset p-4 text-left transition-all ${
                    side === 'SHORT'
                      ? 'border-[color:rgba(244,63,94,0.45)] bg-[color:rgba(244,63,94,0.08)]'
                      : 'hover:border-[color:var(--color-hairline-strong)]'
                  }`}
                >
                  <span
                    className={`text-sm font-medium ${side === 'SHORT' ? 'value-short' : 'text-ink'}`}
                  >
                    ▼ Short
                  </span>
                  <span className="block text-xs text-ink-faint mt-1">
                    Pays out when the reading lands below {market.thresholdLow}
                    {unit}
                  </span>
                </button>
              </div>

              <div>
                <label htmlFor="collateral" className="field-label">
                  Collateral
                </label>
                <div className="relative">
                  <input
                    id="collateral"
                    type="number"
                    min="1"
                    inputMode="decimal"
                    value={collateralInput}
                    onChange={(e) => setCollateralInput(e.target.value)}
                    className="field numeric pr-16"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-ink-faint pointer-events-none">
                    mUSDT
                  </span>
                </div>
              </div>

              <div className="inset p-4 flex items-center justify-between gap-3">
                <span className="text-xs text-ink-muted">Maximum payout if your side wins</span>
                <span className="numeric text-base value-long font-medium">
                  {formatMoney(validCollateral ? collateralNum : 0)}
                </span>
              </div>

              {isConnected ? (
                <button
                  type="button"
                  onClick={handleApproveAndMint}
                  disabled={mintLoading || !validCollateral}
                  className={`btn btn-lg w-full ${side === 'LONG' ? 'btn-long' : 'btn-short'}`}
                >
                  {mintLoading
                    ? 'Approving & minting…'
                    : `Mint ${side === 'LONG' ? 'long' : 'short'} position`}
                </button>
              ) : (
                <div className="inset p-4 text-center text-xs text-ink-muted">
                  Connect a wallet from the header to mint a position.
                </div>
              )}

              {mintTxHash && (
                <div className="inset p-4 flex items-center justify-between gap-3 text-xs">
                  <span className="value-long inline-flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" aria-hidden />
                    Position minted
                  </span>
                  <TxLink hash={mintTxHash} />
                </div>
              )}

              {mintError && (
                <div className="inset p-4 flex items-start gap-2 text-xs value-short border-[color:rgba(244,63,94,0.3)]">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-px" aria-hidden />
                  <span className="break-words">{mintError}</span>
                </div>
              )}
            </>
          ) : (
            <div className="py-10 text-center space-y-3">
              <h2 className="display-3 text-ink">This market has settled</h2>
              <p className="text-sm text-ink-muted">
                Head to your portfolio to redeem any position you hold.
              </p>
              <Link href="/portfolio" className="btn btn-ghost">
                Go to portfolio
              </Link>
            </div>
          )}
        </section>
      </div>

      {/* Holders */}
      <section className="space-y-4">
        <h2 className="display-3 text-ink">Position holders</h2>

        {positions.length === 0 ? (
          <div className="panel p-10 text-center text-sm text-ink-faint">
            No positions minted in this market yet.
          </div>
        ) : (
          <div className="panel">
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Side</th>
                    <th>Collateral</th>
                    <th>Holder</th>
                    <th>Minted</th>
                    <th>Status</th>
                    <th className="text-right">Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={p.id || p.txHash}>
                      <td className={p.side === 'LONG' ? 'value-long' : 'value-short'}>
                        <span className="font-medium">
                          {p.side === 'LONG' ? '▲' : '▼'} {p.side}
                        </span>
                      </td>
                      <td className="numeric text-ink">
                        {formatCollateral(p.collateralAmount, 6, 'mUSDT')}
                      </td>
                      <td className="numeric">
                        {p.holderAddress
                          ? `${p.holderAddress.slice(0, 6)}…${p.holderAddress.slice(-4)}`
                          : '—'}
                      </td>
                      <td>{formatExpiry(p.mintedAt)}</td>
                      <td>
                        {p.redeemed ? (
                          <span className="chip chip-long">Redeemed</span>
                        ) : (
                          <span className="chip">Active</span>
                        )}
                      </td>
                      <td className="text-right">
                        <TxLink hash={p.txHash} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
