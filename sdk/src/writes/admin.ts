import { WalletClient, PublicClient } from 'viem'
import AccessControlABI from '../abis/BreezeAccessControl.json'
import OracleABI from '../abis/MockWeatherOracle.json'
import MarketABI from '../abis/BreezeMarket.json'
import FactoryABI from '../abis/BreezeMarketFactory.json'
import { BreezeRole } from '../reads/access'

export async function setOracleReading(
  walletClient: WalletClient,
  publicClient: PublicClient,
  oracleAddress: `0x${string}`,
  regionId: `0x${string}`,
  timestamp: bigint,
  value: bigint
): Promise<`0x${string}`> {
  const account = walletClient.account
  if (!account) throw new Error('Wallet not connected')

  const { request } = await publicClient.simulateContract({
    address: oracleAddress,
    abi: OracleABI,
    functionName: 'setReading',
    args: [regionId, timestamp, value],
    account
  })

  return walletClient.writeContract(request)
}

export async function pauseMarket(
  walletClient: WalletClient,
  publicClient: PublicClient,
  marketAddress: `0x${string}`
): Promise<`0x${string}`> {
  const account = walletClient.account
  if (!account) throw new Error('Wallet not connected')

  const { request } = await publicClient.simulateContract({
    address: marketAddress,
    abi: MarketABI,
    functionName: 'pauseMarket',
    account
  })

  return walletClient.writeContract(request)
}

export async function unpauseMarket(
  walletClient: WalletClient,
  publicClient: PublicClient,
  marketAddress: `0x${string}`
): Promise<`0x${string}`> {
  const account = walletClient.account
  if (!account) throw new Error('Wallet not connected')

  const { request } = await publicClient.simulateContract({
    address: marketAddress,
    abi: MarketABI,
    functionName: 'unpauseMarket',
    account
  })

  return walletClient.writeContract(request)
}

export async function pauseFactory(
  walletClient: WalletClient,
  publicClient: PublicClient,
  factoryAddress: `0x${string}`
): Promise<`0x${string}`> {
  const account = walletClient.account
  if (!account) throw new Error('Wallet not connected')

  const { request } = await publicClient.simulateContract({
    address: factoryAddress,
    abi: FactoryABI,
    functionName: 'pauseFactory',
    account
  })

  return walletClient.writeContract(request)
}

export async function unpauseFactory(
  walletClient: WalletClient,
  publicClient: PublicClient,
  factoryAddress: `0x${string}`
): Promise<`0x${string}`> {
  const account = walletClient.account
  if (!account) throw new Error('Wallet not connected')

  const { request } = await publicClient.simulateContract({
    address: factoryAddress,
    abi: FactoryABI,
    functionName: 'unpauseFactory',
    account
  })

  return walletClient.writeContract(request)
}

export async function grantRole(
  walletClient: WalletClient,
  publicClient: PublicClient,
  accessControlAddress: `0x${string}`,
  role: BreezeRole,
  targetAccount: `0x${string}`
): Promise<`0x${string}`> {
  const account = walletClient.account
  if (!account) throw new Error('Wallet not connected')

  const roleHash = (await publicClient.readContract({
    address: accessControlAddress,
    abi: AccessControlABI,
    functionName: role
  })) as `0x${string}`

  const { request } = await publicClient.simulateContract({
    address: accessControlAddress,
    abi: AccessControlABI,
    functionName: 'grantRole',
    args: [roleHash, targetAccount],
    account
  })

  return walletClient.writeContract(request)
}

export async function revokeRole(
  walletClient: WalletClient,
  publicClient: PublicClient,
  accessControlAddress: `0x${string}`,
  role: BreezeRole,
  targetAccount: `0x${string}`
): Promise<`0x${string}`> {
  const account = walletClient.account
  if (!account) throw new Error('Wallet not connected')

  const roleHash = (await publicClient.readContract({
    address: accessControlAddress,
    abi: AccessControlABI,
    functionName: role
  })) as `0x${string}`

  const { request } = await publicClient.simulateContract({
    address: accessControlAddress,
    abi: AccessControlABI,
    functionName: 'revokeRole',
    args: [roleHash, targetAccount],
    account
  })

  return walletClient.writeContract(request)
}
