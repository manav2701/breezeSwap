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
      <header className="sticky top-0 z-50 backdrop-blur-2xl bg-[#0a0a0a]/90 border-b border-white/10 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          
          {/* Brand Logo - Fixed No Wrap */}
          <Link href="/" className="flex items-center gap-3 group shrink-0 whitespace-nowrap">
            <div className="w-10 h-10 rounded-2xl bg-[#fde047] p-0.5 flex items-center justify-center shadow-lg shadow-yellow-500/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-[#0a0a0a] rounded-[14px] flex items-center justify-center">
                <CloudRain className="w-5 h-5 text-[#fde047]" />
              </div>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-xl font-black tracking-tight text-white group-hover:text-[#fde047] transition-colors">
                Breeze<span className="text-[#fde047]">Swap</span>
              </span>
              <span className={`text-[9px] font-mono font-bold tracking-widest uppercase mt-0.5 ${isMainnet ? 'text-emerald-400' : 'text-[#fde047]'}`}>
                {isMainnet ? 'Flare Mainnet' : 'Coston2 Testnet'}
              </span>
            </div>
          </Link>

          {/* Nav Links */}
          <nav className="hidden lg:flex items-center gap-1 bg-[#141414] p-1.5 rounded-full border border-white/10 shadow-inner">
            <Link
              href="/markets"
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-slate-300 hover:text-[#0a0a0a] hover:bg-[#fde047] transition-all uppercase tracking-wider whitespace-nowrap"
            >
              <Compass className="w-3.5 h-3.5" />
              Classic
            </Link>
            <Link
              href="/perp-markets"
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-slate-300 hover:text-[#0a0a0a] hover:bg-[#fde047] transition-all uppercase tracking-wider whitespace-nowrap"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              Perps
            </Link>
            <Link
              href="/portfolio"
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-slate-300 hover:text-[#0a0a0a] hover:bg-[#fde047] transition-all uppercase tracking-wider whitespace-nowrap"
            >
              <PieChart className="w-3.5 h-3.5 text-purple-400" />
              Portfolio
            </Link>
            <Link
              href="/create"
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-slate-300 hover:text-[#0a0a0a] hover:bg-[#fde047] transition-all uppercase tracking-wider whitespace-nowrap"
            >
              <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
              Create
            </Link>
            <Link
              href="/docs"
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-slate-300 hover:text-[#0a0a0a] hover:bg-[#fde047] transition-all uppercase tracking-wider whitespace-nowrap"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              Docs
            </Link>

            {isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black text-rose-400 hover:text-black hover:bg-rose-400 transition-all uppercase tracking-wider border border-rose-500/30 whitespace-nowrap"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                Admin
              </Link>
            )}
          </nav>

          {/* Right Actions: Network Switcher + Wallet Connect */}
          <div className="flex items-center gap-2 shrink-0">
            <NetworkSwitcher />
            <ConnectKitButton />
          </div>

        </div>
      </header>
    </>
  )
}
