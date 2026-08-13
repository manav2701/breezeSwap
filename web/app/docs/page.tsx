'use client'

import React from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Wallet,
  Search,
  Coins,
  CheckCircle2,
  Terminal,
  BookOpen,
  ShieldCheck,
} from 'lucide-react'

/**
 * Documentation, aimed at someone deciding whether to use this.
 *
 * The previous version led with a table of deployed contract addresses and the chain id,
 * which answers a question almost no visitor is asking and buries the ones they are: what
 * am I buying, how do I buy it, and when do I get paid. Addresses belong in the whitepaper
 * and in the repository, where the people who need them are already looking.
 */

const STEPS = [
  {
    icon: Wallet,
    title: 'Connect a wallet',
    body:
      'Any EVM wallet that lets you add a network: MetaMask, Rabby or Brave. You need a small amount of test gas and some demo collateral to trade with.',
  },
  {
    icon: Search,
    title: 'Pick a market',
    body:
      'Each market names one region, one measurement and one threshold, for example Tokyo rainfall at or above 40 mm. The chart shows what that reading has actually done recently, so you can see how close to the line it sits.',
  },
  {
    icon: Coins,
    title: 'Choose a side and deposit',
    body:
      'Long is paid when the reading lands at or above the threshold, short when it lands below. Your deposit is your maximum loss. You receive a token representing the position, which you can transfer or sell before expiry.',
  },
  {
    icon: CheckCircle2,
    title: 'Get paid automatically',
    body:
      'At expiry the contract reads the measurement and computes both payouts itself. Anyone can trigger settlement, including you. There is no claim to file and nobody who can refuse it.',
  },
]

const PAYOFF_TYPES = [
  {
    name: 'Binary',
    body: 'All or nothing. If the reading lands at or above the strike, longs take the whole pot. Otherwise shorts do.',
    when: 'Use when the question is genuinely yes or no: did the month stay under 40 mm.',
  },
  {
    name: 'Capped',
    body: 'A bounded ramp. Nothing below the strike, everything above the cap, and a straight line between them.',
    when: 'Use when severity matters but you want a known worst case on both sides.',
  },
  {
    name: 'Linear',
    body: 'Payout scales with how far past the strike the reading lands, with no ceiling.',
    when: 'Use when the loss you are hedging keeps growing with the weather.',
  },
]

const FAQ = [
  [
    'What happens if the weather station stops reporting?',
    'Settlement needs a recent reading, so a market cannot be settled against stale data. If a region goes quiet for long enough, cover can be voided and the premium returned rather than resolved on a guess.',
  ],
  [
    'Can the market creator change the rules after I deposit?',
    'No. The region, the threshold, the payout shape and the expiry are fixed when the market is created and cannot be edited afterwards.',
  ],
  [
    'What if nobody takes the other side?',
    'Classic markets need a counterparty, and until one arrives your deposit simply sits there. Perpetual markets do not: a pool of capital quotes both sides continuously, so you can open a position on your own.',
  ],
  [
    'Am I covered for my actual loss?',
    'No, and this is the real trade-off. You are paid on the measurement, not on your damage. If the drought arrives and your crop survives you still get paid, and if your crop fails for some other reason you do not. That is the price of settling in days without an assessor.',
  ],
  [
    'Is this real money?',
    'Not yet. BreezeSwap runs on a test network with demo collateral and has not been audited.',
  ],
]

function Code({ children }: { children: string }) {
  return (
    <pre className="inset p-4 overflow-x-auto text-[12.5px] leading-relaxed">
      <code className="numeric text-ink-muted whitespace-pre">{children}</code>
    </pre>
  )
}

