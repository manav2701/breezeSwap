'use client'

import { useWalletClient, usePublicClient, useAccount, useSwitchChain } from 'wagmi'
import { coston2Chain } from '@breezeswap/sdk'

/**
 * Where the app reads indexed data from.
 *
 * `NEXT_PUBLIC_*` variables are inlined at build time, so a Vercel deployment
 * missing this one silently falls back to the default for the life of the
 * build. The previous default pointed at a retired Render host: every request
 * failed, every panel dropped to sample data, and nothing said why. The
 * fallback is now localhost — obviously wrong in production, and paired with a
 * console warning naming the variable to set.
 */
const LOCAL_INDEXER = 'http://localhost:3001'

let warned = false

function resolveIndexerUrl(): string {
  const configured = process.env.NEXT_PUBLIC_INDEXER_URL
  if (configured) return configured.replace(/\/+$/, '')

  if (typeof window !== 'undefined' && !warned && window.location.hostname !== 'localhost') {
    warned = true
    console.warn(
      '[BreezeSwap] NEXT_PUBLIC_INDEXER_URL is not set for this build. ' +
        'Set it to your Railway indexer URL in the Vercel project settings and redeploy; ' +
        `falling back to ${LOCAL_INDEXER}, which will not resolve from a browser.`
    )
  }

  return LOCAL_INDEXER
}

export function useBreezeSDK() {
  const { data: walletClient, isLoading: isWalletLoading } = useWalletClient()
  const publicClient = usePublicClient()
  const { address, isConnected, chainId } = useAccount()
  const { switchChain } = useSwitchChain()

  const indexerUrl = resolveIndexerUrl()
  const isWrongNetwork = isConnected && chainId !== coston2Chain.id

  return {
    indexerUrl,
    publicClient,
    walletClient,
    address,
    isConnected,
    isWalletLoading,
    chainId,
    isWrongNetwork,
    switchNetwork: () => switchChain?.({ chainId: coston2Chain.id }),
  }
}
