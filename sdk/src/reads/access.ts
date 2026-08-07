import { PublicClient } from 'viem'
import AccessControlABI from '../abis/BreezeAccessControl.json'

export type BreezeRole = 'ADMIN_ROLE' | 'PAUSER_ROLE' | 'ORACLE_UPDATER_ROLE' | 'MARKET_CREATOR_ROLE'

export async function checkRole(
  publicClient: PublicClient,
  accessControlAddress: string,
  role: BreezeRole,
  account: string
): Promise<boolean> {
  if (!accessControlAddress || !account || accessControlAddress === '0x0000000000000000000000000000000000000000') return false

  // A failed read is not the same as "this wallet does not hold the role", and
  // reporting it as `false` locked admins out of the admin page with no
  // explanation whenever the RPC was briefly unavailable. Callers decide how to
  // present the failure; they cannot if it never reaches them.
  const roleHash = (await publicClient.readContract({
    address: accessControlAddress as `0x${string}`,
    abi: AccessControlABI,
    functionName: role
  })) as `0x${string}`

  return (await publicClient.readContract({
    address: accessControlAddress as `0x${string}`,
    abi: AccessControlABI,
    functionName: 'hasRole',
    args: [roleHash, account as `0x${string}`]
  })) as boolean
}
