import Link from 'next/link'
import { CloudRain, ExternalLink, Github, Terminal } from 'lucide-react'

export function Footer() {
  return (
    <footer className="border-t border-slate-800/80 bg-slate-950 text-slate-400 text-sm py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CloudRain className="w-5 h-5 text-cyan-400" />
            <span className="text-lg font-bold text-white tracking-tight">BreezeSwap</span>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed">
            First-of-its-kind weather derivatives protocol built on Flare Network. Hedging climate risk with real-world weather oracle data.
          </p>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">Protocol</h4>
          <ul className="space-y-2 text-xs">
            <li><Link href="/markets" className="hover:text-cyan-400 transition-colors">Browse Markets</Link></li>
            <li><Link href="/portfolio" className="hover:text-cyan-400 transition-colors">User Portfolio</Link></li>
            <li><Link href="/create" className="hover:text-cyan-400 transition-colors">Create Market</Link></li>
            <li><Link href="/docs" className="hover:text-cyan-400 transition-colors">Documentation</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">Developers</h4>
          <ul className="space-y-2 text-xs">
            <li>
              <a
                href="https://github.com/manav2701/breezeSwap"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 hover:text-cyan-400 transition-colors"
              >
                <Github className="w-3.5 h-3.5" /> GitHub Monorepo <ExternalLink className="w-3 h-3" />
              </a>
            </li>
            <li>
              <a
                href="https://coston2-explorer.flare.network"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 hover:text-cyan-400 transition-colors"
              >
                <Terminal className="w-3.5 h-3.5" /> Coston2 Explorer <ExternalLink className="w-3 h-3" />
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">Powered By</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Built for the Flare Network ecosystem. Powered by Open-Meteo real weather data, FTSO, and FDC oracle infrastructure.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 mt-8 border-t border-slate-800/40 text-xs text-center text-slate-400">
        © {new Date().getFullYear()} BreezeSwap. All rights reserved. Deployed on Flare Coston2 Testnet (Chain ID 114).
      </div>
    </footer>
  )
}
