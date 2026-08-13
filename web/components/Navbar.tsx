'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { ConnectKitButton } from 'connectkit'
import { ChevronDown, Menu, ShieldAlert, X } from 'lucide-react'
import { useAccount } from 'wagmi'
import { checkRole, getContractAddresses } from '@breezeswap/sdk'
import { useBreezeSDK } from '../lib/hooks/useBreezeSDK'
import { useBreezeNetwork } from '../lib/hooks/useNetwork'
import { NetworkSwitcher } from './NetworkSwitcher'
import { NetworkBanner } from './NetworkBanner'

type NavItem = { href: string; label: string; hint: string }
type NavGroup = { label: string; items: NavItem[] }

/**
 * Seven flat links had outgrown the bar, and the ordering implied no relationship between
 * them: Create sat beside Docs as though they were the same kind of thing. Grouped into
 * what you came to do, what you already hold, and what you want to read.
 *
 * Portfolio stays a direct link on purpose. It is the one destination people return to
 * repeatedly and it has no siblings, so burying it behind a menu would add a click to the
 * most frequent journey.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Trade',
    items: [
      { href: '/perp-markets', label: 'Perpetuals', hint: 'Both directions, no expiry' },
      { href: '/markets', label: 'Markets', hint: 'Fixed-expiry weather contracts' },
      { href: '/create', label: 'Create a market', hint: 'Pick a region, strike and payout' },
    ],
  },
  {
    label: 'Learn',
    items: [
      { href: '/about', label: 'About', hint: 'The problem, in plain language' },
      { href: '/docs', label: 'Docs', hint: 'Using the protocol and the SDK' },
      { href: '/whitepaper', label: 'Whitepaper', hint: 'Economics and capital model' },
    ],
  },
]

const DIRECT_LINKS: NavItem[] = [
  { href: '/portfolio', label: 'Portfolio', hint: 'Your open positions' },
]

/**
 * A dropdown that does not fight the pointer.
 *
 * Opens on hover, but closes on a short delay rather than immediately, because the gap
 * between a trigger and its panel is dead space and a strict `mouseleave` makes the menu
 * vanish while you are travelling toward it. Click still toggles, so it works without a
 * pointer, and Escape and outside-clicks both dismiss.
 */
function NavDropdown({
  group,
  isActive,
}: {
  group: NavGroup
  isActive: (href: string) => boolean
}) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const groupActive = group.items.some((i) => isActive(i.href))

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = null
  }
  const scheduleClose = () => {
    cancelClose()
    closeTimer.current = setTimeout(() => setOpen(false), 140)
  }

  useEffect(() => () => cancelClose(), [])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={() => {
        cancelClose()
        setOpen(true)
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`px-3.5 py-2 rounded-full text-[13px] font-medium transition-colors whitespace-nowrap inline-flex items-center gap-1.5 ${
          groupActive || open
            ? 'text-ink bg-[color:var(--color-raised)]'
            : 'text-ink-muted hover:text-ink hover:bg-[color:var(--color-surface)]'
        }`}
      >
        {group.label}
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={group.label}
          /* Pulled up under the trigger so the pointer never crosses a gap. */
          className="absolute left-0 top-full pt-2 w-[16.5rem] z-50"
        >
          <div className="panel panel-solid p-1.5 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.75)]">
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                aria-current={isActive(item.href) ? 'page' : undefined}
                /* Hover is `raised`, not `surface`: the panel base is now surface, so a
                   surface hover would be the same colour as the thing behind it. Active
                   shares the background and is distinguished by the accent label. */
                className={`block px-3 py-2.5 rounded-lg transition-colors ${
                  isActive(item.href)
                    ? 'bg-[color:var(--color-raised)]'
                    : 'hover:bg-[color:var(--color-raised)]'
                }`}
              >
                <span
                  className={`block text-[13px] font-medium ${
                    isActive(item.href) ? 'text-accent' : 'text-ink'
                  }`}
                >
                  {item.label}
                </span>
                <span className="block text-[11.5px] text-ink-faint mt-0.5 leading-snug">
                  {item.hint}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

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
          <Link
            href="/"
            className="flex items-center gap-2.5 shrink-0 group"
            aria-label="BreezeSwap home"
          >
            <span className="relative w-9 h-9 shrink-0 transition-transform group-hover:scale-105">
              <Image
                src="/logo.png"
                alt=""
                fill
                sizes="36px"
                priority
                className="object-contain"
              />
            </span>
            <span className="text-[17px] font-semibold tracking-tight text-ink whitespace-nowrap">
              Breeze<span className="text-accent">Swap</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-0.5 ml-4" aria-label="Primary">
            {NAV_GROUPS.map((group) => (
              <NavDropdown key={group.label} group={group} isActive={isActive} />
            ))}
            {DIRECT_LINKS.map((link) => (
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

        {/* Mobile sheet. Same grouping, flattened into labelled sections: a phone has the
            vertical room, and nested disclosure on touch costs a tap for no gain. */}
        {mobileOpen && (
          <nav
            className="lg:hidden border-t border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-3 space-y-4 max-h-[calc(100vh-4rem)] overflow-y-auto"
            aria-label="Primary mobile"
          >
            {DIRECT_LINKS.map((link) => (
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

            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="space-y-1">
                <p className="metric-label px-3.5">{group.label}</p>
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block px-3.5 py-2.5 rounded-xl transition-colors ${
                      isActive(item.href)
                        ? 'bg-[color:var(--color-raised)]'
                        : 'hover:bg-[color:var(--color-raised)]'
                    }`}
                  >
                    <span
                      className={`block text-sm font-medium ${
                        isActive(item.href) ? 'text-accent' : 'text-ink'
                      }`}
                    >
                      {item.label}
                    </span>
                    <span className="block text-[11.5px] text-ink-faint mt-0.5">{item.hint}</span>
                  </Link>
                ))}
              </div>
            ))}

            {isAdmin && (
              <Link
                href="/admin"
                className="block px-3.5 py-2.5 rounded-xl text-sm font-medium text-short"
              >
                Admin
              </Link>
            )}
            <div className="pt-1 sm:hidden">
              <NetworkSwitcher />
            </div>
          </nav>
        )}
      </header>
    </>
  )
}
