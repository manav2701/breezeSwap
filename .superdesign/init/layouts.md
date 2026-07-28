# BreezeSwap Shared Layouts

## Root Layout
- Source: `web/app/layout.tsx`
- Description: Root HTML/React shell providing Wagmi/ConnectKit provider, dark background, fonts, and Navbar.

```tsx
import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from './providers'
import { Navbar } from '../components/Navbar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BreezeSwap | Decentralized Weather Derivatives on Flare',
  description: 'Parametric weather options and vAMM perpetual markets on Flare Network',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-slate-950 text-slate-100 min-h-screen flex flex-col antialiased selection:bg-cyan-500 selection:text-slate-950`}>
        <Providers>
          <Navbar />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
```

## Navbar Component
- Source: `web/components/Navbar.tsx`
- Description: Sticky top header with brand logo, nav links (Classic, Perps, Portfolio, Create, Docs, Admin), NetworkSwitcher, and ConnectKit wallet button.

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ConnectKitButton } from 'connectkit'
import { CloudRain, Compass, PieChart, PlusCircle, BookOpen, ShieldAlert, TrendingUp } from 'lucide-react'
import { useAccount } from 'wagmi'
import { checkRole, getContractAddresses } from '@breezeswap/sdk'
import { useBreezeSDK } from '../lib/hooks/useBreezeSDK'
import { useBreezeNetwork } from '../lib/hooks/useNetwork'
import { NetworkSwitcher } from './NetworkSwitcher'
import { NetworkBanner } from './NetworkBanner'

export function Navbar() {
  const { address, isConnected } = useAccount()
  const { publicClient } = useBreezeSDK()
  const { chainId, isMainnet } = useBreezeNetwork()
  const [isAdmin, setIsAdmin] = useState(false)

  return (
    <>
      <NetworkBanner />
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-0.5 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <CloudRain className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500 bg-clip-text text-transparent tracking-tight">
                BreezeSwap
              </span>
              <span className={`text-[10px] font-semibold -mt-1 tracking-wider uppercase ${isMainnet ? 'text-emerald-400' : 'text-cyan-400'}`}>
                {isMainnet ? 'Flare Mainnet' : 'Coston2 Testnet'}
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1.5 rounded-full border border-slate-800/80">
            <Link href="/markets" className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all">
              <Compass className="w-4 h-4 text-cyan-400" /> Classic
            </Link>
            <Link href="/perp-markets" className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all">
              <TrendingUp className="w-4 h-4 text-emerald-400" /> Perps
            </Link>
            <Link href="/portfolio" className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all">
              <PieChart className="w-4 h-4 text-purple-400" /> Portfolio
            </Link>
            <Link href="/create" className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all">
              <PlusCircle className="w-4 h-4 text-emerald-400" /> Create
            </Link>
            <Link href="/docs" className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all">
              <BookOpen className="w-4 h-4 text-amber-400" /> Docs
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <NetworkSwitcher />
            <ConnectKitButton />
          </div>
        </div>
      </header>
    </>
  )
}
```
