import { type WalletClient, type PublicClient, decodeEventLog } from 'viem'
import FactoryABI from '../abis/BreezeMarketFactory.json'
import { CONTRACT_ADDRESSES, COSTON2_CHAIN_ID, WEATHER_VARIABLES, PAYOFF_TYPES } from '../constants'
import type { CreateMarketParams } from '../types'

export async function createMarket(
  walletClient: WalletClient,
  publicClient: PublicClient,
  params: CreateMarketParams
): Promise<{ txHash: `0x${string}`; marketAddress: string }> {
  const [account] = await walletClient.getAddresses()
  if (!account) throw new Error('No wallet connected')

  const factoryAddress = CONTRACT_ADDRESSES[COSTON2_CHAIN_ID].factory
  const oracleAddress = params.oracleAddress || CONTRACT_ADDRESSES[COSTON2_CHAIN_ID].mockWeatherOracle

  const { request } = await publicClient.simulateContract({
    address: factoryAddress,
    abi: FactoryABI,
    functionName: 'createMarket',
    args: [
      params.regionId,
      WEATHER_VARIABLES[params.weatherVariable],
      params.thresholdLow,
      params.thresholdHigh,
      params.expiryTimestamp,
      oracleAddress,
      params.collateralToken,
      PAYOFF_TYPES[params.payoffType]
    ],
    account
  })

  const txHash = await walletClient.writeContract(request)

  // Wait for the transaction and extract the new market address from logs
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
  let marketAddress = ''

  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: FactoryABI,
        data: log.data,
        topics: log.topics
      })
      if (decoded.eventName === 'MarketCreated') {
        marketAddress = (decoded.args as any).market
        break
      }
    } catch {
      // Ignore logs from other contracts
    }
  }

  return { txHash, marketAddress }
}
