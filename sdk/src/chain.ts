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

export function createBreezePublicClient(rpcUrl?: string) {
  return createPublicClient({
    chain: coston2Chain,
    transport: http(rpcUrl ?? 'https://coston2-api.flare.network/ext/C/rpc')
  })
}

// Wallet client — takes a window.ethereum provider (browser wallet)
// Call this only client-side in Next.js (no SSR)
export function createBreezeWalletClient(provider: any) {
  return createWalletClient({
    chain: coston2Chain,
    transport: custom(provider)
  })
}
