'use client'

import React, { useEffect, useState } from 'react'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectKitProvider, getDefaultConfig } from 'connectkit'
import { coston2Chain } from '@breezeswap/sdk'

const config = createConfig(
  getDefaultConfig({
    chains: [coston2Chain],
    transports: {
      [coston2Chain.id]: http(process.env.NEXT_PUBLIC_COSTON2_RPC || 'https://coston2-api.flare.network/ext/C/rpc')
    },
    walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '3a8170812b534d0ff9d794f19a901d64',
    appName: 'BreezeSwap',
    appDescription: 'Weather derivatives protocol on Flare Network',
    appUrl: 'https://breezeswap.xyz',
  })
)

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider
          mode="dark"
          customTheme={{
            "--ck-font-family": "Inter, sans-serif",
            "--ck-border-radius": "12px",
          }}
        >
          {mounted ? children : <div className="invisible">{children}</div>}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
