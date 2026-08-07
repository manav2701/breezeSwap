'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { Lock, PauseCircle, PlayCircle, RefreshCw, ShieldAlert } from 'lucide-react'
import {
  checkRole,
  CONTRACT_ADDRESSES,
  COSTON2_CHAIN_ID,
  getMarkets,
  KNOWN_REGIONS,
  setOracleReading,
  setTradingFeeBps,
  pauseMarket,
  unpauseMarket,
  pauseFactory,
  unpauseFactory,
  type Market,
} from '@breezeswap/sdk'
import { useBreezeSDK } from '../../lib/hooks/useBreezeSDK'
import { TxLink } from '../../components/TxLink'
import { InlineError } from '../../components/LoadError'
import { errorMessage } from '../../lib/errorMessage'
import { explainRevert } from '../../lib/revertReason'

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
  const [hasPauserRole, setHasPauserRole] = useState(false)
  const [hasOracleRole, setHasOracleRole] = useState(false)

  const [markets, setMarkets] = useState<Market[]>([])
  const [marketsError, setMarketsError] = useState<string | null>(null)
  const [events, setEvents] = useState<ProtocolEvent[]>([])
  const [eventsError, setEventsError] = useState<string | null>(null)
  const [roleCheckError, setRoleCheckError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const regionEntries = Object.entries(KNOWN_REGIONS)
  const [selectedRegion, setSelectedRegion] = useState<string>(regionEntries[0]?.[0] || '0x00')
  const [oracleValue, setOracleValue] = useState('25.0')
  const [oracleLoading, setOracleLoading] = useState(false)
  const [oracleTxHash, setOracleTxHash] = useState<string | null>(null)

  const [feeBps, setFeeBps] = useState('10')
  const [feeLoading, setFeeLoading] = useState(false)
  const [feeTxHash, setFeeTxHash] = useState<string | null>(null)

  const [factoryPaused, setFactoryPaused] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const addresses = CONTRACT_ADDRESSES[COSTON2_CHAIN_ID]

  const loadDashboardData = useCallback(async () => {
    setMarketsError(null)
    setEventsError(null)

    try {
      setMarkets((await getMarkets(indexerUrl, COSTON2_CHAIN_ID)) ?? [])
    } catch (err) {
      // The previous list stays on screen — stale markets are more useful than
      // none — but an operator about to pause a market needs to know the list
      // they are looking at may no longer be current.
      console.error('Failed to load markets for admin dashboard', err)
      setMarketsError(errorMessage(err))
    }

    try {
      const res = await fetch(`${indexerUrl}/api/admin/audit-log`)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const data = await res.json()
      setEvents(data.events || [])
    } catch (err) {
      // A non-ok response used to be dropped without even a console line, so a
      // broken audit endpoint read as "no protocol events recorded yet" on the
      // one page where that distinction matters most.
      console.error('Failed to load the audit feed', err)
      setEventsError(errorMessage(err))
    }
  }, [indexerUrl])

  useEffect(() => {
    async function initCheck() {
      if (!isConnected || !address || !publicClient) {
        setIsAdmin(false)
        setLoading(false)
        return
      }

      setRoleCheckError(null)
      try {
        const [admin, pauser, oracle] = await Promise.all([
          checkRole(publicClient as any, addresses.accessControl, 'ADMIN_ROLE', address),
          checkRole(publicClient as any, addresses.accessControl, 'PAUSER_ROLE', address),
          checkRole(publicClient as any, addresses.accessControl, 'ORACLE_UPDATER_ROLE', address),
        ])

        setIsAdmin(admin)
        setHasPauserRole(pauser)
        setHasOracleRole(oracle)

        if (admin || pauser || oracle) loadDashboardData()
      } catch (err) {
        // The gate stays closed — an unverified wallet must not get the controls
        // — but it now says the check itself failed rather than telling an actual
        // admin they do not hold ADMIN_ROLE.
        console.error('Role check failed', err)
        setIsAdmin(false)
        setRoleCheckError(errorMessage(err))
      } finally {
        setLoading(false)
      }
    }

    initCheck()
  }, [address, isConnected, publicClient, addresses.accessControl, loadDashboardData])

  async function handleSetOracleReading() {
    if (!walletClient || !publicClient) return
    setOracleLoading(true)
    setOracleTxHash(null)
    setError(null)
    try {
      const hash = await setOracleReading(
        walletClient as any,
        publicClient as any,
        addresses.oracle as `0x${string}`,
        selectedRegion as `0x${string}`,
        BigInt(Math.floor(Date.now() / 1000)),
        BigInt(Math.round(parseFloat(oracleValue) * 1e6))
      )
      setOracleTxHash(hash)
      loadDashboardData()
    } catch (err) {
      setError(explainRevert(err))
    } finally {
      setOracleLoading(false)
    }
  }

  /**
   * Previously this button popped an alert claiming the fee had been updated
   * without sending anything. It now calls FeeConfig.setTradingFeeBps and
   * surfaces the real transaction — or the real revert.
   */
  async function handleUpdateFee() {
    if (!walletClient || !publicClient) return
    const bps = Number(feeBps)
    if (!Number.isInteger(bps) || bps < 1 || bps > 100) {
      setError('The trading fee must be a whole number between 1 and 100 basis points.')
      return
    }

    setFeeLoading(true)
    setFeeTxHash(null)
    setError(null)
    try {
      const hash = await setTradingFeeBps(
        walletClient as any,
        publicClient as any,
        addresses.feeConfig as `0x${string}`,
        BigInt(bps)
      )
      setFeeTxHash(hash)
    } catch (err) {
      setError(explainRevert(err))
    } finally {
      setFeeLoading(false)
    }
  }

  async function handleFactoryToggle() {
    if (!walletClient || !publicClient) return
    setActionLoading('factory')
    setError(null)
    try {
      const fn = factoryPaused ? unpauseFactory : pauseFactory
      await fn(walletClient as any, publicClient as any, addresses.factory as `0x${string}`)
      setFactoryPaused((v) => !v)
      loadDashboardData()
    } catch (err) {
      setError(explainRevert(err))
    } finally {
      setActionLoading(null)
    }
  }

  async function handleMarketPause(marketAddress: string, currentlyPaused: boolean) {
    if (!walletClient || !publicClient) return
    setActionLoading(`market-${marketAddress}`)
    setError(null)
    try {
      const fn = currentlyPaused ? unpauseMarket : pauseMarket
      await fn(walletClient as any, publicClient as any, marketAddress as `0x${string}`)
      loadDashboardData()
    } catch (err) {
      setError(explainRevert(err))
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-[color:var(--color-hairline-strong)] border-t-accent animate-spin" />
        <p className="text-sm text-ink-faint">Verifying on-chain roles…</p>
      </div>
    )
  }

  if (!isConnected || isAdmin === false) {
    return (
      <div className="py-24 max-w-md mx-auto text-center space-y-6">
        <span className="w-14 h-14 rounded-2xl inset flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6 text-short" aria-hidden />
        </span>
        <div className="space-y-2">
          <h1 className="display-2 text-ink">Admin access restricted</h1>
          <p className="text-sm text-ink-muted break-words">
            {roleCheckError ? (
              'Your on-chain roles could not be verified, so the controls stay locked.'
            ) : address ? (
              <>
                <span className="numeric text-ink-faint">
                  {address.slice(0, 10)}…{address.slice(-8)}
                </span>{' '}
                does not hold ADMIN_ROLE on-chain.
              </>
            ) : (
              'Connect a wallet holding ADMIN_ROLE to continue.'
            )}
          </p>
          {roleCheckError && <InlineError message={roleCheckError} />}
        </div>
        <div className="panel p-5 text-left text-xs text-ink-muted leading-relaxed">
          Access is checked against <span className="text-ink">BreezeAccessControl</span> at read
          time. There is no server-side session — the gate is the contract.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b border-[color:var(--color-hairline)]">
        <div>
          <p className="eyebrow mb-2">Admin</p>
          <h1 className="display-2 text-ink">Protocol controls</h1>
          <p className="text-sm text-ink-muted mt-2">
            Oracle overrides, circuit breakers and fee configuration.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="chip chip-long">
            <ShieldAlert className="w-3 h-3" aria-hidden />
            Admin verified
          </span>
          <button
            type="button"
            onClick={loadDashboardData}
            className="btn btn-ghost btn-icon"
            aria-label="Refresh"
          >
            <RefreshCw className="w-4 h-4" aria-hidden />
          </button>
        </div>
      </header>

      {error && (
        <div className="panel p-4 text-sm value-short border-[color:rgba(244,63,94,0.3)] break-words">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12 items-start">
        <div className="lg:col-span-8 space-y-6 min-w-0">
          {/* Oracle */}
          <section className="panel p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[color:var(--color-hairline)]">
              <h2 className="display-3 text-ink">Oracle reading</h2>
              <span className={`chip ${hasOracleRole ? 'chip-long' : ''}`}>
                ORACLE_UPDATER_ROLE {hasOracleRole ? '✓' : '—'}
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="oracle-region" className="field-label">
                  Region
                </label>
                <select
                  id="oracle-region"
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="field"
                >
                  {regionEntries.map(([id, name]) => (
                    <option key={id} value={id}>
                      {String(name)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="oracle-value" className="field-label">
                  Reading (mm or °C)
                </label>
                <input
                  id="oracle-value"
                  type="number"
                  step="0.1"
                  value={oracleValue}
                  onChange={(e) => setOracleValue(e.target.value)}
                  className="field numeric"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleSetOracleReading}
              disabled={oracleLoading || !hasOracleRole}
              className="btn btn-primary w-full"
            >
              {oracleLoading ? 'Submitting…' : 'Push reading on-chain'}
            </button>

            {oracleTxHash && (
              <div className="inset p-3.5 flex items-center justify-between gap-3 text-xs">
                <span className="value-long">Reading published</span>
                <TxLink hash={oracleTxHash} />
              </div>
            )}
          </section>

          {/* Circuit breakers */}
          <section className="panel p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[color:var(--color-hairline)]">
              <h2 className="display-3 text-ink">Circuit breakers</h2>
              <span className={`chip ${hasPauserRole ? 'chip-long' : ''}`}>
                PAUSER_ROLE {hasPauserRole ? '✓' : '—'}
              </span>
            </div>

            <div className="inset p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-ink font-medium">Factory</p>
                <p className="text-xs text-ink-faint">Halts deployment of new markets.</p>
              </div>
              <button
                type="button"
                onClick={handleFactoryToggle}
                disabled={actionLoading === 'factory' || !hasPauserRole}
                className="btn btn-ghost btn-sm"
              >
                {factoryPaused ? (
                  <PlayCircle className="w-3.5 h-3.5" aria-hidden />
                ) : (
                  <PauseCircle className="w-3.5 h-3.5" aria-hidden />
                )}
                {actionLoading === 'factory'
                  ? 'Working…'
                  : factoryPaused
                    ? 'Unpause factory'
                    : 'Pause factory'}
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="eyebrow">Markets</h3>
              {marketsError && <InlineError message={`Market list may be stale: ${marketsError}`} />}
              {markets.length === 0 ? (
                <p className="text-xs text-ink-faint py-4 text-center">
                  {marketsError ? 'The market list could not be loaded.' : 'No deployed markets found.'}
                </p>
              ) : (
                markets.map((m) => {
                  const paused = m.status !== 'OPEN'
                  return (
                    <div
                      key={m.contractAddress}
                      className="inset p-4 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-ink font-medium truncate">
                          {m.regionName || 'Global'} — {m.weatherVariable}
                        </p>
                        <TxLink hash={m.contractAddress} type="address" />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleMarketPause(m.contractAddress, paused)}
                        disabled={actionLoading === `market-${m.contractAddress}` || !hasPauserRole}
                        className="btn btn-ghost btn-sm"
                      >
                        {actionLoading === `market-${m.contractAddress}`
                          ? 'Working…'
                          : paused
                            ? 'Unpause'
                            : 'Pause minting'}
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </section>

          {/* Fees */}
          <section className="panel p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[color:var(--color-hairline)]">
              <h2 className="display-3 text-ink">Fee configuration</h2>
              <span className="chip">Capped at 100 bps</span>
            </div>

            <dl className="grid sm:grid-cols-2 gap-4">
              <div className="inset p-4">
                <dt className="metric-label">Insurance fund</dt>
                <dd className="text-sm text-ink mt-1">80% — backstops bad debt</dd>
              </div>
              <div className="inset p-4">
                <dt className="metric-label">Protocol treasury</dt>
                <dd className="text-sm text-ink mt-1">20% — operational reserve</dd>
              </div>
            </dl>

            <div>
              <label htmlFor="fee-bps" className="field-label">
                Trading fee (basis points, 1–100)
              </label>
              <div className="flex flex-wrap gap-3">
                <input
                  id="fee-bps"
                  type="number"
                  min={1}
                  max={100}
                  value={feeBps}
                  onChange={(e) => setFeeBps(e.target.value)}
                  className="field numeric w-32"
                />
                <button
                  type="button"
                  onClick={handleUpdateFee}
                  disabled={feeLoading || !isAdmin}
                  className="btn btn-primary"
                >
                  {feeLoading ? 'Submitting…' : 'Update fee'}
                </button>
              </div>
              <p className="text-xs text-ink-faint mt-1.5">
                {(Number(feeBps) / 100 || 0).toFixed(2)}% per trade.
              </p>
            </div>

            {feeTxHash && (
              <div className="inset p-3.5 flex items-center justify-between gap-3 text-xs">
                <span className="value-long">Fee updated</span>
                <TxLink hash={feeTxHash} />
              </div>
            )}
          </section>
        </div>

        {/* Audit feed */}
        <div className="lg:col-span-4 min-w-0">
          <section className="panel p-5 sm:p-6 space-y-4 lg:sticky lg:top-24">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-[color:var(--color-hairline)]">
              <h2 className="display-3 text-ink">Audit feed</h2>
              <span className="numeric text-xs text-ink-faint">{events.length}</span>
            </div>

            {eventsError ? (
              <p className="py-10 text-center">
                <InlineError message={eventsError} />
              </p>
            ) : events.length === 0 ? (
              <p className="py-10 text-center text-xs text-ink-faint">
                No protocol events recorded yet.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[30rem] overflow-y-auto -mr-1 pr-1">
                {events.map((e) => (
                  <article key={e.id} className="inset p-3.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="chip chip-accent">{e.event_type}</span>
                      <span className="numeric text-ink-faint">
                        {new Date(e.occurred_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {e.account && (
                      <p className="numeric text-ink-muted truncate" title={e.account}>
                        {e.account}
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[color:var(--color-hairline)]">
                      <span className="numeric text-ink-faint">Block {e.block_number}</span>
                      <TxLink hash={e.tx_hash} />
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
