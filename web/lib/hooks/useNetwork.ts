'use client'

import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { COSTON2_CHAIN_ID, isChainDeployed } from '@breezeswap/sdk'

/**
 * Resolves the chain BreezeSwap should read and write against.
 *
 * BreezeSwap is deployed on Coston2 only. Rather than offering a network
 * picker, this reports whether the connected wallet is on a chain we actually
 * have contracts on, so the UI can prompt for a switch instead of rendering
 * data resolved from the wrong registry.
 */
export function useBreezeNetwork() {
  const { isConnected } = useAccount()
  const walletChainId = useChainId()
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  // Reads work without a wallet, so fall back to the one deployed chain.
  const activeChainId = isConnected && walletChainId ? walletChainId : COSTON2_CHAIN_ID

  const isSupported = isChainDeployed(activeChainId)
  const isWrongNetwork = isConnected && !isSupported

  const switchToSupported = () => {
    if (switchChain) switchChain({ chainId: COSTON2_CHAIN_ID })
  }

  return {
    /** Chain to resolve contracts from. Only valid when `isSupported`. */
    chainId: activeChainId,
    /** The single chain BreezeSwap is deployed on. */
    supportedChainId: COSTON2_CHAIN_ID,
    isSupported,
    isWrongNetwork,
    isSwitching,
    switchToSupported,
  }
}
