import { type WalletClient, type PublicClient, decodeEventLog } from 'viem'
import FactoryABI from '../abis/BreezeMarketFactory.json'
import { getContractAddresses, WEATHER_VARIABLES, PAYOFF_TYPES } from '../constants'
import type { CreateMarketParams } from '../types'

export async function createMarket(
  walletClient: WalletClient,
  publicClient: PublicClient,
  params: CreateMarketParams,
  chainId: number = 114
): Promise<{ txHash: `0x${string}`; marketAddress: string | null }> {
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

  if (receipt.status === 'reverted') {
    throw new Error(`Market creation reverted on-chain (tx ${txHash})`)
  }

  let marketAddress: string | null = null

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
      // Every receipt carries logs from other contracts (the collateral token,
      // for one) which this ABI cannot decode. Only the absence of a decodable
      // MarketCreated across all of them is a problem, and that is reported
      // after the loop.
    }
  }

  // The transaction succeeded, so a market does exist; not finding its address
  // means the factory ABI no longer matches the deployed factory. `null` says
  // that, where the previous '' was indistinguishable from an address the
  // caller could navigate to — and left the create screen showing a successful
  // transaction with no explanation of why it never went anywhere.
  if (!marketAddress) {
    console.warn(
      `Market created in ${txHash} but no MarketCreated event could be decoded from the receipt. ` +
        'The factory ABI in this SDK build may be out of date.'
    )
  }

  return { txHash, marketAddress }
}
