import { type WalletClient, type PublicClient, decodeEventLog } from 'viem'
import FactoryABI from '../abis/BreezeMarketFactory.json'
import { getContractAddresses, WEATHER_VARIABLES, PAYOFF_TYPES } from '../constants'
import type { CreateMarketParams } from '../types'

export async function createMarket(
  walletClient: WalletClient,
  publicClient: PublicClient,
  params: CreateMarketParams,
  chainId: number = 114
): Promise<{ txHash: `0x${string}`; marketAddress: string }> {
  const [account] = await walletClient.getAddresses()
  if (!account) throw new Error('No wallet connected')

  const addresses = getContractAddresses(chainId)
  const factoryAddress = addresses.factory
  const oracleAddress = params.oracleAddress || addresses.mockWeatherOracle

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
      // Ignore non-matching logs
    }
  }

  return { txHash, marketAddress }
}
