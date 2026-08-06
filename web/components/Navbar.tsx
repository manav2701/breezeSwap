'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ConnectKitButton } from 'connectkit'
import { CloudRain, Menu, ShieldAlert, X } from 'lucide-react'
import { useAccount } from 'wagmi'
import { checkRole, getContractAddresses } from '@breezeswap/sdk'
import { useBreezeSDK } from '../lib/hooks/useBreezeSDK'
import { useBreezeNetwork } from '../lib/hooks/useNetwork'
import { NetworkSwitcher } from './NetworkSwitcher'
import { NetworkBanner } from './NetworkBanner'

const NAV_LINKS = [
  { href: '/perp-markets', label: 'Perpetuals' },
  { href: '/markets', label: 'Markets' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/create', label: 'Create' },
  { href: '/docs', label: 'Docs' },
]

export function Navbar() {
  const pathname = usePathname()
  const { address, isConnected } = useAccount()
  const { publicClient } = useBreezeSDK()
  const { chainId, isSupported } = useBreezeNetwork()
  const [isAdmin, setIsAdmin] = useState(false)

  /*
    The mobile sheet is keyed to the route it was opened on rather than reset
    from an effect. Closing it in a `useEffect([pathname])` meant the sheet
    stayed painted over the new page for one extra frame after navigation —
    and cost a cascading render on every route change.
  */
  const [openedOn, setOpenedOn] = useState<string | null>(null)
  const mobileOpen = openedOn === pathname

  useEffect(() => {
    async function verifyAdmin() {
      if (!isConnected || !address || !publicClient || !isSupported) {
        setIsAdmin(false)
        return
      }
      const acAddr = getContractAddresses(chainId).accessControl
      if (acAddr && acAddr !== '0x0000000000000000000000000000000000000000') {
        setIsAdmin(await checkRole(publicClient as any, acAddr, 'ADMIN_ROLE', address))
      } else {
        setIsAdmin(false)
      }
    }
    verifyAdmin()
  }, [address, isConnected, publicClient, chainId, isSupported])

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <>
      <NetworkBanner />

      <header className="sticky top-0 z-50 border-b border-[color:var(--color-hairline)] bg-[color-mix(in_srgb,var(--color-canvas)_78%,transparent)] backdrop-blur-xl">
        <div className="max-w-[86rem] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group" aria-label="BreezeSwap home">
            <span className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center shadow-[0_6px_18px_-8px_rgba(253,224,71,0.9)] transition-transform group-hover:scale-105">
              <CloudRain className="w-[18px] h-[18px] text-[#0a0a0a]" aria-hidden />
            </span>
            <span className="text-[17px] font-semibold tracking-tight text-ink whitespace-nowrap">
              Breeze<span className="text-accent">Swap</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-0.5 ml-4" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? 'page' : undefined}
                className={`px-3.5 py-2 rounded-full text-[13px] font-medium transition-colors whitespace-nowrap ${
                  isActive(link.href)
                    ? 'text-ink bg-[color:var(--color-raised)]'
                    : 'text-ink-muted hover:text-ink hover:bg-[color:var(--color-surface)]'
                }`}
              >
                {link.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                aria-current={isActive('/admin') ? 'page' : undefined}
                className="ml-1 px-3.5 py-2 rounded-full text-[13px] font-medium text-short hover:bg-[color:rgba(244,63,94,0.1)] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <ShieldAlert className="w-3.5 h-3.5" aria-hidden />
                Admin
              </Link>
            )}
          </nav>

          <div className="flex-1" />

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:block">
              <NetworkSwitcher />
            </div>
            <ConnectKitButton />
            <button
              type="button"
              onClick={() => setOpenedOn(mobileOpen ? null : pathname)}
              className="lg:hidden btn btn-ghost btn-icon"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile sheet */}
        {mobileOpen && (
          <nav
            className="lg:hidden border-t border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-3 space-y-1"
            aria-label="Primary mobile"
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? 'text-ink bg-[color:var(--color-raised)]'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {link.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                className="block px-3.5 py-2.5 rounded-xl text-sm font-medium text-short"
              >
                Admin
              </Link>
            )}
            <div className="pt-2 sm:hidden">
              <NetworkSwitcher />
            </div>
          </nav>
        )}
      </header>
    </>
  )
}
