'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, AlertTriangle, CheckCircle2, PlusCircle } from 'lucide-react'
import {
  createMarket,
  encodeRegionId,
  toOracleUnits,
  CONTRACT_ADDRESSES,
  COSTON2_CHAIN_ID,
  type PayoffType,
  type WeatherVariable,
} from '@breezeswap/sdk'
import { PayoffChart } from '../../components/PayoffChart'
import { TxLink } from '../../components/TxLink'
import { useBreezeSDK } from '../../lib/hooks/useBreezeSDK'
import { explainRevert } from '../../lib/revertReason'

const REGIONS = ['Tokyo', 'Seoul', 'Singapore', 'Dubai', 'London'] as const

const PAYOFF_TYPES: { value: PayoffType; label: string; help: string }[] = [
  {
    value: 'CAPPED',
    label: 'Capped',
    help: 'Payout ramps linearly between the strike and the cap, then flattens.',
  },
  {
    value: 'BINARY',
    label: 'Binary',
    help: 'All or nothing — the winning side takes the whole pot at the strike.',
  },
  {
    value: 'LINEAR',
    label: 'Linear',
    help: 'Payout scales proportionally above the strike, with no ceiling.',
  },
]

const EXPIRY_OPTIONS = [1, 7, 14, 30]

export default function CreateMarketPage() {
  const router = useRouter()
  const { walletClient, publicClient, isConnected, isWrongNetwork, switchNetwork } = useBreezeSDK()

  const [regionName, setRegionName] = useState<string>('Tokyo')
  const [weatherVariable, setWeatherVariable] = useState<WeatherVariable>('RAINFALL')
  const [payoffType, setPayoffType] = useState<PayoffType>('CAPPED')
  const [thresholdLow, setThresholdLow] = useState<number>(50)
  const [thresholdHigh, setThresholdHigh] = useState<number>(100)
  const [expiryDays, setExpiryDays] = useState<number>(7)
  const [collateralToken, setCollateralToken] = useState<string>(
    CONTRACT_ADDRESSES[COSTON2_CHAIN_ID].mockUsdt
  )

  const [loading, setLoading] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const unit = weatherVariable === 'RAINFALL' ? 'mm' : '°C'

  // A capped market whose cap sits at or below the strike has no ramp and would
  // deploy a contract that can only ever pay 0% or 100%.
  const capInvalid = payoffType === 'CAPPED' && thresholdHigh <= thresholdLow
  const thresholdInvalid = !Number.isFinite(thresholdLow) || thresholdLow < 0
  const canSubmit = isConnected && !isWrongNetwork && !capInvalid && !thresholdInvalid && !loading

  const preview = {
    regionName,
    weatherVariable,
    payoffType,
    thresholdLow,
    thresholdHigh: payoffType === 'CAPPED' ? thresholdHigh : null,
  }

  async function handleCreateMarket(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setTxHash(null)

    if (isWrongNetwork) {
      setError('Your wallet is on the wrong network. Switch to Flare Coston2 first.')
      setLoading(false)
      return
    }

    if (!walletClient || !publicClient) {
      setError('Wallet is not ready. Check your wallet extension and try again.')
      setLoading(false)
      return
    }

    try {
      const result = await createMarket(walletClient as any, publicClient as any, {
        regionId: encodeRegionId(regionName, weatherVariable),
        weatherVariable,
        payoffType,
        thresholdLow: toOracleUnits(thresholdLow),
        thresholdHigh: payoffType === 'CAPPED' ? toOracleUnits(thresholdHigh) : BigInt(0),
        expiryTimestamp: BigInt(Math.floor(Date.now() / 1000) + expiryDays * 86400),
        collateralToken: collateralToken as `0x${string}`,
      })

      setTxHash(result.txHash)
      if (result.marketAddress) {
        setTimeout(() => router.push(`/markets/${result.marketAddress}`), 1800)
      }
    } catch (err: any) {
      setError(explainRevert(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="max-w-2xl">
        <p className="eyebrow mb-2">Create</p>
        <h1 className="display-2 text-ink">Deploy a weather market</h1>
        <p className="text-sm text-ink-muted mt-2 leading-relaxed">
          Pick a region, a reading and a payout shape. The contract deploys to Coston2 and settles
          itself when the oracle reports.
        </p>
      </header>

      {isWrongNetwork && (
        <div className="panel p-4 flex flex-wrap items-center justify-between gap-4 border-[color:rgba(251,191,36,0.3)]">
          <div className="flex items-center gap-3 min-w-0">
            <AlertTriangle className="w-5 h-5 text-warn shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm text-ink font-medium">Wrong network</p>
              <p className="text-xs text-ink-muted">
                Switch your wallet to Flare Coston2 to deploy.
              </p>
            </div>
          </div>
          <button type="button" onClick={switchNetwork} className="btn btn-primary btn-sm">
            Switch network
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <form onSubmit={handleCreateMarket} className="panel p-5 sm:p-6 space-y-5 min-w-0">
          <div>
            <label htmlFor="region" className="field-label">
              Region
            </label>
            <select
              id="region"
              value={regionName}
              onChange={(e) => setRegionName(e.target.value)}
              className="field"
            >
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="field-label">Weather metric</span>
            <div className="segmented" role="group" aria-label="Weather metric">
              {(['RAINFALL', 'TEMPERATURE'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setWeatherVariable(v)}
                  data-active={weatherVariable === v}
                  data-tone="accent"
                  aria-pressed={weatherVariable === v}
                >
                  {v === 'RAINFALL' ? 'Rainfall (mm)' : 'Temperature (°C)'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="payoff" className="field-label">
              Payout shape
            </label>
            <select
              id="payoff"
              value={payoffType}
              onChange={(e) => setPayoffType(e.target.value as PayoffType)}
              className="field"
            >
              {PAYOFF_TYPES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-ink-faint mt-1.5">
              {PAYOFF_TYPES.find((p) => p.value === payoffType)?.help}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="strike" className="field-label">
                Strike ({unit})
              </label>
              <input
                id="strike"
                type="number"
                min={0}
                value={thresholdLow}
                onChange={(e) => setThresholdLow(Number(e.target.value))}
                className="field numeric"
              />
            </div>

            {payoffType === 'CAPPED' && (
              <div>
                <label htmlFor="cap" className="field-label">
                  Cap ({unit})
                </label>
                <input
                  id="cap"
                  type="number"
                  min={0}
                  value={thresholdHigh}
                  onChange={(e) => setThresholdHigh(Number(e.target.value))}
                  aria-invalid={capInvalid}
                  className={`field numeric ${capInvalid ? 'border-[color:rgba(244,63,94,0.5)]' : ''}`}
                />
              </div>
            )}
          </div>

          {capInvalid && (
            <p className="text-xs value-short">
              The cap must sit above the strike, otherwise there is no ramp to price.
            </p>
          )}

          <div>
            <label htmlFor="expiry" className="field-label">
              Expiry
            </label>
            <select
              id="expiry"
              value={expiryDays}
              onChange={(e) => setExpiryDays(Number(e.target.value))}
              className="field"
            >
              {EXPIRY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} {d === 1 ? 'day' : 'days'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="collateral" className="field-label">
              Collateral token
            </label>
            <select
              id="collateral"
              value={collateralToken}
              onChange={(e) => setCollateralToken(e.target.value)}
              className="field"
            >
              {/* FTestXRP was listed here but the registry address has no code
                  on Coston2, so choosing it deployed a market against a token
                  that cannot be transferred — the market would be created and
                  then be permanently unmintable. Left out until an FAsset is
                  actually deployed. */}
              <option value={CONTRACT_ADDRESSES[COSTON2_CHAIN_ID].mockUsdt}>Mock USDT (mUSDT)</option>
            </select>
          </div>

          {isConnected ? (
            <button type="submit" disabled={!canSubmit} className="btn btn-primary btn-lg w-full">
              <PlusCircle className="w-4 h-4" aria-hidden />
              {loading ? 'Deploying…' : 'Deploy market'}
            </button>
          ) : (
            <div className="inset p-4 text-center text-xs text-ink-muted">
              Connect a wallet from the header to deploy a contract.
            </div>
          )}

          {txHash && (
            <div className="inset p-4 flex items-center justify-between gap-3 text-xs">
              <span className="value-long inline-flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" aria-hidden />
                Market deployed
              </span>
              <TxLink hash={txHash} />
            </div>
          )}

          {error && (
            <div className="inset p-4 flex items-start gap-2 text-xs value-short border-[color:rgba(244,63,94,0.3)]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-px" aria-hidden />
              <span className="break-words">{error}</span>
            </div>
          )}
        </form>

        {/* Live preview. Redraws on every parameter change so the deployer can
            see the contract they are about to sign for. */}
        <div className="min-w-0 lg:sticky lg:top-24 space-y-4">
          <PayoffChart market={preview} height={300} />

          <div className="panel p-5 space-y-3">
            <h3 className="eyebrow">Summary</h3>
            <p className="text-sm text-ink-muted leading-relaxed">
              A <span className="text-ink">{payoffType.toLowerCase()}</span> market on{' '}
              <span className="text-ink">{regionName}</span>{' '}
              {weatherVariable === 'RAINFALL' ? 'rainfall' : 'temperature'}, expiring in{' '}
              <span className="numeric text-ink">{expiryDays}</span>{' '}
              {expiryDays === 1 ? 'day' : 'days'}. Longs win above{' '}
              <span className="numeric text-ink">
                {thresholdLow}
                {unit}
              </span>
              {payoffType === 'CAPPED' && !capInvalid && (
                <>
                  , reaching a full payout at{' '}
                  <span className="numeric text-ink">
                    {thresholdHigh}
                    {unit}
                  </span>
                </>
              )}
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
