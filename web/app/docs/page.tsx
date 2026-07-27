'use client'

import React from 'react'
import { BookOpen, ShieldCheck, Terminal, Layers, ExternalLink, Code } from 'lucide-react'
import { CONTRACT_ADDRESSES, COSTON2_CHAIN_ID, FLARE_MAINNET_CHAIN_ID } from '@breezeswap/sdk'

export default function DocsPage() {
  const coston2Contracts = CONTRACT_ADDRESSES[COSTON2_CHAIN_ID]
  const mainnetContracts = CONTRACT_ADDRESSES[FLARE_MAINNET_CHAIN_ID]

  return (
    <div className="max-w-4xl mx-auto space-y-12 py-4">
      {/* Title */}
      <div className="border-b border-slate-800 pb-8 space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold">
          <BookOpen className="w-3.5 h-3.5 text-amber-400" />
          <span>Protocol & Developer Documentation</span>
        </div>
        <h1 className="text-4xl font-extrabold text-white tracking-tight">BreezeSwap Documentation</h1>
        <p className="text-sm text-slate-400 leading-relaxed">
          Decentralized parametric weather derivatives on Flare Network (Coston2 Testnet & Flare Mainnet), settled permissionlessly by real-world weather oracle feeds.
        </p>
      </div>

      {/* 1. What is BreezeSwap */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-cyan-400" />
          1. What is BreezeSwap?
        </h2>
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3 text-xs text-slate-300 leading-relaxed">
          <p>
            BreezeSwap is a first-of-its-kind weather derivatives protocol built for Flare Network. It enables agricultural enterprises, renewable energy producers, event planners, and retail traders to hedge or speculate on weather volatility (rainfall, temperature).
          </p>
          <p>
            Traditional weather insurance requires long claim adjustment periods and manual approvals. BreezeSwap contracts are parametric: once a market expires, the oracle feed delivers verified weather readings (from Open-Meteo & Kweather) and smart contracts automatically compute payouts mathematically.
          </p>
        </div>
      </section>

      {/* 2. Payoff Types */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-purple-400" />
          2. Payoff Curve Structures
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs">
            <h3 className="font-bold text-emerald-400 text-sm">BINARY</h3>
            <p className="text-slate-400">
              All-or-nothing step function. If final oracle reading &ge; threshold, LONG gets 100% of collateral and SHORT gets 0%. Otherwise, SHORT gets 100%.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs">
            <h3 className="font-bold text-cyan-400 text-sm">LINEAR</h3>
            <p className="text-slate-400">
              Proportional payout scaling upwards from thresholdLow. Payout ratio increases linearly with the recorded weather metric.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs">
            <h3 className="font-bold text-amber-400 text-sm">CAPPED</h3>
            <p className="text-slate-400">
              Bounded linear slope between thresholdLow and thresholdHigh. Payout is 0% below low threshold, 100% above high threshold, and linear in between.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Contract Addresses */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Terminal className="w-5 h-5 text-emerald-400" />
          3. Multi-Chain Contract Registry
        </h2>

        {/* Flare Mainnet */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            Flare Mainnet Deployed Contracts (Chain ID 14)
          </h3>
          <div className="overflow-x-auto rounded-2xl border border-emerald-500/20 bg-slate-900/60">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-4">Contract Name</th>
                  <th className="p-4">Deployed Address</th>
                  <th className="p-4">Block Explorer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono">
                {Object.entries(mainnetContracts).map(([name, address]) => (
                  <tr key={name} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-4 font-sans font-semibold text-slate-200">{name}</td>
                    <td className="p-4 text-emerald-400">{address}</td>
                    <td className="p-4 font-sans">
                      <a
                        href={`https://flare-explorer.flare.network/address/${address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
                      >
                        Explorer <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Coston2 Testnet */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            Flare Coston2 Testnet Contracts (Chain ID 114)
          </h3>
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-4">Contract Name</th>
                  <th className="p-4">Deployed Address</th>
                  <th className="p-4">Block Explorer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono">
                {Object.entries(coston2Contracts).map(([name, address]) => (
                  <tr key={name} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-4 font-sans font-semibold text-slate-200">{name}</td>
                    <td className="p-4 text-cyan-400">{address}</td>
                    <td className="p-4 font-sans">
                      <a
                        href={`https://coston2-explorer.flare.network/address/${address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
                      >
                        Explorer <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 4. SDK Integration */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Code className="w-5 h-5 text-amber-400" />
          4. SDK Multi-Chain Integration Guide
        </h2>
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 text-xs font-mono text-slate-300">
          <p className="font-sans text-slate-400">
            Third-party developers can integrate BreezeSwap weather derivatives directly into their apps using the multi-chain TypeScript SDK:
          </p>
          <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 overflow-x-auto text-cyan-300">
{`import { getMarkets, createMarket, FLARE_MAINNET_CHAIN_ID } from '@breezeswap/sdk'

// 1. Fetch live markets for Flare Mainnet (Chain ID 14)
const markets = await getMarkets('https://breezeswap-indexer.onrender.com', FLARE_MAINNET_CHAIN_ID)

// 2. Execute multi-chain contract calls
const txHash = await createMarket(walletClient, publicClient, params, FLARE_MAINNET_CHAIN_ID)`}
          </pre>
        </div>
      </section>

      {/* 5. Security & Invariant Testing */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          5. Security & Adversarial Audits
        </h2>
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3 text-xs text-slate-300 leading-relaxed">
          <p>
            BreezeSwap smart contracts have undergone rigorous invariant fuzz testing (256 runs &times; 64 depth) and adversarial attack vectors:
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-slate-400 pl-2">
            <li><strong>Reentrancy Defense:</strong> Guarded with OpenZeppelin ReentrancyGuard on all state-mutating functions.</li>
            <li><strong>Vault Solvency Guarantee:</strong> Global supply tracking ensures collateral vault balance &ge; redeemable liabilities.</li>
            <li><strong>Precision Safety:</strong> Fixed-point 18-decimal payout math ensures 0 rounding loss or vault dust remaining.</li>
            <li><strong>Test Coverage:</strong> 122/122 passing Foundry test suites across unit, invariant, reentrancy, and economic game properties.</li>
          </ul>
        </div>
      </section>
    </div>
  )
}
