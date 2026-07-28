import Link from 'next/link'
import { CloudRain, ExternalLink, Github, Terminal } from 'lucide-react'

export function Footer() {
  return (
    <footer className="border-t border-[#0a0a0a]/10 bg-[#141414] text-slate-300 text-sm py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#fde047] flex items-center justify-center">
              <CloudRain className="w-5 h-5 text-[#0a0a0a]" />
            </div>
            <span className="text-xl font-black text-white tracking-tight">
              Breeze<span className="text-[#fde047]">Swap</span>
            </span>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed font-mono">
            First-of-its-kind weather derivatives protocol built on Flare Network. Hedging climate risk with real-world weather oracle data.
          </p>
        </div>

        <div>
          <h4 className="text-xs font-black text-white uppercase tracking-wider mb-3 font-mono">Protocol</h4>
          <ul className="space-y-2 text-xs font-mono">
            <li><Link href="/markets" className="hover:text-[#fde047] transition-colors">Browse Markets</Link></li>
            <li><Link href="/portfolio" className="hover:text-[#fde047] transition-colors">User Portfolio</Link></li>
            <li><Link href="/create" className="hover:text-[#fde047] transition-colors">Create Market</Link></li>
            <li><Link href="/docs" className="hover:text-[#fde047] transition-colors">Documentation</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-black text-white uppercase tracking-wider mb-3 font-mono">Developers</h4>
          <ul className="space-y-2 text-xs font-mono">
            <li>
              <a
                href="https://github.com/manav2701/breezeSwap"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 hover:text-[#fde047] transition-colors"
              >
                <Github className="w-3.5 h-3.5" /> GitHub Monorepo <ExternalLink className="w-3 h-3" />
              </a>
            </li>
            <li>
              <a
                href="https://coston2-explorer.flare.network"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 hover:text-[#fde047] transition-colors"
              >
                <Terminal className="w-3.5 h-3.5" /> Coston2 Explorer <ExternalLink className="w-3 h-3" />
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-black text-white uppercase tracking-wider mb-3 font-mono">Powered By</h4>
          <p className="text-xs text-slate-400 leading-relaxed font-mono">
            Built for the Flare Network ecosystem. Powered by Open-Meteo real weather data, FTSO, and FDC oracle infrastructure.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 mt-8 border-t border-white/10 text-xs text-center text-slate-400 font-mono">
        © {new Date().getFullYear()} BreezeSwap. All rights reserved. Deployed on Flare Coston2 Testnet & Flare Mainnet.
      </div>
    </footer>
  )
}
