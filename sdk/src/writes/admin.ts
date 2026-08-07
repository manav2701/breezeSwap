import { WalletClient, PublicClient } from 'viem'
import AccessControlABI from '../abis/BreezeAccessControl.json'
import OracleABI from '../abis/MockWeatherOracle.json'
import MarketABI from '../abis/BreezeMarket.json'
import FactoryABI from '../abis/BreezeMarketFactory.json'
import FeeConfigABI from '../abis/FeeConfig.json'
import { BreezeRole } from '../reads/access'
import { requireAccount, sendTx, readRoleHash } from './tx'

export async function setTradingFeeBps(
  walletClient: WalletClient,
  publicClient: PublicClient,
  feeConfigAddress: `0x${string}`,
  newRateBps: bigint
): Promise<`0x${string}`> {
  return sendTx(walletClient, publicClient, {
    address: feeConfigAddress,
    abi: FeeConfigABI,
    functionName: 'setTradingFeeBps',
    args: [newRateBps],
    account: requireAccount(walletClient),
  })
}

export async function setOracleReading(
  walletClient: WalletClient,
  publicClient: PublicClient,
  oracleAddress: `0x${string}`,
  regionId: `0x${string}`,
  timestamp: bigint,
  value: bigint
): Promise<`0x${string}`> {
  return sendTx(walletClient, publicClient, {
    address: oracleAddress,
    abi: OracleABI,
    functionName: 'setReading',
    args: [regionId, timestamp, value],
    account: requireAccount(walletClient),
  })
}

export async function pauseMarket(
  walletClient: WalletClient,
  publicClient: PublicClient,
  marketAddress: `0x${string}`
): Promise<`0x${string}`> {
  return sendTx(walletClient, publicClient, {
    address: marketAddress,
    abi: MarketABI,
    functionName: 'pauseMarket',
    account: requireAccount(walletClient),
  })
}

export async function unpauseMarket(
  walletClient: WalletClient,
  publicClient: PublicClient,
  marketAddress: `0x${string}`
): Promise<`0x${string}`> {
  return sendTx(walletClient, publicClient, {
    address: marketAddress,
    abi: MarketABI,
    functionName: 'unpauseMarket',
    account: requireAccount(walletClient),
  })
}

export async function pauseFactory(
  walletClient: WalletClient,
  publicClient: PublicClient,
  factoryAddress: `0x${string}`
): Promise<`0x${string}`> {
  return sendTx(walletClient, publicClient, {
    address: factoryAddress,
    abi: FactoryABI,
    functionName: 'pauseFactory',
    account: requireAccount(walletClient),
  })
}

export async function unpauseFactory(
  walletClient: WalletClient,
  publicClient: PublicClient,
  factoryAddress: `0x${string}`
): Promise<`0x${string}`> {
  return sendTx(walletClient, publicClient, {
    address: factoryAddress,
    abi: FactoryABI,
    functionName: 'unpauseFactory',
    account: requireAccount(walletClient),
  })
}

export async function grantRole(
  walletClient: WalletClient,
  publicClient: PublicClient,
  accessControlAddress: `0x${string}`,
  role: BreezeRole,
  accountToGrant: `0x${string}`
): Promise<`0x${string}`> {
  const account = requireAccount(walletClient)
  const roleHash = await readRoleHash(publicClient, accessControlAddress, role)

  return sendTx(walletClient, publicClient, {
    address: accessControlAddress,
    abi: AccessControlABI,
    functionName: 'grantRole',
    args: [roleHash, accountToGrant],
    account,
  })
}

export async function revokeRole(
  walletClient: WalletClient,
  publicClient: PublicClient,
  accessControlAddress: `0x${string}`,
  role: BreezeRole,
  accountToRevoke: `0x${string}`
): Promise<`0x${string}`> {
  const account = requireAccount(walletClient)
  const roleHash = await readRoleHash(publicClient, accessControlAddress, role)

  return sendTx(walletClient, publicClient, {
    address: accessControlAddress,
    abi: AccessControlABI,
    functionName: 'revokeRole',
    args: [roleHash, accountToRevoke],
    account,
  })
}
