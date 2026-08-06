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
    // Next 16 no longer overrides scroll-behavior on navigation unless asked,
    // so data-scroll-behavior keeps route changes jumping to top instantly
    // while in-page anchors still scroll smoothly.
    <html lang="en" className="dark scroll-smooth" data-scroll-behavior="smooth">
      <body className={`${inter.className} bg-canvas text-ink antialiased min-h-screen flex flex-col selection:bg-accent selection:text-[#0a0a0a]`}>
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
