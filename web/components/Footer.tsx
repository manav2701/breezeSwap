import Link from 'next/link'
import Image from 'next/image'
import { ExternalLink, Github, Terminal } from 'lucide-react'

const PROTOCOL_LINKS = [
  { href: '/perp-markets', label: 'Perpetuals' },
  { href: '/markets', label: 'Classic markets' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/create', label: 'Create a market' },
  { href: '/about', label: 'About' },
  { href: '/docs', label: 'Documentation' },
  { href: '/whitepaper', label: 'Whitepaper' },
]

export function Footer() {
  return (
    <footer className="mt-16 border-t border-[color:var(--color-hairline)]">
      <div className="max-w-[86rem] mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
        <div className="space-y-3 lg:col-span-2 max-w-sm">
          <div className="flex items-center gap-2.5">
            <span className="relative w-8 h-8 shrink-0">
              <Image src="/logo.png" alt="" fill sizes="32px" className="object-contain" />
            </span>
            <span className="text-base font-semibold tracking-tight text-ink">
              Breeze<span className="text-accent">Swap</span>
            </span>
          </div>
          <p className="text-sm text-ink-muted leading-relaxed">
            Parametric weather derivatives on Flare. Positions settle automatically from a verified
            oracle reading — no claim, no adjuster, no counterparty to chase.
          </p>
        </div>

        <div>
          <h4 className="eyebrow mb-3">Protocol</h4>
          <ul className="space-y-2 text-sm">
            {PROTOCOL_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-ink-muted hover:text-accent transition-colors">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="eyebrow mb-3">Developers</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <a
                href="https://github.com/manav2701/breezeSwap"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-ink-muted hover:text-accent transition-colors"
              >
                <Github className="w-3.5 h-3.5" aria-hidden /> GitHub
                <ExternalLink className="w-3 h-3" aria-hidden />
              </a>
            </li>
            <li>
              <a
                href="https://coston2-explorer.flare.network"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-ink-muted hover:text-accent transition-colors"
              >
                <Terminal className="w-3.5 h-3.5" aria-hidden /> Coston2 explorer
                <ExternalLink className="w-3 h-3" aria-hidden />
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-[86rem] mx-auto px-4 sm:px-6 lg:px-8 py-5 border-t border-[color:var(--color-hairline)] flex flex-wrap items-center justify-between gap-3 text-xs text-ink-faint">
        <span>© {new Date().getFullYear()} BreezeSwap</span>
        <span>
          Deployed on Flare Coston2 testnet only. Not deployed on Flare mainnet — test funds only.
        </span>
      </div>
    </footer>
  )
}
