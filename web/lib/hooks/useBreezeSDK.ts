'use client'

import { useWalletClient, usePublicClient } from 'wagmi'

export function useBreezeSDK() {
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  const indexerUrl = process.env.NEXT_PUBLIC_INDEXER_URL || 'http://localhost:3001'

  return {
    indexerUrl,
    publicClient,
    walletClient,
    isConnected: !!walletClient,
  }
}
