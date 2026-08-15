import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { WelcomeGift } from '../components/WelcomeGift'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

// Numbers are the content on a trading UI. A real monospace with tabular
// figures stops price columns from jittering as values tick.
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'BreezeSwap | Weather Derivatives Protocol on Flare',
  description:
    'Trade climate futures and hedge weather risk automatically settled by real oracle data on Flare Network.',
  openGraph: {
    title: 'BreezeSwap — Weather Derivatives on Flare Network',
    description:
      'Hedge climate risk or trade weather outcomes — settled automatically by real oracle data.',
    url: 'https://breeze-swap-web-74qh-coral.vercel.app',
    siteName: 'BreezeSwap',
    type: 'website',
    images: [{ url: '/logo.png', width: 512, height: 512, alt: 'BreezeSwap' }],
  },
  twitter: {
    card: 'summary',
    title: 'BreezeSwap — Weather Derivatives on Flare Network',
    description:
      'Hedge climate risk or trade weather outcomes, settled automatically by real oracle data.',
    images: ['/logo.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Next 16 no longer overrides scroll-behavior on navigation unless asked,
    // so data-scroll-behavior keeps route changes jumping to top instantly
    // while in-page anchors still scroll smoothly.
    <html
      lang="en"
      className={`dark scroll-smooth ${inter.variable} ${jetbrainsMono.variable}`}
      data-scroll-behavior="smooth"
    >
      <body className="bg-canvas text-ink antialiased min-h-screen flex flex-col selection:bg-accent selection:text-[#0a0a0a]">
        {/* Fixed, pointer-events:none, z-index:-1 — decorative only, never
            participates in layout or intercepts clicks. */}
        <div className="ambient-mesh" aria-hidden />
        <div className="ambient-grain" aria-hidden />

        <Providers>
          <Navbar />
          <main className="flex-1 w-full max-w-[86rem] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
            {children}
          </main>
          <Footer />
          {/* Inside Providers because it reads the connected account, and at the root so a
              first-time wallet is funded wherever it happens to connect rather than only
              on the pages that thought to ask. */}
          <WelcomeGift />
        </Providers>
      </body>
    </html>
  )
}
