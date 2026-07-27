'use client'

import { useState } from 'react'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { COSTON2_CHAIN_ID, FLARE_MAINNET_CHAIN_ID, coston2Chain, flareMainnetChain } from '@breezeswap/sdk'

export function useBreezeNetwork() {
  const { isConnected } = useAccount()
  const walletChainId = useChainId()
  const { switchChain } = useSwitchChain()

  const [selectedChainId, setSelectedChainId] = useState<number>(COSTON2_CHAIN_ID)

  // Source of truth: connected wallet chain if connected, else selectedChainId
  const activeChainId = isConnected && walletChainId ? walletChainId : selectedChainId

  const isMainnet = activeChainId === FLARE_MAINNET_CHAIN_ID
  const isTestnet = activeChainId === COSTON2_CHAIN_ID

  const switchToTestnet = () => {
    setSelectedChainId(COSTON2_CHAIN_ID)
    if (isConnected && switchChain) {
      switchChain({ chainId: COSTON2_CHAIN_ID })
    }
  }

  const switchToMainnet = () => {
    setSelectedChainId(FLARE_MAINNET_CHAIN_ID)
    if (isConnected && switchChain) {
      switchChain({ chainId: FLARE_MAINNET_CHAIN_ID })
    }
  }

  const setNetwork = (chainId: number) => {
    if (chainId === FLARE_MAINNET_CHAIN_ID) switchToMainnet()
    else switchToTestnet()
  }

  return {
    chainId: activeChainId,
    isMainnet,
    isTestnet,
    switchToTestnet,
    switchToMainnet,
    setNetwork
  }
}
