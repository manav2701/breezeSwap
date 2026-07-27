import { createPublicClient, http, defineChain } from 'viem'
import dotenv from 'dotenv'

dotenv.config()

export const coston2 = defineChain({
  id: 114,
  name: 'Coston2',
  nativeCurrency: { name: 'Coston2 FLR', symbol: 'C2FLR', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.COSTON2_RPC || 'https://coston2-api.flare.network/ext/C/rpc'] },
    public: { http: ['https://coston2-api.flare.network/ext/C/rpc'] }
  },
  blockExplorers: {
    default: { name: 'Coston2 Explorer', url: 'https://coston2-explorer.flare.network' }
  }
})

export const flareMainnet = defineChain({
  id: 14,
  name: 'Flare Mainnet',
  nativeCurrency: { name: 'Flare', symbol: 'FLR', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.FLARE_MAINNET_RPC || 'https://flare-api.flare.network/ext/C/rpc'] },
    public: { http: ['https://flare-api.flare.network/ext/C/rpc'] }
  },
  blockExplorers: {
    default: { name: 'Flare Explorer', url: 'https://flare-explorer.flare.network' }
  }
})

export function getPublicClient(chainId: number = 114) {
  const chain = chainId === 14 ? flareMainnet : coston2
  const defaultRpc = chainId === 14
    ? (process.env.FLARE_MAINNET_RPC || 'https://flare-api.flare.network/ext/C/rpc')
    : (process.env.COSTON2_RPC || 'https://coston2-api.flare.network/ext/C/rpc')

  return createPublicClient({
    chain,
    transport: http(defaultRpc, {
      retryCount: 3,
      retryDelay: 1000
    })
  })
}

export const publicClient = getPublicClient(114)
