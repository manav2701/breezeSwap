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

export const publicClient = createPublicClient({
  chain: coston2,
  transport: http(process.env.COSTON2_RPC || 'https://coston2-api.flare.network/ext/C/rpc', {
    retryCount: 3,
    retryDelay: 1000
  })
})
