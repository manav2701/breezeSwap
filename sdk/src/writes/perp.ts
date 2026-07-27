import { WalletClient, PublicClient } from 'viem'
import BreezePerpMarketABI from '../abis/BreezePerpMarket.json'

export async function openPerpPosition(
  walletClient: WalletClient,
  publicClient: PublicClient,
  marketAddress: `0x${string}`,
  isLong: boolean,
  collateralAmount: bigint,
  leverage: bigint
): Promise<`0x${string}`> {
  const account = walletClient.account
  if (!account) throw new Error('Wallet not connected')

  const { request } = await publicClient.simulateContract({
    address: marketAddress,
    abi: BreezePerpMarketABI,
    functionName: 'openPosition',
    args: [isLong, collateralAmount, leverage],
    account
  })

  return walletClient.writeContract(request)
}

export async function closePerpPosition(
  walletClient: WalletClient,
  publicClient: PublicClient,
  marketAddress: `0x${string}`,
  positionId: bigint
): Promise<`0x${string}`> {
  const account = walletClient.account
  if (!account) throw new Error('Wallet not connected')

  const { request } = await publicClient.simulateContract({
    address: marketAddress,
    abi: BreezePerpMarketABI,
    functionName: 'closePosition',
    args: [positionId],
    account
  })

  return walletClient.writeContract(request)
}

export async function liquidatePerpPosition(
  walletClient: WalletClient,
  publicClient: PublicClient,
  marketAddress: `0x${string}`,
  positionId: bigint
): Promise<`0x${string}`> {
  const account = walletClient.account
  if (!account) throw new Error('Wallet not connected')

  const { request } = await publicClient.simulateContract({
    address: marketAddress,
    abi: BreezePerpMarketABI,
    functionName: 'liquidate',
    args: [positionId],
    account
  })

  return walletClient.writeContract(request)
}

export async function settleFunding(
  walletClient: WalletClient,
  publicClient: PublicClient,
  marketAddress: `0x${string}`
): Promise<`0x${string}`> {
  const account = walletClient.account
  if (!account) throw new Error('Wallet not connected')

  const { request } = await publicClient.simulateContract({
    address: marketAddress,
    abi: BreezePerpMarketABI,
    functionName: 'settleFunding',
    account
  })

  return walletClient.writeContract(request)
}
