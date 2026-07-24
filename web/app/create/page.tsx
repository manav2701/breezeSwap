'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PayoffChart } from '../../components/PayoffChart'
import { TxLink } from '../../components/TxLink'
import { PlusCircle, Layers, CheckCircle2, AlertCircle, Sparkles, UserCheck, AlertTriangle } from 'lucide-react'
import {
  createMarket,
  encodeRegionId,
  toOracleUnits,
  CONTRACT_ADDRESSES,
  COSTON2_CHAIN_ID,
  type PayoffType,
  type WeatherVariable
} from '@breezeswap/sdk'
import { useBreezeSDK } from '../../lib/hooks/useBreezeSDK'

export default function CreateMarketPage() {
  const router = useRouter()
  const { walletClient, publicClient, isConnected, isWrongNetwork, switchNetwork } = useBreezeSDK()

  const [regionName, setRegionName] = useState<string>('Tokyo')
  const [weatherVariable, setWeatherVariable] = useState<WeatherVariable>('RAINFALL')
  const [payoffType, setPayoffType] = useState<PayoffType>('CAPPED')
  const [thresholdLowDisplay, setThresholdLowDisplay] = useState<number>(50)
  const [thresholdHighDisplay, setThresholdHighDisplay] = useState<number>(100)
  const [expiryDays, setExpiryDays] = useState<number>(7)
  const [collateralToken, setCollateralToken] = useState<string>(CONTRACT_ADDRESSES[COSTON2_CHAIN_ID].mockUsdt)

  const [loading, setLoading] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [newMarketAddress, setNewMarketAddress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const liveMarketPreview = {
    regionName,
    weatherVariable,
    payoffType,
    thresholdLow: thresholdLowDisplay,
    thresholdHigh: payoffType === 'CAPPED' ? thresholdHighDisplay : null
  }

  async function handleCreateMarket(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setTxHash(null)
    setNewMarketAddress(null)

    if (isWrongNetwork) {
      setError('Your wallet is on the wrong network. Please click "Switch to Flare Coston2" above.')
      setLoading(false)
      return
    }

    if (!walletClient || !publicClient) {
      console.error('Wallet or public client unavailable', { walletClient, publicClient, isConnected })
      setError('Wallet client is not connected or ready. Please check your Web3 wallet extension.')
      setLoading(false)
      return
    }

    try {
      console.log('Building market creation parameters...')
      const regionId = encodeRegionId(regionName)
      const thresholdLow = toOracleUnits(thresholdLowDisplay)
      const thresholdHigh = payoffType === 'CAPPED' ? toOracleUnits(thresholdHighDisplay) : BigInt(0)
      const expiryTimestamp = BigInt(Math.floor(Date.now() / 1000) + expiryDays * 86400)

      console.log('Sending createMarket transaction to Coston2...', {
        regionId,
        weatherVariable,
        payoffType,
        thresholdLow: thresholdLow.toString(),
        thresholdHigh: thresholdHigh.toString(),
        expiryTimestamp: expiryTimestamp.toString(),
        collateralToken
      })

      const result = await createMarket(
        walletClient as any,
        publicClient as any,
        {
          regionId,
          weatherVariable,
          payoffType,
          thresholdLow,
          thresholdHigh,
          expiryTimestamp,
          collateralToken: collateralToken as `0x${string}`
        }
      )

      console.log('Market created successfully!', result)
      setTxHash(result.txHash)
      if (result.marketAddress) {
        setNewMarketAddress(result.marketAddress)
        setTimeout(() => {
          router.push(`/markets/${result.marketAddress}`)
        }, 2000)
      }
    } catch (err: any) {
      console.error('Error creating market:', err)
      setError(err?.shortMessage || err?.message || 'Market creation failed. Please check wallet approval.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>Permissionless Protocol Infrastructure</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Create Weather Derivative Market</h1>
        <p className="text-xs text-slate-400">Deploy a new weather contract on Coston2 with customized thresholds and payoff math.</p>
      </div>

      {isWrongNetwork && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-200">Wrong Wallet Network</p>
              <p className="text-[11px] text-amber-300/80">Your wallet is connected to a different network. Please switch to Flare Coston2 Testnet.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={switchNetwork}
            className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-colors shrink-0"
          >
            Switch to Coston2
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form Column */}
        <form onSubmit={handleCreateMarket} className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-6">
          {/* Region Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">Target Region</label>
            <select
              value={regionName}
              onChange={(e) => setRegionName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-cyan-500 transition-colors"
            >
              <option value="Tokyo">Tokyo 🇯🇵</option>
              <option value="Seoul">Seoul 🇰🇷</option>
              <option value="Singapore">Singapore 🇸🇬</option>
              <option value="Dubai">Dubai 🇦🇪</option>
              <option value="London">London 🇬🇧</option>
            </select>
          </div>

          {/* Weather Variable */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">Weather Metric</label>
            <div className="grid grid-cols-2 gap-3">
              {(['RAINFALL', 'TEMPERATURE'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setWeatherVariable(v)}
                  className={`p-3 rounded-xl border text-xs font-bold transition-all ${
                    weatherVariable === v
                      ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 shadow-md shadow-cyan-500/10'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {v === 'RAINFALL' ? 'Rainfall (mm)' : 'Temperature (°C)'}
                </button>
              ))}
            </div>
          </div>

          {/* Payoff Type */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">Payoff Curve Structure</label>
            <select
              value={payoffType}
              onChange={(e) => setPayoffType(e.target.value as PayoffType)}
              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-cyan-500 transition-colors"
            >
              <option value="CAPPED">Capped (Bounded Linear Slopes)</option>
              <option value="BINARY">Binary (All-or-Nothing Step Payout)</option>
              <option value="LINEAR">Linear (Uncapped Proportional Payout)</option>
            </select>
          </div>

          {/* Threshold Low & High */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                Low Threshold ({weatherVariable === 'RAINFALL' ? 'mm' : '°C'})
              </label>
              <input
                type="number"
                value={thresholdLowDisplay}
                onChange={(e) => setThresholdLowDisplay(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 text-white font-mono rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>

            {payoffType === 'CAPPED' && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">
                  Cap Threshold ({weatherVariable === 'RAINFALL' ? 'mm' : '°C'})
                </label>
                <input
                  type="number"
                  value={thresholdHighDisplay}
                  onChange={(e) => setThresholdHighDisplay(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 text-white font-mono rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            )}
          </div>

          {/* Expiry Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">Market Expiry Duration</label>
            <select
              value={expiryDays}
              onChange={(e) => setExpiryDays(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-cyan-500 transition-colors"
            >
              <option value={1}>1 Day</option>
              <option value={7}>7 Days</option>
              <option value={14}>14 Days</option>
              <option value={30}>30 Days</option>
            </select>
          </div>

          {/* Collateral Token */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">Vault Collateral Token</label>
            <select
              value={collateralToken}
              onChange={(e) => setCollateralToken(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-cyan-500 transition-colors"
            >
              <option value={CONTRACT_ADDRESSES[COSTON2_CHAIN_ID].mockUsdt}>Mock USDT (mUSDT)</option>
              <option value={CONTRACT_ADDRESSES[COSTON2_CHAIN_ID].fTestXrp}>FTestXRP (FAssets)</option>
            </select>
          </div>

          {/* Submit Button */}
          {isConnected ? (
            <button
              type="submit"
              disabled={loading || isWrongNetwork}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              {loading ? 'Deploying Market Contract...' : 'Create Market On-Chain'}
            </button>
          ) : (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400 space-y-2">
              <UserCheck className="w-5 h-5 text-cyan-400 mx-auto" />
              <p>Connect your wallet to execute smart contract deployment.</p>
            </div>
          )}

          {txHash && (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Market deployed! <TxLink hash={txHash} /> {newMarketAddress && `Address: ${newMarketAddress}`}
              </span>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/50 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 text-balance" />
              <span>{error}</span>
            </div>
          )}
        </form>

        {/* Live Preview Column */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                Live Payoff Preview Chart
              </h3>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-bold">
                Real-Time Render
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Visual preview of how winning and losing payouts scale for LONG vs SHORT positions under your target parameters.
            </p>

            <PayoffChart market={liveMarketPreview} />
          </div>
        </div>
      </div>
    </div>
  )
}
