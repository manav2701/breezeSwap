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
      setError('Wallet client is not connected or ready. Please check your Web3 wallet extension.')
      setLoading(false)
      return
    }

    try {
      const regionId = encodeRegionId(regionName)
      const thresholdLow = toOracleUnits(thresholdLowDisplay)
      const thresholdHigh = payoffType === 'CAPPED' ? toOracleUnits(thresholdHighDisplay) : BigInt(0)
      const expiryTimestamp = BigInt(Math.floor(Date.now() / 1000) + expiryDays * 86400)

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

      setTxHash(result.txHash)
      if (result.marketAddress) {
        setNewMarketAddress(result.marketAddress)
        setTimeout(() => {
          router.push(`/markets/${result.marketAddress}`)
        }, 2000)
      }
    } catch (err: any) {
      setError(err?.shortMessage || err?.message || 'Market creation failed. Please check wallet approval.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-4">
      <div>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/10 text-[#fde047] text-xs font-mono font-bold uppercase mb-3">
          <Sparkles className="w-4 h-4 text-[#fde047]" />
          <span>Permissionless Protocol Deployment</span>
        </div>
        <h1 className="text-4xl font-black uppercase tracking-tight text-white">Create Weather Derivative Market</h1>
        <p className="text-xs text-slate-400 font-mono">Deploy a customized weather option contract on-chain with tailored settlement curves.</p>
      </div>

      {isWrongNetwork && (
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center justify-between gap-4 font-mono">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-bold uppercase">Wrong Wallet Network</p>
              <p className="text-[11px] text-amber-300/80 font-sans">Your wallet is connected to a different network. Please switch to Flare Coston2 Testnet.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={switchNetwork}
            className="btn-cyber-yellow py-2 px-5 text-xs font-extrabold shrink-0"
          >
            Switch Network
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form Column */}
        <form onSubmit={handleCreateMarket} className="glass-panel p-6 sm:p-8 space-y-6">
          {/* Region Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">Target Region</label>
            <select
              value={regionName}
              onChange={(e) => setRegionName(e.target.value)}
              className="w-full bg-black/80 border border-white/10 text-white rounded-full px-5 py-3 text-xs font-mono focus:outline-none focus:border-[#fde047] transition-colors"
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
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">Weather Metric</label>
            <div className="grid grid-cols-2 gap-3">
              {(['RAINFALL', 'TEMPERATURE'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setWeatherVariable(v)}
                  className={`p-3 rounded-full border text-xs font-extrabold uppercase transition-all ${
                    weatherVariable === v
                      ? 'bg-[#fde047] border-[#fde047] text-black shadow-md'
                      : 'bg-black/80 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  {v === 'RAINFALL' ? 'Rainfall (mm)' : 'Temp (°C)'}
                </button>
              ))}
            </div>
          </div>

          {/* Payoff Type */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">Payoff Curve Structure</label>
            <select
              value={payoffType}
              onChange={(e) => setPayoffType(e.target.value as PayoffType)}
              className="w-full bg-black/80 border border-white/10 text-white rounded-full px-5 py-3 text-xs font-mono focus:outline-none focus:border-[#fde047] transition-colors"
            >
              <option value="CAPPED">Capped (Bounded Linear Slopes)</option>
              <option value="BINARY">Binary (All-or-Nothing Step Payout)</option>
              <option value="LINEAR">Linear (Uncapped Proportional Payout)</option>
            </select>
          </div>

          {/* Threshold Low & High */}
          <div className="grid grid-cols-2 gap-4 font-mono">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-300 font-sans">
                Low Threshold ({weatherVariable === 'RAINFALL' ? 'mm' : '°C'})
              </label>
              <input
                type="number"
                value={thresholdLowDisplay}
                onChange={(e) => setThresholdLowDisplay(Number(e.target.value))}
                className="w-full bg-black/80 border border-white/10 text-white rounded-full px-4 py-3 text-xs font-bold focus:outline-none focus:border-[#fde047]"
              />
            </div>

            {payoffType === 'CAPPED' && (
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-300 font-sans">
                  Cap Threshold ({weatherVariable === 'RAINFALL' ? 'mm' : '°C'})
                </label>
                <input
                  type="number"
                  value={thresholdHighDisplay}
                  onChange={(e) => setThresholdHighDisplay(Number(e.target.value))}
                  className="w-full bg-black/80 border border-white/10 text-white rounded-full px-4 py-3 text-xs font-bold focus:outline-none focus:border-[#fde047]"
                />
              </div>
            )}
          </div>

          {/* Expiry Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">Expiry Duration</label>
            <select
              value={expiryDays}
              onChange={(e) => setExpiryDays(Number(e.target.value))}
              className="w-full bg-black/80 border border-white/10 text-white rounded-full px-5 py-3 text-xs font-mono focus:outline-none focus:border-[#fde047]"
            >
              <option value={1}>1 Day</option>
              <option value={7}>7 Days</option>
              <option value={14}>14 Days</option>
              <option value={30}>30 Days</option>
            </select>
          </div>

          {/* Collateral Token */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">Vault Collateral Token</label>
            <select
              value={collateralToken}
              onChange={(e) => setCollateralToken(e.target.value)}
              className="w-full bg-black/80 border border-white/10 text-white rounded-full px-5 py-3 text-xs font-mono focus:outline-none focus:border-[#fde047]"
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
              className="w-full btn-cyber-yellow py-4 text-xs font-extrabold uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              {loading ? 'Deploying Contract...' : 'Deploy Market Contract On-Chain'}
            </button>
          ) : (
            <div className="p-4 rounded-2xl bg-black/80 border border-white/10 text-center text-xs text-slate-400 space-y-2 font-mono">
              <UserCheck className="w-5 h-5 text-[#fde047] mx-auto" />
              <p>Connect your wallet to execute smart contract deployment.</p>
            </div>
          )}

          {txHash && (
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/50 text-xs text-emerald-300 flex items-center gap-2 font-mono">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Market deployed! <TxLink hash={txHash} />
              </span>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/50 text-xs text-rose-300 flex items-center gap-2 font-mono">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </form>

        {/* Live Preview Column */}
        <div className="space-y-6">
          <div className="glass-panel p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-xs font-black uppercase text-white tracking-widest flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#fde047]" />
                Live Payoff Curve Preview
              </h3>
              <span className="text-[10px] bg-[#fde047] text-black px-3 py-1 rounded-full font-mono font-bold">
                Real-Time Render
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-mono">
              Visual preview of how winning and losing payouts scale for LONG vs SHORT positions under your target parameters.
            </p>

            <PayoffChart market={liveMarketPreview} />
          </div>
        </div>
      </div>
    </div>
  )
}
