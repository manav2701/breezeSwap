'use client'

import React, { useEffect, useMemo, useState, use } from 'react'
import Link from 'next/link'
import { useAccount } from 'wagmi'
import { ArrowLeft, TrendingUp } from 'lucide-react'
import {
  getPerpMarket,
  getPerpMarketPositions,
  calculatePerpQuote,
  calculateMarkPrice,
  openPerpPosition,
  toTokenUnits,
  fromTokenUnits,
  type PerpMarket,
  type PerpPosition,
  type Reserves,
} from '@breezeswap/sdk'
import { useBreezeSDK } from '../../../lib/hooks/useBreezeSDK'
import { useBreezeNetwork } from '../../../lib/hooks/useNetwork'
import { useCollateralToken } from '../../../lib/hooks/useCollateralToken'
import { TxLink } from '../../../components/TxLink'
import { PerpStatsHeader } from '../../../components/PerpStatsHeader'
import { FundingRateSparkline } from '../../../components/FundingRateSparkline'
import { MarkPriceChart } from '../../../components/MarkPriceChart'
import { DepthLadder } from '../../../components/DepthLadder'
import { TradeHistoryTable } from '../../../components/TradeHistoryTable'
import { formatMoney } from '../../../lib/chartTheme'
import { explainRevert } from '../../../lib/revertReason'

/**
 * Reference reserves for the quote preview.
 *
 * The vAMM's reserves are 18-decimal, so **everything derived from a quote is
 * also 18-decimal** — including `feeAmount` and `netCollateral`. The previous
 * build formatted those with `/1e6`, which rendered a $0.10 fee on a $100
 * margin as "-100000000000.00 USDT". Collateral is scaled up on the way in and
 * back down on the way out through the constants below, so the two never drift
 * apart again.
 */
const REFERENCE_RESERVES: Reserves = {
  collateralReserve: 1_000_000n * 10n ** 18n,
  weatherReserve: 40_000n * 10n ** 18n,
}

/**
 * The vAMM's own reserves are always 18-decimal, whatever the collateral token
 * uses. Collateral is scaled INTO this space for the quote and back out for
 * display, so the two can never drift apart.
 */
const AMM_DECIMALS = 18

const LEVERAGE_STEPS = [1, 2, 3]
const TRADING_FEE_BPS = 10

