'use client'

import React, { use, useEffect, useState } from 'react'
import { PayoffChart } from '../../../components/PayoffChart'
import { WeatherChart } from '../../../components/WeatherChart'
import { StatusBadge } from '../../../components/StatusBadge'
import { TxLink } from '../../../components/TxLink'
import {
  CloudRain,
  Thermometer,
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle,
  Zap,
  TrendingUp,
  DollarSign,
  UserCheck
} from 'lucide-react'
import {
  getMarket,
  getMarketPositions,
  getWeatherReadings,
  approveCollateral,
  mintPosition,
  settle,
  type Market,
  type Position,
  type WeatherReading,
  formatCollateral,
  formatExpiry,
  timeUntilExpiry
} from '@breezeswap/sdk'
import { useBreezeSDK } from '../../../lib/hooks/useBreezeSDK'

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

export default function MarketDetailPage({ params }: { params: Promise<{ address: string }> }) {
  const resolvedParams = use(params)
  const marketAddress = resolvedParams.address.toLowerCase()
  const { indexerUrl, walletClient, publicClient, isConnected } = useBreezeSDK()

  const [market, setMarket] = useState<Market | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [weatherReadings, setWeatherReadings] = useState<WeatherReading[]>([])
  const [loading, setLoading] = useState(true)

  // Mint Form State
  const [side, setSide] = useState<'LONG' | 'SHORT'>('LONG')
  const [collateralInput, setCollateralInput] = useState<string>('10')
  const [mintLoading, setMintLoading] = useState(false)
  const [mintTxHash, setMintTxHash] = useState<string | null>(null)
  const [mintError, setMintError] = useState<string | null>(null)

  // Settle State
  const [settleLoading, setSettleLoading] = useState(false)
  const [settleTxHash, setSettleTxHash] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    let m: Market | null = null

    try {
      const rawM = await getMarket(indexerUrl, marketAddress)
      m = ensureMarketMapped(rawM)
      setMarket(m)
    } catch (err) {
      console.error('Failed loading market metadata:', err)
      setMarket(null)
    }

    if (m && m.regionId) {
      try {
        const readings = await getWeatherReadings(indexerUrl, m.regionId)
        setWeatherReadings(readings)
      } catch (err) {
        console.warn('Failed loading weather readings:', err)
        setWeatherReadings([])
      }
    }

    try {
      const pos = await getMarketPositions(indexerUrl, marketAddress)
      setPositions(pos)
    } catch (err) {
      console.warn('Failed loading market positions:', err)
      setPositions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [indexerUrl, marketAddress])

  async function handleApproveAndMint() {
    setMintLoading(true)
    setMintError(null)
    setMintTxHash(null)

    if (!walletClient || !publicClient || !market) {
      console.error('Wallet/public client or market not ready', { walletClient, publicClient, market })
      setMintError('Wallet not connected or network mismatch. Please connect your wallet to Flare Coston2 Testnet.')
      setMintLoading(false)
      return
    }

    try {
      const amountBigInt = BigInt(Math.round(Number(collateralInput) * 1e6))
      const tokenAddress = market.collateralToken as `0x${string}`
      const spenderAddress = market.contractAddress as `0x${string}`

      console.log('Approving collateral token...', { tokenAddress, spenderAddress, amount: amountBigInt.toString() })
      // 1. Approve collateral
      await approveCollateral(
        walletClient as any,
        publicClient as any,
        tokenAddress,
        spenderAddress,
        amountBigInt
      )

      console.log('Minting position...', { marketAddress: spenderAddress, side, amount: amountBigInt.toString() })
      // 2. Mint position
      const hash = await mintPosition(
        walletClient as any,
        publicClient as any,
        {
          marketAddress: spenderAddress,
          side,
          collateralAmount: amountBigInt
        }
      )

      setMintTxHash(hash)
      loadData()
    } catch (err: any) {
      console.error('Mint position error:', err)
      setMintError(err?.shortMessage || err?.message || 'Minting position failed')
    } finally {
      setMintLoading(false)
    }
  }

  async function handleSettle() {
    if (!walletClient || !publicClient || !market) {
      alert('Wallet is not connected or ready. Please connect to Flare Coston2 Testnet.')
      return
    }
    setSettleLoading(true)
    try {
      console.log('Settling market on-chain...', market.contractAddress)
      const hash = await settle(
        walletClient as any,
        publicClient as any,
        market.contractAddress as `0x${string}`
      )
      setSettleTxHash(hash)
      loadData()
    } catch (err: any) {
      console.error('Settle error:', err)
      alert(err?.shortMessage || err?.message || 'Settlement failed')
    } finally {
      setSettleLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center space-y-4">
        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-400">Loading market metadata & on-chain stats...</p>
      </div>
    )
  }

  if (!market) {
    return (
      <div className="py-20 text-center space-y-4">
        <h2 className="text-2xl font-bold text-white">Market Not Found</h2>
        <p className="text-xs text-slate-400">Address {marketAddress} could not be located in indexer database.</p>
      </div>
    )
  }

  const isRainfall = market.weatherVariable === 'RAINFALL'
  const unit = isRainfall ? 'mm' : '°C'
  const totalCollateral = positions.reduce((acc, p) => acc + Number(p.collateralAmount), 0)
  const longCount = positions.filter((p) => p.side === 'LONG').length
  const shortCount = positions.filter((p) => p.side === 'SHORT').length
  const isExpired = new Date(market.expiryTimestamp).getTime() <= Date.now()

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 rounded-3xl bg-slate-900/80 border border-slate-800">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🌐</span>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                  {market.regionName || 'Global Region'} Market
                </h1>
                <StatusBadge status={market.status} />
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                {isRainfall ? (
                  <CloudRain className="w-4 h-4 text-cyan-400" />
                ) : (
                  <Thermometer className="w-4 h-4 text-amber-400" />
                )}
                <span>{market.weatherVariable}</span>
                <span>•</span>
                <span>Payoff: <strong>{market.payoffType}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-2 border-t border-slate-800/60">
            <div>
              Contract: <TxLink hash={market.contractAddress} />
            </div>
            <div>
              Collateral Token: <span className="text-slate-200 font-semibold font-mono">mUSDT</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              Expiry: <span className="text-slate-200 font-medium">{formatExpiry(market.expiryTimestamp)}</span> ({timeUntilExpiry(market.expiryTimestamp)})
            </div>
          </div>
        </div>

        {market.status === 'OPEN' && isExpired && (
          <button
            onClick={handleSettle}
            disabled={settleLoading}
            className="flex items-center gap-2 py-3 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 font-bold text-xs hover:opacity-90 transition-all shadow-lg shadow-amber-500/20"
          >
            <Zap className="w-4 h-4" />
            {settleLoading ? 'Settling...' : 'Settle Market (Permissionless)'}
          </button>
        )}
      </div>

      {settleTxHash && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/50 text-xs text-amber-300">
          Market settled successfully! <TxLink hash={settleTxHash} />
        </div>
      )}

      {/* Grid: Payoff Curve + Weather History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              Payoff Curve Math
            </h3>
            <span className="text-xs text-slate-400">LONG vs SHORT Payout Scaling</span>
          </div>
          <PayoffChart market={market} />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <CloudRain className="w-4 h-4 text-cyan-400" />
              Historical Weather Readings (Open-Meteo)
            </h3>
            <span className="text-xs text-slate-400">30-Day Oracle Trend</span>
          </div>
          <WeatherChart
            readings={weatherReadings}
            thresholdLow={market.thresholdLow}
            thresholdHigh={market.thresholdHigh}
            variable={market.weatherVariable}
          />
        </div>
      </div>

      {/* Stats Row & Mint Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Market Stats */}
        <div className="space-y-6 lg:col-span-1">
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider text-slate-400">Market Statistics</h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400">Total Collateral Locked</span>
                <span className="font-bold text-emerald-400 font-mono">
                  {formatCollateral(totalCollateral.toString(), 6, 'mUSDT')}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400">Positions Breakdown</span>
                <span className="font-semibold text-slate-200">
                  <span className="text-emerald-400 font-bold">{longCount} LONG</span> / <span className="text-rose-400 font-bold">{shortCount} SHORT</span>
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400">Threshold Settings</span>
                <span className="font-bold text-cyan-400 font-mono">
                  {market.thresholdHigh ? `${market.thresholdLow} – ${market.thresholdHigh} ${unit}` : `${market.thresholdLow} ${unit}`}
                </span>
              </div>

              {market.status === 'SETTLED' && (
                <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-800/50 space-y-2">
                  <span className="text-xs font-semibold text-purple-300 block">Final Settlement Result</span>
                  <div className="text-sm font-bold text-white font-mono">
                    Oracle Value: {market.finalOracleValue} {unit}
                  </div>
                  <div className="text-xs text-purple-300">
                    LONG Payout: {((market.longPayoutRatio || 0) * 100).toFixed(1)}% | SHORT Payout: {((market.shortPayoutRatio || 0) * 100).toFixed(1)}%
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Mint Position Form */}
        <div className="lg:col-span-2">
          {market.status === 'OPEN' ? (
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white">Mint Weather Position</h3>
                <p className="text-xs text-slate-400">Deposit collateral to mint a transferable ERC-1155 position token.</p>
              </div>

              {/* Side Selector */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setSide('LONG')}
                  className={`p-4 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                    side === 'LONG'
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/10'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <TrendingUp className="w-5 h-5" />
                  <span className="font-bold text-sm">LONG</span>
                  <span className="text-[10px] opacity-80">Expect weather &ge; threshold</span>
                </button>

                <button
                  onClick={() => setSide('SHORT')}
                  className={`p-4 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                    side === 'SHORT'
                      ? 'bg-rose-500/10 border-rose-500 text-rose-400 shadow-lg shadow-rose-500/10'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <TrendingUp className="w-5 h-5 rotate-180" />
                  <span className="font-bold text-sm">SHORT</span>
                  <span className="text-[10px] opacity-80">Expect weather &lt; threshold</span>
                </button>
              </div>

              {/* Collateral Amount */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">Collateral Amount (mUSDT)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={collateralInput}
                    onChange={(e) => setCollateralInput(e.target.value)}
                    min="1"
                    className="w-full bg-slate-950 border border-slate-800 text-white font-mono rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                  <span className="absolute right-4 top-3 text-xs font-bold text-slate-400">mUSDT</span>
                </div>
              </div>

              {/* Payout Estimation */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-1">
                <span className="text-slate-400">Max Potential Payout if Win:</span>
                <span className="text-base font-bold text-emerald-400 font-mono block">
                  ${(Number(collateralInput) || 0).toFixed(2)} mUSDT
                </span>
                <p className="text-[10px] text-slate-400">
                  Full 100% payout achieved if oracle value satisfies winning threshold condition.
                </p>
              </div>

              {/* Submit Button */}
              {isConnected ? (
                <button
                  onClick={handleApproveAndMint}
                  disabled={mintLoading || !collateralInput}
                  className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
                >
                  <DollarSign className="w-4 h-4" />
                  {mintLoading ? 'Approving & Minting Position...' : 'Approve & Mint Position'}
                </button>
              ) : (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400 space-y-2">
                  <UserCheck className="w-5 h-5 text-cyan-400 mx-auto" />
                  <p>Connect your Web3 wallet using the header button to mint positions.</p>
                </div>
              )}

              {mintTxHash && (
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Position minted successfully! <TxLink hash={mintTxHash} /></span>
                </div>
              )}

              {mintError && (
                <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/50 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{mintError}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-3">
              <h3 className="text-lg font-bold text-white">Market Settled</h3>
              <p className="text-xs text-slate-400">This market has concluded. Head over to your User Portfolio to redeem your payout.</p>
            </div>
          )}
        </div>
      </div>

      {/* Positions Table */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-white">Market Position Holders</h3>
        {positions.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400">
            No positions minted in this market yet. Be the first to mint!
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-4">Side</th>
                  <th className="p-4">Collateral</th>
                  <th className="p-4">Holder</th>
                  <th className="p-4">Minted At</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Tx Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {positions.map((p) => (
                  <tr key={p.id || p.txHash} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-4">
                      <span
                        className={`font-bold ${
                          p.side === 'LONG' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {p.side}
                      </span>
                    </td>
                    <td className="p-4 font-mono font-semibold text-slate-200">
                      {formatCollateral(p.collateralAmount, 6, 'mUSDT')}
                    </td>
                    <td className="p-4 font-mono">{`${p.holderAddress.slice(0, 6)}...${p.holderAddress.slice(-4)}`}</td>
                    <td className="p-4">{formatExpiry(p.mintedAt)}</td>
                    <td className="p-4">
                      {p.redeemed ? (
                        <span className="text-emerald-400 font-semibold">Redeemed</span>
                      ) : (
                        <span className="text-slate-400">Active</span>
                      )}
                    </td>
                    <td className="p-4">
                      <TxLink hash={p.txHash} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
