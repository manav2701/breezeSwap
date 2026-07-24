'use client'

import { useWalletClient, usePublicClient, useAccount, useSwitchChain } from 'wagmi'
import { coston2Chain } from '@breezeswap/sdk'

export function useBreezeSDK() {
  const { data: walletClient, isLoading: isWalletLoading } = useWalletClient()
  const publicClient = usePublicClient()
  const { address, isConnected, chainId } = useAccount()
  const { switchChain } = useSwitchChain()

  const indexerUrl = process.env.NEXT_PUBLIC_INDEXER_URL || 'https://breezeswap.onrender.com'
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
    switchNetwork: () => switchChain?.({ chainId: coston2Chain.id })
  }
}
