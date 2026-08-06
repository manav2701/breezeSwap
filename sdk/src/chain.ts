import { createPublicClient, createWalletClient, http, defineChain, custom } from 'viem'

export const coston2Chain = defineChain({
  id: 114,
  name: 'Flare Coston2',
  nativeCurrency: { name: 'Coston2 FLR', symbol: 'C2FLR', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://coston2-api.flare.network/ext/C/rpc'] },
    public: { http: ['https://coston2-api.flare.network/ext/C/rpc'] }
  },
  blockExplorers: {
    default: { name: 'Coston2 Explorer', url: 'https://coston2-explorer.flare.network' }
  }
})

/**
 * Flare Mainnet chain definition.
 *
 * Defined and exported so the stack stays genuinely chain-parametrised, but
 * deliberately NOT part of `SUPPORTED_CHAINS`: BreezeSwap has no mainnet
 * deployment, so offering it in a network switcher would point users at
 * addresses that hold no code. Add it to `SUPPORTED_CHAINS` and add a
 * registry entry in `constants.ts` once a real deployment exists.
 */
export const flareMainnetChain = defineChain({
  id: 14,
  name: 'Flare Mainnet',
  nativeCurrency: { name: 'Flare', symbol: 'FLR', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://flare-api.flare.network/ext/C/rpc'] },
    public: { http: ['https://flare-api.flare.network/ext/C/rpc'] }
  },
  blockExplorers: {
    default: { name: 'Flare Explorer', url: 'https://flare-explorer.flare.network' }
  }
})

/** Chains BreezeSwap is actually deployed on and can be used against. */
export const SUPPORTED_CHAINS = [coston2Chain] as const

export function createBreezePublicClient(chainId: number = 114, rpcUrl?: string) {
  const chain = chainId === 14 ? flareMainnetChain : coston2Chain
  const defaultRpc = chainId === 14 ? 'https://flare-api.flare.network/ext/C/rpc' : 'https://coston2-api.flare.network/ext/C/rpc'
  return createPublicClient({
    chain,
    transport: http(rpcUrl ?? defaultRpc)
  })
}

export function createBreezeWalletClient(provider: any, chainId: number = 114) {
  const chain = chainId === 14 ? flareMainnetChain : coston2Chain
  return createWalletClient({
    chain,
    transport: custom(provider)
  })
}
