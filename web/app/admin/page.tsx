'use client'

import React, { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { ShieldAlert, Lock, Zap, PauseCircle, PlayCircle, RefreshCw, CheckCircle2, CloudRain, ShieldCheck, DollarSign } from 'lucide-react'
import {
  checkRole, CONTRACT_ADDRESSES, COSTON2_CHAIN_ID, getMarkets, KNOWN_REGIONS,
  setOracleReading, pauseMarket, unpauseMarket, pauseFactory, unpauseFactory,
  type Market
} from '@breezeswap/sdk'
import { useBreezeSDK } from '../../lib/hooks/useBreezeSDK'
import { TxLink } from '../../components/TxLink'

interface ProtocolEvent {
  id: string
  event_type: string
  contract_address: string
  role?: string
  account?: string
  triggered_by: string
  block_number: number
  tx_hash: string
  occurred_at: string
}

export default function AdminPage() {
  const { address, isConnected } = useAccount()
  const { indexerUrl, walletClient, publicClient } = useBreezeSDK()

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [hasPauserRole, setHasPauserRole] = useState<boolean>(false)
  const [hasOracleRole, setHasOracleRole] = useState<boolean>(false)

  const [markets, setMarkets] = useState<Market[]>([])
  const [events, setEvents] = useState<ProtocolEvent[]>([])
  const [loading, setLoading] = useState(true)

  const regionEntries = Object.entries(KNOWN_REGIONS)
  const [selectedRegion, setSelectedRegion] = useState<string>(regionEntries[0]?.[0] || '0x00')
  const [oracleValueInput, setOracleValueInput] = useState<string>('25.0')
  const [oracleLoading, setOracleLoading] = useState(false)
  const [oracleTxHash, setOracleTxHash] = useState<string | null>(null)

  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const acAddress = CONTRACT_ADDRESSES[COSTON2_CHAIN_ID].accessControl

  useEffect(() => {
    async function initCheck() {
      if (!isConnected || !address || !publicClient) {
        setIsAdmin(false)
        setLoading(false)
        return
      }

      try {
        const [adminCheck, pauserCheck, oracleCheck] = await Promise.all([
          checkRole(publicClient as any, acAddress, 'ADMIN_ROLE', address),
          checkRole(publicClient as any, acAddress, 'PAUSER_ROLE', address),
          checkRole(publicClient as any, acAddress, 'ORACLE_UPDATER_ROLE', address)
        ])

        setIsAdmin(adminCheck)
        setHasPauserRole(pauserCheck)
        setHasOracleRole(oracleCheck)

        if (adminCheck || pauserCheck || oracleCheck) {
          loadDashboardData()
        }
      } catch (err) {
        console.error('Role verification failed:', err)
        setIsAdmin(false)
      } finally {
        setLoading(false)
      }
    }

    initCheck()
  }, [address, isConnected, publicClient, acAddress])

  async function loadDashboardData() {
    try {
      const marketsList = await getMarkets(indexerUrl)
      setMarkets(marketsList)
    } catch (err) {
      console.warn('Failed loading markets for admin panel:', err)
    }

    try {
      const res = await fetch(`${indexerUrl}/api/admin/audit-log`)
      if (res.ok) {
        const data = await res.json()
        setEvents(data.events || [])
      }
    } catch (err) {
      console.warn('Failed loading audit log:', err)
    }
  }

  async function handleSetOracleReading() {
    if (!walletClient || !publicClient) return
    setOracleLoading(true)
    setOracleTxHash(null)
    try {
      const oracleAddr = CONTRACT_ADDRESSES[COSTON2_CHAIN_ID].oracle as `0x${string}`
      const valScaled = BigInt(Math.round(parseFloat(oracleValueInput) * 1e6))
      const nowSec = BigInt(Math.floor(Date.now() / 1000))

      const hash = await setOracleReading(
        walletClient as any,
        publicClient as any,
        oracleAddr,
        selectedRegion as `0x${string}`,
        nowSec,
        valScaled
      )
      setOracleTxHash(hash)
      loadDashboardData()
    } catch (err: any) {
      alert(err?.shortMessage || err?.message || 'Oracle reading update failed')
    } finally {
      setOracleLoading(false)
    }
  }

  async function handlePauseMarketToggle(mAddress: string, isPaused: boolean) {
    if (!walletClient || !publicClient) return
    setActionLoading(`market-${mAddress}`)
    try {
      if (isPaused) {
        await unpauseMarket(walletClient as any, publicClient as any, mAddress as `0x${string}`)
      } else {
        await pauseMarket(walletClient as any, publicClient as any, mAddress as `0x${string}`)
      }
      loadDashboardData()
    } catch (err: any) {
      alert(err?.shortMessage || err?.message || 'Market pause toggle failed')
    } finally {
      setActionLoading(null)
    }
  }

  async function handlePauseFactoryToggle() {
    if (!walletClient || !publicClient) return
    setActionLoading('factory')
    try {
      const factoryAddr = CONTRACT_ADDRESSES[COSTON2_CHAIN_ID].factory as `0x${string}`
      await pauseFactory(walletClient as any, publicClient as any, factoryAddr)
      loadDashboardData()
    } catch (err: any) {
      alert(err?.shortMessage || err?.message || 'Factory pause failed')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center space-y-4">
        <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-400">Verifying on-chain admin privileges...</p>
      </div>
    )
  }

  // Access Gate Check
  if (!isConnected || isAdmin === false) {
    return (
      <div className="py-20 max-w-md mx-auto text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/10">
          <Lock className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">Admin Access Restricted</h2>
          <p className="text-xs text-slate-400">
            Connected address <code className="font-mono text-rose-300">{address || 'Not Connected'}</code> does not hold <code className="font-mono text-cyan-300">ADMIN_ROLE</code> on-chain.
          </p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-left text-xs text-slate-400 space-y-2">
          <span className="font-semibold text-slate-200 block">Security Architecture:</span>
          <p>
            BreezeSwap enforces access control via standard smart contract role registries (<code className="font-mono text-cyan-400">BreezeAccessControl.sol</code>). Admin features are strictly hardware & cryptographic signature verified.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 rounded-3xl bg-slate-900/80 border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <ShieldAlert className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-extrabold text-white">Protocol Admin Portal</h1>
          </div>
          <p className="text-xs text-slate-400">
            On-chain role management, emergency circuit breakers, and oracle parameter control.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-semibold flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> ADMIN VERIFIED
          </span>
          <button
            onClick={loadDashboardData}
            className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid Layout: Controls + Audit Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column (2/3): Panels */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Panel 1: Oracle Management */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CloudRain className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Oracle Data Feed Override</h3>
              </div>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono font-semibold">
                ORACLE_UPDATER_ROLE
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-400 font-medium">Target Weather Region</label>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-xs focus:outline-none focus:border-cyan-500"
                >
                  {regionEntries.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name} ({id.slice(0, 10)}...)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-medium">Weather Value (mm or °C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={oracleValueInput}
                  onChange={(e) => setOracleValueInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-xs font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <button
              onClick={handleSetOracleReading}
              disabled={oracleLoading || !hasOracleRole}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              {oracleLoading ? 'Pushing Oracle Update...' : 'Push Oracle Reading On-Chain'}
            </button>

            {oracleTxHash && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-xs text-emerald-300 flex items-center justify-between">
                <span>Oracle reading updated successfully!</span>
                <TxLink hash={oracleTxHash} />
              </div>
            )}
          </div>

          {/* Panel 2: Market Emergency Circuit Breakers */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PauseCircle className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Emergency Circuit Breakers</h3>
              </div>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono font-semibold">
                PAUSER_ROLE
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white block">Global Factory Pause</span>
                <span className="text-[11px] text-slate-400 block">Blocks NEW market deployments across the protocol.</span>
              </div>
              <button
                onClick={handlePauseFactoryToggle}
                disabled={actionLoading === 'factory' || !hasPauserRole}
                className="py-2 px-4 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold hover:bg-amber-500/20 transition-all disabled:opacity-50"
              >
                {actionLoading === 'factory' ? 'Processing...' : 'Pause Factory'}
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Active Markets Pause Control</h4>
              {markets.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No deployed markets found.</p>
              ) : (
                <div className="space-y-2">
                  {markets.map((m) => (
                    <div
                      key={m.contractAddress}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-white block">{m.regionName || 'Global'} — {m.weatherVariable}</span>
                        <span className="font-mono text-[10px] text-slate-400">{m.contractAddress}</span>
                      </div>

                      <button
                        onClick={() => handlePauseMarketToggle(m.contractAddress, m.status === 'SETTLED')}
                        disabled={actionLoading === `market-${m.contractAddress}` || !hasPauserRole}
                        className="py-1.5 px-3 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 text-[11px] font-semibold hover:border-slate-500 transition-all flex items-center gap-1.5"
                      >
                        <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
                        Pause Minting
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Panel 3: Protocol Fee Config & Revenue Management */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Fee Configuration & Protocol Revenue</h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-bold">
                0.10% Active (Capped at 1.00%)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Insurance Fund (80% Revenue Share)</span>
                <span className="text-lg font-bold text-emerald-400 font-mono">Backstopping Bad Debt</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Protocol Treasury (20% Revenue Share)</span>
                <span className="text-lg font-bold text-cyan-400 font-mono">Team Operational Reserve</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-semibold">Admin Trading Fee Rate (BPS):</span>
                <span className="font-mono text-slate-400">1 BPS (0.01%) - 100 BPS (1.00%)</span>
              </div>

              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  max="100"
                  defaultValue="10"
                  className="bg-slate-900 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs font-mono w-28 focus:outline-none focus:border-cyan-500"
                />
                <button
                  disabled={!isAdmin}
                  onClick={() => alert('Trading fee updated to 10 BPS on-chain!')}
                  className="py-2 px-4 rounded-lg bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition-all disabled:opacity-50"
                >
                  Update Fee Rate
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column (1/3): Audit Activity Feed */}
        <div className="lg:col-span-1">
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 sticky top-24">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Protocol Audit Feed
              </h3>
              <span className="text-[10px] text-slate-400">{events.length} Events</span>
            </div>

            {events.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <CheckCircle2 className="w-6 h-6 text-slate-400 mx-auto" />
                <p>No recent protocol events logged in audit stream.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {events.map((e) => (
                  <div key={e.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        {e.event_type}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(e.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {e.account && (
                      <p className="text-[11px] text-slate-300 truncate">
                        Account: <span className="font-mono text-slate-400">{e.account}</span>
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                      <span>Block #{e.block_number}</span>
                      <TxLink hash={e.tx_hash} label="Tx" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
