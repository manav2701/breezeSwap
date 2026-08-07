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

  // 1. Resolve CollateralVault address if spenderAddress is a BreezeMarket
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
  } catch (err) {
    // Not every spender is a market, so no `vault()` is an expected outcome and
    // the market address is the right fallback. It is still worth saying which
    // spender the approval ended up targeting and why.
    console.warn(
      `Could not read vault() from ${spenderAddress}; approving the address itself.`,
      err
    )
  }

  // 2. Check existing allowance for targetSpender (CollateralVault)
  try {
    const allowance = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20ABI,
      functionName: 'allowance',
      args: [account, targetSpender]
    }) as bigint

    if (allowance >= amount) return null
  } catch (err) {
    // Approving anyway is safe — worst case it is a redundant transaction — but
    // an unreadable allowance usually means the token address or the RPC is
    // wrong, and the approval that follows is about to fail for the same reason.
    console.warn(`Could not read the allowance of ${tokenAddress}; requesting approval anyway.`, err)
  }

  // 3. Simulate and request approval for targetSpender (CollateralVault)
  const { request } = await publicClient.simulateContract({
    address: tokenAddress,
    abi: ERC20ABI,
    functionName: 'approve',
    args: [targetSpender, amount],
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
