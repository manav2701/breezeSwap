'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { TrendingUp, RefreshCw, Zap, Shield, Compass, ArrowUpRight } from 'lucide-react'
import { getPerpMarkets, CONTRACT_ADDRESSES, COSTON2_CHAIN_ID, decodeRegionId, type PerpMarket } from '@breezeswap/sdk'
import { useBreezeSDK } from '../../lib/hooks/useBreezeSDK'

const DEMO_PERPS: PerpMarket[] = [
  {
    contractAddress: CONTRACT_ADDRESSES[COSTON2_CHAIN_ID].tokyoPerpMarket,
    chainId: 114,
    regionId: 'TOKYO_RAINFALL',
    regionName: 'Tokyo',
    collateralToken: CONTRACT_ADDRESSES[COSTON2_CHAIN_ID].mockUsdt,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    blockNumber: 12345,
    txHash: '0x111',
    markPrice: 25.0,
    oraclePrice: 25.0,
    fundingRate: 0.05,
    totalLongOpenInterest: '1000000000000000000000',
    totalShortOpenInterest: '800000000000000000000'
  },
  {
    contractAddress: CONTRACT_ADDRESSES[COSTON2_CHAIN_ID].seoulPerpMarket,
    chainId: 114,
    regionId: 'SEOUL_RAINFALL',
    regionName: 'Seoul',
    collateralToken: CONTRACT_ADDRESSES[COSTON2_CHAIN_ID].mockUsdt,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    blockNumber: 12346,
    txHash: '0x222',
    markPrice: 20.0,
    oraclePrice: 19.8,
    fundingRate: -0.02,
    totalLongOpenInterest: '500000000000000000000',
    totalShortOpenInterest: '750000000000000000000'
  },
  {
    contractAddress: CONTRACT_ADDRESSES[COSTON2_CHAIN_ID].dubaiPerpMarket,
    chainId: 114,
    regionId: 'DUBAI_TEMPERATURE',
    regionName: 'Dubai',
    collateralToken: CONTRACT_ADDRESSES[COSTON2_CHAIN_ID].mockUsdt,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    blockNumber: 12347,
    txHash: '0x333',
    markPrice: 40.0,
    oraclePrice: 40.2,
    fundingRate: 0.01,
    totalLongOpenInterest: '1200000000000000000000',
    totalShortOpenInterest: '1100000000000000000000'
  }
]

export default function PerpMarketsPage() {
  const { indexerUrl } = useBreezeSDK()
  const [markets, setMarkets] = useState<PerpMarket[]>(DEMO_PERPS)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function loadPerps() {
      setLoading(true)
      try {
        const live = await getPerpMarkets(indexerUrl)
        if (live && live.length > 0) {
          setMarkets(live)
        }
      } catch (err) {
        console.warn('Using demo perp markets:', err)
      } finally {
        setLoading(false)
      }
    }
    loadPerps()
  }, [indexerUrl])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 rounded-3xl bg-slate-900/80 border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-extrabold text-white">vAMM Perpetual Weather Markets</h1>
          </div>
          <p className="text-xs text-slate-400">
            Continuous 24/7 liquidity, synthetic constant-product curves ($x \cdot y = k$), 15-min funding rate settlements, and up to 3x leverage.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono text-xs font-semibold flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" /> 15m Funding Interval
          </span>
          <button
            onClick={() => setLoading(true)}
            className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Grid of Perp Markets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {markets.map((m) => (
          <div
            key={m.contractAddress}
            className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-5 hover:border-slate-700 transition-all flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {m.regionName || decodeRegionId(m.regionId)}
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400 uppercase">
                    vAMM Perpetual Derivative
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold font-mono">
                  {m.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Mark Price</span>
                  <span className="font-bold text-cyan-400 text-sm">
                    {m.markPrice ? m.markPrice.toFixed(2) : '25.00'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Oracle Price</span>
                  <span className="font-bold text-slate-300 text-sm">
                    {m.oraclePrice ? m.oraclePrice.toFixed(2) : '25.00'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Funding (15m)</span>
                  <span className={`font-bold ${ (m.fundingRate || 0) >= 0 ? 'text-rose-400' : 'text-emerald-400' }`}>
                    {(m.fundingRate || 0.01) > 0 ? '+' : ''}{(m.fundingRate || 0.01).toFixed(2)}%
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Max Leverage</span>
                  <span className="font-bold text-purple-400">3x</span>
                </div>
              </div>
            </div>

            <Link
              href={`/perp-markets/${m.contractAddress}`}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs hover:opacity-90 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/10 mt-4"
            >
              Trade Terminal <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
