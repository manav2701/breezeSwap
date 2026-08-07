import { type WalletClient, type PublicClient } from 'viem'
import MarketABI from '../abis/BreezeMarket.json'
import { SIDES } from '../constants'
import type { MintPositionParams } from '../types'
import { requireAccountAddress, sendTx, ensureAllowance } from './tx'

export async function approveCollateral(
  walletClient: WalletClient,
  publicClient: PublicClient,
  tokenAddress: `0x${string}`,
  spenderAddress: `0x${string}`,
  amount: bigint
): Promise<`0x${string}` | null> {
  const account = await requireAccountAddress(walletClient)

  // Resolve CollateralVault address if spenderAddress is a BreezeMarket — a
  // market delegates custody to its vault, so the vault is the real spender.
  let targetSpender = spenderAddress
  try {
    const vaultAddress = await publicClient.readContract({
      address: spenderAddress,
      abi: MarketABI,
      functionName: 'vault'
    }) as `0x${string}`
    if (vaultAddress && vaultAddress !== '0x0000000000000000000000000000000000000000') {
      targetSpender = vaultAddress
    }
  } catch {
    // If not a market or vault query fails, fall back to spenderAddress
  }

  console.log('Target vault spender for approval:', targetSpender)

  return ensureAllowance(walletClient, publicClient, tokenAddress, account, targetSpender, amount, account)
}

export async function mintPosition(
  walletClient: WalletClient,
  publicClient: PublicClient,
  params: MintPositionParams
): Promise<`0x${string}`> {
  return sendTx(walletClient, publicClient, {
    address: params.marketAddress,
    abi: MarketABI,
    functionName: 'mintPosition',
    args: [SIDES[params.side], params.collateralAmount],
    account: await requireAccountAddress(walletClient),
  })
}

export async function redeem(
  walletClient: WalletClient,
  publicClient: PublicClient,
  marketAddress: `0x${string}`,
  tokenId: bigint,
  amount: bigint
): Promise<`0x${string}`> {
  return sendTx(walletClient, publicClient, {
    address: marketAddress,
    abi: MarketABI,
    functionName: 'redeem',
    args: [tokenId, amount],
    account: await requireAccountAddress(walletClient),
  })
}

export async function settle(
  walletClient: WalletClient,
  publicClient: PublicClient,
  marketAddress: `0x${string}`
): Promise<`0x${string}`> {
  return sendTx(walletClient, publicClient, {
    address: marketAddress,
    abi: MarketABI,
    functionName: 'settle',
    args: [],
    account: await requireAccountAddress(walletClient),
  })
}
