import { WalletClient, PublicClient } from 'viem'
import BreezePerpMarketABI from '../abis/BreezePerpMarket.json'
import ERC20ABI from '../abis/ERC20.json'

/**
 * Ensure the perp market may pull `amount` of its collateral token.
 *
 * `openPosition` calls `collateralToken.safeTransferFrom(msg.sender, ...)`, so
 * without an allowance it reverts with `ERC20InsufficientAllowance`
 * (`0xfb8f41b2`) — which is exactly what every first-time perp trade did. The
 * classic mint path had always approved first; this one simply never did, and
 * the error selector meant nothing to anyone reading it in a wallet popup.
 *
 * Unlike the classic path the spender is the MARKET itself: a perp market holds
 * collateral directly rather than delegating to a `CollateralVault`.
 *
 * Returns the approval hash, or `null` when the existing allowance already
 * covers the amount.
 */
export async function approvePerpCollateral(
  walletClient: WalletClient,
  publicClient: PublicClient,
  marketAddress: `0x${string}`,
  amount: bigint
): Promise<`0x${string}` | null> {
  const [account] = await walletClient.getAddresses()
  if (!account) throw new Error('Wallet not connected')

  const tokenAddress = (await publicClient.readContract({
    address: marketAddress,
    abi: BreezePerpMarketABI,
    functionName: 'collateralToken',
  })) as `0x${string}`

  try {
    const allowance = (await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20ABI,
      functionName: 'allowance',
      args: [account, marketAddress],
    })) as bigint
    if (allowance >= amount) return null
  } catch {
    // Fall through and approve.
  }

  const { request } = await publicClient.simulateContract({
    address: tokenAddress,
    abi: ERC20ABI,
    functionName: 'approve',
    args: [marketAddress, amount],
    account,
  })
  return walletClient.writeContract(request)
}

/**
 * Open a leveraged position, approving collateral first when required.
 *
 * The approval is awaited to a receipt before the open is simulated. Firing
 * both in the same block would have the simulation run against the pre-approval
 * state and revert.
 */
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

  const approvalHash = await approvePerpCollateral(
    walletClient,
    publicClient,
    marketAddress,
    collateralAmount
  )
  if (approvalHash) {
    await publicClient.waitForTransactionReceipt({ hash: approvalHash })
  }

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
