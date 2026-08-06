'use client'

import React from 'react'
import { ExternalLink } from 'lucide-react'
import { CONTRACT_ADDRESSES, COSTON2_CHAIN_ID } from '@breezeswap/sdk'

const PAYOFF_TYPES = [
  {
    name: 'Binary',
    body: 'All or nothing. If the final reading lands at or above the strike, longs take the whole pot; otherwise shorts do.',
  },
  {
    name: 'Linear',
    body: 'Payout scales proportionally above the strike, with no ceiling — the further past it the reading lands, the more longs take.',
  },
  {
    name: 'Capped',
    body: 'A bounded ramp: 0% below the strike, 100% above the cap, and a straight line between the two.',
  },
]

const SECURITY_POINTS = [
  ['Reentrancy', 'OpenZeppelin ReentrancyGuard on every state-mutating entry point.'],
  ['Vault solvency', 'Global supply tracking keeps the vault balance at or above redeemable liabilities.'],
  ['Precision', 'Fixed-point 18-decimal payout maths, so settlement leaves no dust behind.'],
  ['Coverage', '122 Foundry tests across unit, invariant, reentrancy and economic-game properties.'],
]

export default function DocsPage() {
  const contracts = CONTRACT_ADDRESSES[COSTON2_CHAIN_ID]

  return (
    <div className="max-w-4xl mx-auto space-y-14">
      <header className="pb-6 border-b border-[color:var(--color-hairline)]">
        <p className="eyebrow mb-2">Documentation</p>
        <h1 className="display-2 text-ink">How BreezeSwap works</h1>
        <p className="lede mt-3 max-w-2xl">
          Parametric weather derivatives on Flare Coston2, settled from real oracle readings rather
          than by an adjuster&rsquo;s judgement.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="display-3 text-ink">The idea</h2>
        <div className="panel p-6 space-y-4 text-sm text-ink-muted leading-relaxed">
          <p>
            Farms, renewable operators, event organisers and traders all carry weather risk. The
            traditional way to move that risk is an insurance policy, which means a claim, an
            adjuster, and weeks of waiting to find out whether you get paid.
          </p>
          <p>
            A BreezeSwap contract replaces that judgement call with a formula. You pick a region and
            a threshold — 50mm of rain in Tokyo this week — and post collateral on one side. At
            expiry the oracle publishes the reading, and the contract computes both payouts on-chain.
            There is nobody to appeal to because there is nothing to decide.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="display-3 text-ink">Payout shapes</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {PAYOFF_TYPES.map((p) => (
            <article key={p.name} className="panel p-5 space-y-2">
              <h3 className="text-sm font-medium text-ink">{p.name}</h3>
              <p className="text-xs text-ink-muted leading-relaxed">{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="display-3 text-ink">Deployed contracts</h2>
        <p className="text-sm text-ink-muted">
          Coston2 testnet only, chain ID 114. There is no Flare mainnet deployment — mainnet is
          gated on a professional security audit.
        </p>

        <div className="panel">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Contract</th>
                  <th>Address</th>
                  <th className="text-right">Explorer</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(contracts).map(([name, address]) => (
                  <tr key={name}>
                    <td className="text-ink font-medium">{name}</td>
                    <td className="numeric">
                      {/* Full address, but clipped by the scroll container
                          rather than allowed to widen the page. */}
                      <span className="truncate-hash block max-w-[22ch]" title={String(address)}>
                        {String(address)}
                      </span>
                    </td>
                    <td className="text-right">
                      <a
                        href={`https://coston2-explorer.flare.network/address/${address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-ink-muted hover:text-accent transition-colors"
                      >
                        View
                        <ExternalLink className="w-3 h-3" aria-hidden />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="display-3 text-ink">SDK</h2>
        <div className="panel p-6 space-y-4">
          <p className="text-sm text-ink-muted leading-relaxed">
            Read markets and submit transactions from your own app with the TypeScript SDK.
          </p>
          <pre className="inset p-4 overflow-x-auto text-xs numeric text-ink leading-relaxed">
            {`import { getMarkets, createMarket, COSTON2_CHAIN_ID } from '@breezeswap/sdk'

// Fetch live markets for Coston2
const markets = await getMarkets(indexerUrl, COSTON2_CHAIN_ID)

// Deploy a new one against the resolved registry
const { txHash, marketAddress } = await createMarket(walletClient, publicClient, params)`}
          </pre>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="display-3 text-ink">Security</h2>
        <div className="panel divide-y divide-[color:var(--color-hairline)]">
          {SECURITY_POINTS.map(([title, body]) => (
            <div key={title} className="p-5 flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-6">
              <h3 className="text-sm font-medium text-ink sm:w-40 shrink-0">{title}</h3>
              <p className="text-sm text-ink-muted leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
