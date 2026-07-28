'use client'

import React from 'react'
import { BookOpen, ShieldCheck, Terminal, Layers, ExternalLink, Code } from 'lucide-react'
import { CONTRACT_ADDRESSES, COSTON2_CHAIN_ID, FLARE_MAINNET_CHAIN_ID } from '@breezeswap/sdk'

export default function DocsPage() {
  const coston2Contracts = CONTRACT_ADDRESSES[COSTON2_CHAIN_ID]
  const mainnetContracts = CONTRACT_ADDRESSES[FLARE_MAINNET_CHAIN_ID]

  return (
    <div className="max-w-5xl mx-auto space-y-12 py-4">
      {/* Title */}
      <div className="border-b border-white/10 pb-8 space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/10 text-[#fde047] text-xs font-mono font-bold uppercase">
          <BookOpen className="w-4 h-4 text-[#fde047]" />
          <span>Protocol & Developer Documentation</span>
        </div>
        <h1 className="text-4xl font-black uppercase text-white tracking-tight">BreezeSwap Documentation</h1>
        <p className="text-xs text-slate-400 font-mono leading-relaxed">
          Decentralized parametric weather derivatives on Flare Network (Coston2 Testnet & Flare Mainnet), settled permissionlessly by real-world weather oracle feeds.
        </p>
      </div>

      {/* 1. What is BreezeSwap */}
      <section className="space-y-4">
        <h2 className="text-2xl font-black uppercase text-white flex items-center gap-3 tracking-tight">
          <Layers className="w-6 h-6 text-[#fde047]" />
          1. What is BreezeSwap?
        </h2>
        <div className="glass-panel p-6 sm:p-8 space-y-3 text-xs text-slate-300 leading-relaxed font-mono">
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
        <h2 className="text-2xl font-black uppercase text-white flex items-center gap-3 tracking-tight">
          <Layers className="w-6 h-6 text-purple-400" />
          2. Payoff Curve Structures
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono">
          <div className="glass-panel p-6 space-y-2 text-xs">
            <h3 className="font-extrabold text-emerald-400 text-sm uppercase">BINARY</h3>
            <p className="text-slate-400">
              All-or-nothing step function. If final oracle reading &ge; threshold, LONG gets 100% of collateral and SHORT gets 0%. Otherwise, SHORT gets 100%.
            </p>
          </div>

          <div className="glass-panel p-6 space-y-2 text-xs">
            <h3 className="font-extrabold text-[#fde047] text-sm uppercase">LINEAR</h3>
            <p className="text-slate-400">
              Proportional payout scaling upwards from thresholdLow. Payout ratio increases linearly with the recorded weather metric.
            </p>
          </div>

          <div className="glass-panel p-6 space-y-2 text-xs">
            <h3 className="font-extrabold text-amber-400 text-sm uppercase">CAPPED</h3>
            <p className="text-slate-400">
              Bounded linear slope between thresholdLow and thresholdHigh. Payout is 0% below low threshold, 100% above high threshold, and linear in between.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Contract Addresses */}
      <section className="space-y-6">
        <h2 className="text-2xl font-black uppercase text-white flex items-center gap-3 tracking-tight">
          <Terminal className="w-6 h-6 text-emerald-400" />
          3. Multi-Chain Contract Registry
        </h2>

        {/* Flare Mainnet */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono font-bold uppercase text-emerald-400 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            Flare Mainnet Deployed Contracts (Chain ID 14)
          </h3>
          <div className="glass-panel overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead className="bg-black/60 text-slate-400 uppercase tracking-widest font-mono text-[10px] border-b border-white/10">
                <tr>
                  <th className="p-4">Contract Name</th>
                  <th className="p-4">Deployed Address</th>
                  <th className="p-4">Block Explorer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {Object.entries(mainnetContracts).map(([name, address]) => (
                  <tr key={name} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 font-sans font-extrabold text-white">{name}</td>
                    <td className="p-4 text-emerald-400 font-bold">{address}</td>
                    <td className="p-4 font-sans">
                      <a
                        href={`https://flare-explorer.flare.network/address/${address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-slate-400 hover:text-[#fde047] transition-colors"
                      >
                        Explorer <ExternalLink className="w-3.5 h-3.5 text-[#fde047]" />
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
          <h3 className="text-xs font-mono font-bold uppercase text-[#fde047] flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#fde047] animate-pulse" />
            Flare Coston2 Testnet Contracts (Chain ID 114)
          </h3>
          <div className="glass-panel overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead className="bg-black/60 text-slate-400 uppercase tracking-widest font-mono text-[10px] border-b border-white/10">
                <tr>
                  <th className="p-4">Contract Name</th>
                  <th className="p-4">Deployed Address</th>
                  <th className="p-4">Block Explorer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {Object.entries(coston2Contracts).map(([name, address]) => (
                  <tr key={name} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 font-sans font-extrabold text-white">{name}</td>
                    <td className="p-4 text-[#fde047] font-bold">{address}</td>
                    <td className="p-4 font-sans">
                      <a
                        href={`https://coston2-explorer.flare.network/address/${address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-slate-400 hover:text-[#fde047] transition-colors"
                      >
                        Explorer <ExternalLink className="w-3.5 h-3.5 text-[#fde047]" />
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
        <h2 className="text-2xl font-black uppercase text-white flex items-center gap-3 tracking-tight">
          <Code className="w-6 h-6 text-amber-400" />
          4. SDK Multi-Chain Integration Guide
        </h2>
        <div className="glass-panel p-6 sm:p-8 space-y-4 text-xs font-mono text-slate-300">
          <p className="font-sans text-slate-400">
            Third-party developers can integrate BreezeSwap weather derivatives directly into their apps using the multi-chain TypeScript SDK:
          </p>
          <pre className="p-5 rounded-2xl bg-black/80 border border-white/10 overflow-x-auto text-[#fde047]">
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
        <h2 className="text-2xl font-black uppercase text-white flex items-center gap-3 tracking-tight">
          <ShieldCheck className="w-6 h-6 text-emerald-400" />
          5. Security & Formal Invariant Audits
        </h2>
        <div className="glass-panel p-6 sm:p-8 space-y-3 text-xs text-slate-300 leading-relaxed font-mono">
          <p>
            BreezeSwap smart contracts have undergone rigorous invariant fuzz testing (256 runs &times; 64 depth) and adversarial attack vectors:
          </p>
          <ul className="list-disc list-inside space-y-2 text-slate-400 pl-2">
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
