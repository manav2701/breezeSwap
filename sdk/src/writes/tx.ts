import type {
  Abi,
  Account,
  PublicClient,
  SimulateContractParameters,
  WalletClient,
  WriteContractParameters,
} from 'viem'
import ERC20ABI from '../abis/ERC20.json'
import AccessControlABI from '../abis/BreezeAccessControl.json'
import type { BreezeRole } from '../reads/access'

/**
 * Shared plumbing for the write functions.
 *
 * Every write repeated the same three steps — resolve the signer and bail if
 * absent, `simulateContract`, then `writeContract(request)`. The simulate/write
 * pair in particular was copied verbatim into ~15 functions, so a change to how
 * transactions are sent meant editing every one. These helpers are the single
 * place that flow lives now; each write is left with just its contract-specific
 * arguments.
 */

/** Resolve the connected account object, throwing when no wallet is connected. */
export function requireAccount(walletClient: WalletClient): Account {
  const account = walletClient.account
  if (!account) throw new Error('Wallet not connected')
  return account
}

/** Resolve the first wallet address via `getAddresses`, throwing when none. */
export async function requireAccountAddress(walletClient: WalletClient): Promise<`0x${string}`> {
  const [account] = await walletClient.getAddresses()
  if (!account) throw new Error('No wallet connected')
  return account
}

/**
 * A write call described by its target, ABI, function and args.
 *
 * `abi` is left loose here on purpose: the ABIs are imported from JSON and so
 * are not `as const`, which is exactly the case viem's generics infer at the
 * call site. Routing them through a fully-typed parameter would collapse that
 * inference, so `sendTx` bridges to viem's parameter types internally.
 */
interface WriteCall {
  address: `0x${string}`
  abi: Abi | readonly unknown[]
  functionName: string
  args?: readonly unknown[]
  account: Account | `0x${string}`
}

/** Simulate a contract call and broadcast the resulting request. */
export async function sendTx(
  walletClient: WalletClient,
  publicClient: PublicClient,
  call: WriteCall
): Promise<`0x${string}`> {
  const { request } = await publicClient.simulateContract(
    call as unknown as SimulateContractParameters
  )
  return walletClient.writeContract(request as unknown as WriteContractParameters)
}

/** Read a role's on-chain hash from the access-control contract. */
export function readRoleHash(
  publicClient: PublicClient,
  accessControlAddress: `0x${string}`,
  role: BreezeRole
): Promise<`0x${string}`> {
  return publicClient.readContract({
    address: accessControlAddress,
    abi: AccessControlABI,
    functionName: role,
  }) as Promise<`0x${string}`>
}

/**
 * Approve `spender` to move `amount` of an ERC-20, skipping the transaction
 * when the existing allowance already covers it.
 *
 * Returns the approval hash, or `null` when no approval was needed. A failed
 * allowance read falls through to sending the approval rather than throwing.
 */
export async function ensureAllowance(
  walletClient: WalletClient,
  publicClient: PublicClient,
  token: `0x${string}`,
  owner: `0x${string}`,
  spender: `0x${string}`,
  amount: bigint,
  account: Account | `0x${string}`
): Promise<`0x${string}` | null> {
  try {
    const allowance = (await publicClient.readContract({
      address: token,
      abi: ERC20ABI,
      functionName: 'allowance',
      args: [owner, spender],
    })) as bigint
    if (allowance >= amount) return null
  } catch {
    // Fall through and approve.
  }

  return sendTx(walletClient, publicClient, {
    address: token,
    abi: ERC20ABI,
    functionName: 'approve',
    args: [spender, amount],
    account,
  })
}
