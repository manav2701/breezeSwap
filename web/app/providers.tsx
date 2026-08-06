'use client'

import React, { useEffect, useState } from 'react'
import { WagmiProvider, createConfig, http, type Config } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectKitProvider, getDefaultConfig } from 'connectkit'
import { coston2Chain } from '@breezeswap/sdk'

/*
  WalletConnect's core opens an IndexedDB keyvalue store the moment its client
  is constructed. Building the wagmi config at module scope therefore ran that
  constructor during server rendering and threw `ReferenceError: indexedDB is
  not defined` on every request. Constructing it lazily, and only once the
  component has mounted in the browser, keeps that entirely client-side.
*/
let cachedConfig: Config | null = null

function getWagmiConfig(): Config {
  if (cachedConfig) return cachedConfig
  cachedConfig = createConfig(
    getDefaultConfig({
      chains: [coston2Chain],
      transports: {
        [coston2Chain.id]: http(
          process.env.NEXT_PUBLIC_COSTON2_RPC || 'https://coston2-api.flare.network/ext/C/rpc'
        ),
      },
      walletConnectProjectId:
        process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '3a8170812b534d0ff9d794f19a901d64',
      appName: 'BreezeSwap',
      appDescription: 'Weather derivatives protocol on Flare Network',
      appUrl: 'https://breezeswap.xyz',
      ssr: true,
    })
  )
  return cachedConfig
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

/**
 * Shown for the single frame between first paint and hydration. Matching the
 * real layout's rhythm means the page does not visibly jump when the app
 * takes over.
 */
function BootShell() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6" aria-busy="true">
      <div className="flex flex-col items-center gap-4">
        <div className="w-9 h-9 rounded-full border-2 border-[color:var(--color-hairline-strong)] border-t-accent animate-spin" />
        <p className="text-xs text-ink-faint numeric">Loading BreezeSwap…</p>
      </div>
    </div>
  )
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<Config | null>(null)

  useEffect(() => {
    setConfig(getWagmiConfig())
  }, [])

  if (!config) return <BootShell />

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider
          mode="dark"
          customTheme={{
            '--ck-font-family': 'var(--font-sans), Inter, sans-serif',
            '--ck-border-radius': '14px',
            '--ck-body-background': '#101319',
            '--ck-body-color': '#f4f6f9',
            '--ck-body-color-muted': '#a2abb9',
            '--ck-primary-button-background': '#171b23',
            '--ck-primary-button-color': '#f4f6f9',
            '--ck-secondary-button-background': '#1f242e',
            '--ck-overlay-background': 'rgba(10, 11, 14, 0.72)',
            '--ck-focus-color': '#fde047',
          }}
        >
          {children}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