export default function PerpMarketDetailPage({
  params,
}: {
  params: Promise<{ address: string }>
}) {
  const marketAddress = use(params).address as `0x${string}`

  const { isConnected } = useAccount()
  const { walletClient, publicClient, indexerUrl } = useBreezeSDK()
  const { chainId } = useBreezeNetwork()

  const [market, setMarket] = useState<PerpMarket | null>(null)
  const [, setPositions] = useState<PerpPosition[]>([])
  const [collateralTokenAddress, setCollateralTokenAddress] = useState<string>()

  const [isLong, setIsLong] = useState(true)
  const [collateralInput, setCollateralInput] = useState('100')
  const [leverage, setLeverage] = useState(2)
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Decimals come from the token the market was actually deployed against.
  const { decimals, symbol, balance, isReady: tokenReady } =
    useCollateralToken(collateralTokenAddress)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [m, pos] = await Promise.all([
          getPerpMarket(indexerUrl, marketAddress, chainId),
          getPerpMarketPositions(indexerUrl, marketAddress, chainId),
        ])
        if (cancelled) return
        if (m) setMarket(m)
        setPositions(pos ?? [])
      } catch {
        /* The panels below each carry their own fallback. */
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [indexerUrl, marketAddress, chainId])

  // Read the collateral token from the market itself rather than the indexer,
  // so the trade form works even when the indexer has never seen this market.
  useEffect(() => {
    let cancelled = false
    if (!publicClient) return

    publicClient
      .readContract({
        address: marketAddress,
        abi: [
          {
            inputs: [],
            name: 'collateralToken',
            outputs: [{ type: 'address' }],
            stateMutability: 'view',
            type: 'function',
          },
        ],
        functionName: 'collateralToken',
      })
      .then((token) => {
        if (!cancelled) setCollateralTokenAddress(token as string)
      })
      .catch(() => {
        /* No contract at this address; the form stays disabled. */
      })

    return () => {
      cancelled = true
    }
  }, [publicClient, marketAddress])

  const markPrice = useMemo(() => calculateMarkPrice(REFERENCE_RESERVES), [])

  const collateralNum = Number.parseFloat(collateralInput)
  const validCollateral = Number.isFinite(collateralNum) && collateralNum > 0

  /** Raw units the contract will actually receive, at the token's own scale. */
  const collateralRaw = useMemo(
    () => (validCollateral && decimals !== null ? toTokenUnits(collateralNum, decimals) : 0n),
    [collateralNum, validCollateral, decimals]
  )

  const quote = useMemo(() => {
    // Quote in the AMM's 18-decimal space. Scaling the *display* amount rather
    // than the raw amount keeps the preview correct for any token decimals.
    const base = validCollateral ? collateralNum : 0
    const collateralWei = toTokenUnits(base, AMM_DECIMALS)
    return calculatePerpQuote(REFERENCE_RESERVES, collateralWei, leverage, isLong, TRADING_FEE_BPS)
  }, [collateralNum, validCollateral, leverage, isLong])

  const AMM_SCALE = 10 ** AMM_DECIMALS
  const feeAmount = Number(quote.feeAmount) / AMM_SCALE
  const netCollateral = Number(quote.netCollateral) / AMM_SCALE
  const notional = netCollateral * leverage
  const impactPct = quote.priceImpactBps / 100

  /*
    Maintenance margin is 10% of notional.

    This is the closed form of the same equation `lib/perpPnl` solves for an
    open position, with collateral / size substituted for entry / leverage:

      long:  (entry·size − collateral) / (0.9·size) = (entry/0.9)·(1 − 1/lev)
      short: (entry·size + collateral) / (1.1·size) = (entry/1.1)·(1 + 1/lev)

    Deriving it any other way makes the estimate shown before opening disagree
    with the liquidation price shown in the portfolio a moment later.
  */
  const liquidationPrice = isLong
    ? (quote.entryPrice / 0.9) * (1 - 1 / leverage)
    : (quote.entryPrice / 1.1) * (1 + 1 / leverage)

  const insufficientBalance = balance !== null && collateralRaw > balance

  async function handleOpenTrade() {
    if (!walletClient || !publicClient || !validCollateral || collateralRaw === 0n) return
    setSubmitting(true)
    setError(null)
    setTxHash(null)
    try {
      // `openPerpPosition` approves the market first when the allowance is
      // short, and waits for that receipt before simulating the open. Without
      // it the call reverted with ERC20InsufficientAllowance (0xfb8f41b2),
      // which is what every first trade from a fresh wallet used to hit.
      setStatus('Approving collateral, then opening…')
      const hash = await openPerpPosition(
        walletClient as any,
        publicClient as any,
        marketAddress,
        isLong,
        collateralRaw,
        BigInt(leverage)
      )
      setTxHash(hash)
      setStatus(null)
    } catch (err: any) {
      setStatus(null)
      setError(explainRevert(err))
    } finally {
      setSubmitting(false)
    }
  }

  const regionName = market?.regionName || 'Weather'
  const basePrice = market?.oraclePrice ?? markPrice

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <Link
          href="/perp-markets"
          className="inline-flex items-center gap-1.5 text-xs text-ink-faint hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
          All perpetual markets
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-11 h-11 rounded-xl inset flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-accent" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="display-2 text-ink truncate">{regionName} perpetual</h1>
              <TxLink hash={marketAddress} type="address" />
            </div>
          </div>

          <span className="chip chip-long shrink-0">
            <span className="pulse-dot" aria-hidden />
            Active
          </span>
        </div>
      </div>

      <PerpStatsHeader marketAddress={marketAddress} basePrice={basePrice} />

      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Charts and depth */}
        <div className="lg:col-span-8 space-y-6 min-w-0">
          <MarkPriceChart marketAddress={marketAddress} basePrice={basePrice} />
          <FundingRateSparkline marketAddress={marketAddress} />
          <DepthLadder reserves={REFERENCE_RESERVES} tradingFeeBps={TRADING_FEE_BPS} />
          <TradeHistoryTable marketAddress={marketAddress} limit={20} basePrice={basePrice} />
        </div>

        {/* Trade terminal */}
        <div className="lg:col-span-4 min-w-0">
          <div className="panel p-5 sm:p-6 space-y-5 lg:sticky lg:top-24">
            <h2 className="display-3 text-ink">Open a position</h2>

            <div className="segmented" role="group" aria-label="Position side">
              <button
                type="button"
                onClick={() => setIsLong(true)}
                data-active={isLong}
                data-tone="long"
                aria-pressed={isLong}
              >
                ▲ Long
              </button>
              <button
                type="button"
                onClick={() => setIsLong(false)}
                data-active={!isLong}
                data-tone="short"
                aria-pressed={!isLong}
              >
                ▼ Short
              </button>
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <label htmlFor="margin" className="field-label mb-0">
                  Margin ({symbol})
                </label>
                {balance !== null && decimals !== null && (
                  <span className="numeric text-[11px] text-ink-faint">
                    Balance {fromTokenUnits(balance, decimals).toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  id="margin"
                  type="number"
                  min="1"
                  step="1"
                  inputMode="decimal"
                  value={collateralInput}
                  onChange={(e) => setCollateralInput(e.target.value)}
                  className="field numeric pr-16"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-ink-faint pointer-events-none">
                  {symbol}
                </span>
              </div>
              <div className="flex gap-1.5 mt-2">
                {[50, 100, 500, 1000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCollateralInput(String(preset))}
                    className="btn btn-ghost btn-sm flex-1 numeric"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="leverage" className="field-label mb-0">
                  Leverage
                </label>
                <span className="numeric text-sm text-accent font-medium">{leverage}×</span>
              </div>
              <input
                id="leverage"
                type="range"
                min={1}
                max={3}
                step={1}
                value={leverage}
                onChange={(e) => setLeverage(Number(e.target.value))}
              />
              <div className="flex justify-between mt-1.5">
                {LEVERAGE_STEPS.map((s) => (
                  <span key={s} className="numeric text-[10px] text-ink-faint">
                    {s}×
                  </span>
                ))}
              </div>
            </div>

            {/* Quote preview */}
            <dl className="inset p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-muted">Trading fee ({(TRADING_FEE_BPS / 100).toFixed(2)}%)</dt>
                <dd className="numeric value-short">−{formatMoney(feeAmount)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-muted">Net margin</dt>
                <dd className="numeric text-ink">{formatMoney(netCollateral)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-[color:var(--color-hairline)]">
                <dt className="text-ink-muted">Position size</dt>
                <dd className="numeric text-ink font-medium">{formatMoney(notional)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-muted">Est. entry price</dt>
                <dd className="numeric text-accent font-medium">{formatMoney(quote.entryPrice)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-muted">Price impact</dt>
                <dd
                  className={`numeric ${
                    impactPct > 2 ? 'value-short' : impactPct > 0.5 ? 'text-warn' : 'value-long'
                  }`}
                >
                  {impactPct.toFixed(2)}%
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-[color:var(--color-hairline)]">
                <dt className="text-ink-muted">Est. liquidation</dt>
                <dd className="numeric text-warn">{formatMoney(liquidationPrice)}</dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={handleOpenTrade}
              disabled={
                submitting ||
                !isConnected ||
                !validCollateral ||
                !tokenReady ||
                insufficientBalance
              }
              className={`btn btn-lg w-full ${isLong ? 'btn-long' : 'btn-short'}`}
            >
              {submitting
                ? 'Submitting…'
                : !isConnected
                  ? 'Connect a wallet to trade'
                  : !tokenReady
                    ? 'Reading collateral token…'
                    : insufficientBalance
                      ? `Not enough ${symbol}`
                      : `Open ${isLong ? 'long' : 'short'} · ${leverage}×`}
            </button>

            {/* Opening takes two signatures on a fresh wallet — approve, then
                open. Saying so up front stops the second popup looking like a
                failure of the first. */}
            {status && <p className="text-xs text-ink-muted">{status}</p>}

            {!validCollateral && (
              <p className="text-xs text-warn">Enter a margin amount greater than zero.</p>
            )}

            {insufficientBalance && balance !== null && decimals !== null && (
              <p className="text-xs text-warn">
                You hold{' '}
                <span className="numeric">
                  {fromTokenUnits(balance, decimals).toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}{' '}
                  {symbol}
                </span>
                .
              </p>
            )}

            {txHash && (
              <div className="inset p-3.5 flex items-center justify-between gap-3 text-xs">
                <span className="value-long">Trade submitted</span>
                <TxLink hash={txHash} />
              </div>
            )}

            {error && (
              <div className="inset p-3.5 text-xs value-short border-[color:rgba(244,63,94,0.3)]">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
