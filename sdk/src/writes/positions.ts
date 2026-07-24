import { type WalletClient, type PublicClient } from 'viem'
import MarketABI from '../abis/BreezeMarket.json'
import ERC20ABI from '../abis/ERC20.json'
import { SIDES } from '../constants'
import type { MintPositionParams } from '../types'

export async function approveCollateral(
  walletClient: WalletClient,
  publicClient: PublicClient,
  tokenAddress: `0x${string}`,
  spenderAddress: `0x${string}`,
  amount: bigint
): Promise<`0x${string}` | null> {
  const [account] = await walletClient.getAddresses()
  if (!account) throw new Error('No wallet connected')

  // Check existing allowance
  try {
    const allowance = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20ABI,
      functionName: 'allowance',
      args: [account, spenderAddress]
    }) as bigint

    if (allowance >= amount) {
      console.log('Collateral allowance already sufficient for spender:', spenderAddress)
      return null
    }
  } catch {
    // If allowance check fails, proceed with approve
  }

  const { request } = await publicClient.simulateContract({
    address: tokenAddress,
    abi: ERC20ABI,
    functionName: 'approve',
    args: [spenderAddress, amount],
    account
  })
  return walletClient.writeContract(request)
}

export async function mintPosition(
  walletClient: WalletClient,
  publicClient: PublicClient,
  params: MintPositionParams
): Promise<`0x${string}`> {
  const [account] = await walletClient.getAddresses()
  if (!account) throw new Error('No wallet connected')

  const { request } = await publicClient.simulateContract({
    address: params.marketAddress,
    abi: MarketABI,
    functionName: 'mintPosition',
    args: [SIDES[params.side], params.collateralAmount],
    account
  })

  return walletClient.writeContract(request)
}

export async function redeem(
  walletClient: WalletClient,
  publicClient: PublicClient,
  marketAddress: `0x${string}`,
  tokenId: bigint,
  amount: bigint
): Promise<`0x${string}`> {
  const [account] = await walletClient.getAddresses()
  if (!account) throw new Error('No wallet connected')

  const { request } = await publicClient.simulateContract({
    address: marketAddress,
    abi: MarketABI,
    functionName: 'redeem',
    args: [tokenId, amount],
    account
  })

  return walletClient.writeContract(request)
}

export async function settle(
  walletClient: WalletClient,
  publicClient: PublicClient,
  marketAddress: `0x${string}`
): Promise<`0x${string}`> {
  const [account] = await walletClient.getAddresses()
  if (!account) throw new Error('No wallet connected')

  const { request } = await publicClient.simulateContract({
    address: marketAddress,
    abi: MarketABI,
    functionName: 'settle',
    args: [],
    account
  })

  return walletClient.writeContract(request)
}
