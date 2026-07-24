import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BreezeSwap | Weather Derivatives Protocol on Flare',
  description: 'Trade climate futures and hedge weather risk automatically settled by real oracle data on Flare Network.',
  openGraph: {
    title: 'BreezeSwap — Weather Derivatives on Flare Network',
    description: 'Hedge climate risk or trade weather outcomes — settled automatically by real oracle data.',
    url: 'https://breezeswap.xyz',
    siteName: 'BreezeSwap',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className={`${inter.className} bg-slate-950 text-slate-100 antialiased min-h-screen flex flex-col selection:bg-cyan-500 selection:text-slate-950`}>
        <Providers>
          <Navbar />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  )
}