export default function DocsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-16 pb-12">
      <header className="pb-6 border-b border-[color:var(--color-hairline)]">
        <p className="eyebrow mb-2">Documentation</p>
        <h1 className="display-2 text-ink">Using BreezeSwap</h1>
        <p className="lede mt-3 max-w-2xl">
          How to take a position, what each payout shape means, and how to build on top of it.
          If you want the reasoning behind the design, that lives in the{' '}
          <Link href="/whitepaper" className="text-accent hover:underline">
            whitepaper
          </Link>
          .
        </p>
      </header>

      {/* Getting started */}
      <section className="space-y-5">
        <h2 className="display-3 text-ink">Taking your first position</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="panel p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg inset flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-accent" aria-hidden />
                </span>
                <span className="metric-label">Step {i + 1}</span>
              </div>
              <h3 className="display-3 text-ink">{title}</h3>
              <p className="text-sm text-ink-muted leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/markets" className="btn btn-primary">
            Browse markets
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
          <Link href="/create" className="btn btn-ghost">
            Create your own
          </Link>
        </div>
      </section>

      {/* Payout shapes */}
      <section className="space-y-5">
        <h2 className="display-3 text-ink">Payout shapes</h2>
        <p className="text-sm text-ink-muted max-w-2xl leading-relaxed">
          Every market pays out on the same measurement. What differs is how the payout
          responds once the threshold is crossed.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PAYOFF_TYPES.map((p) => (
            <div key={p.name} className="panel p-5 space-y-3">
              <h3 className="display-3 text-ink">{p.name}</h3>
              <p className="text-sm text-ink-muted leading-relaxed">{p.body}</p>
              <p className="text-[13px] text-ink-faint leading-relaxed pt-2 border-t border-[color:var(--color-hairline)]">
                {p.when}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* SDK */}
      <section className="space-y-5">
        <div className="flex items-center gap-2.5">
          <Terminal className="w-4 h-4 text-accent" aria-hidden />
          <h2 className="display-3 text-ink">Build on it</h2>
        </div>

        <div className="panel p-6 space-y-4">
          <p className="text-sm text-ink-muted leading-relaxed">
            The TypeScript SDK is the same one this site runs on, so anything you see here you
            can do from your own code. It is worth using rather than calling the contracts
            directly for three reasons: it handles the unit conversions that weather data is
            full of, it points at the right addresses for the network you are on, and reads
            come from an index rather than from the chain, so listing markets is one request
            instead of many.
          </p>
        </div>

        <div className="space-y-3">
          <p className="metric-label">Install</p>
          <Code>{`npm install @breezeswap/sdk viem`}</Code>
        </div>

        <div className="space-y-3">
          <p className="metric-label">Read markets</p>
          <Code>{`import { getMarkets, formatOracleValue } from '@breezeswap/sdk'

const INDEXER = 'https://breezeswap.onrender.com'

const markets = await getMarkets(INDEXER)

for (const m of markets) {
  console.log(m.regionName, m.weatherVariable, formatOracleValue(m.thresholdLow))
}`}</Code>
        </div>

        <div className="space-y-3">
          <p className="metric-label">Open a position</p>
          <Code>{`import { approveCollateral, mintPosition, toTokenUnits } from '@breezeswap/sdk'

// walletClient and publicClient come from wagmi, or from viem directly.
const amount = toTokenUnits(100, 18)

await approveCollateral(
  walletClient,
  publicClient,
  market.collateralToken,
  market.contractAddress,
  amount
)

await mintPosition(walletClient, publicClient, {
  marketAddress: market.contractAddress,
  side: 'LONG',
  collateralAmount: amount,
})`}</Code>
          <p className="text-[13px] text-ink-faint leading-relaxed">
            Two steps because the collateral is an ERC-20: you approve the market to move your
            tokens, then it moves them. Amounts are in the token&rsquo;s smallest unit, which is
            what <span className="text-ink-muted">toTokenUnits</span> is for.
          </p>
        </div>

        <div className="space-y-3">
          <p className="metric-label">Settle and redeem</p>
          <Code>{`import { settle, redeem } from '@breezeswap/sdk'

// Permissionless. Anyone can call this once the market has expired.
await settle(walletClient, publicClient, marketAddress)

await redeem(walletClient, publicClient, marketAddress, tokenId, amount)`}</Code>
        </div>

        <div className="panel p-5 flex items-start gap-3">
          <BookOpen className="w-4 h-4 text-accent shrink-0 mt-0.5" aria-hidden />
          <p className="text-sm text-ink-muted leading-relaxed">
            Contract addresses ship with the SDK, so you should not need to paste them anywhere.
            If you do need them directly, they are in{' '}
            <span className="text-ink">getContractAddresses(chainId)</span> and in the whitepaper.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="space-y-5">
        <h2 className="display-3 text-ink">Questions people actually ask</h2>
        <div className="space-y-3">
          {FAQ.map(([q, a]) => (
            <div key={q} className="panel p-5 space-y-2">
              <h3 className="text-sm font-medium text-ink">{q}</h3>
              <p className="text-sm text-ink-muted leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Safety */}
      <section className="space-y-5">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-accent" aria-hidden />
          <h2 className="display-3 text-ink">Before you rely on this</h2>
        </div>
        <div className="panel p-6 space-y-3 text-sm text-ink-muted leading-relaxed">
          <p>
            BreezeSwap runs on a test network with demo collateral and has not had a
            professional security audit. Treat it as a working prototype.
          </p>
          <p>
            The parts we are confident about are public and checkable: the payout rules are
            fixed when a market is created, settlement is open to anyone, and the contracts are
            covered by an extensive test suite including adversarial and economic-game
            scenarios. The parts we are not confident about are written down in the whitepaper
            rather than left for you to discover.
          </p>
        </div>
      </section>
    </div>
  )
}
