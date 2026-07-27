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

  useEffect(() => {
    async function verifyAdmin() {
      if (!isConnected || !address || !publicClient) {
        setIsAdmin(false)
        return
      }
      const addresses = getContractAddresses(chainId)
      const acAddr = addresses.accessControl
      if (acAddr && acAddr !== '0x0000000000000000000000000000000000000000') {
        const hasAdmin = await checkRole(publicClient as any, acAddr, 'ADMIN_ROLE', address)
        setIsAdmin(hasAdmin)
      } else {
        setIsAdmin(false)
      }
    }
    verifyAdmin()
  }, [address, isConnected, publicClient, chainId])

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
            <Link
              href="/markets"
              className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all"
            >
              <Compass className="w-4 h-4 text-cyan-400" />
              Classic
            </Link>
            <Link
              href="/perp-markets"
              className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all"
            >
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Perps
            </Link>
            <Link
              href="/portfolio"
              className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all"
            >
              <PieChart className="w-4 h-4 text-purple-400" />
              Portfolio
            </Link>
            <Link
              href="/create"
              className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all"
            >
              <PlusCircle className="w-4 h-4 text-emerald-400" />
              Create
            </Link>
            <Link
              href="/docs"
              className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all"
            >
              <BookOpen className="w-4 h-4 text-amber-400" />
              Docs
            </Link>

            {isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all border border-rose-500/20"
              >
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                Admin
              </Link>
            )}
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
