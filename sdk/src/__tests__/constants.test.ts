import { describe, it, expect } from 'vitest'
import {
  COSTON2_CHAIN_ID,
  FLARE_MAINNET_CHAIN_ID,
  CONTRACT_ADDRESSES,
  DEPLOYED_CHAIN_IDS,
  isChainDeployed,
  getContractAddresses,
  ORACLE_DECIMALS,
  ORACLE_SCALAR,
  WAD,
} from '../constants'

describe('chain deployment registry', () => {
  it('marks Coston2 as deployed', () => {
    expect(isChainDeployed(COSTON2_CHAIN_ID)).toBe(true)
    expect(DEPLOYED_CHAIN_IDS).toContain(COSTON2_CHAIN_ID)
  })

  it('marks Flare mainnet as not (yet) deployed', () => {
    expect(isChainDeployed(FLARE_MAINNET_CHAIN_ID)).toBe(false)
  })

  it('returns the Coston2 address book for a deployed chain', () => {
    const addrs = getContractAddresses(COSTON2_CHAIN_ID)
    expect(addrs).toBe(CONTRACT_ADDRESSES[COSTON2_CHAIN_ID])
    expect(addrs.factory).toMatch(/^0x[0-9a-fA-F]{40}$/)
  })

  it('throws for a chain with no deployment instead of falling back', () => {
    expect(() => getContractAddresses(FLARE_MAINNET_CHAIN_ID)).toThrowError(
      /not deployed on chain 14/
    )
  })
})

describe('numeric constants', () => {
  it('derives ORACLE_SCALAR from ORACLE_DECIMALS', () => {
    expect(ORACLE_SCALAR).toBe(10n ** ORACLE_DECIMALS)
    expect(ORACLE_SCALAR).toBe(1_000_000n)
  })

  it('defines WAD as 1e18', () => {
    expect(WAD).toBe(10n ** 18n)
  })
})
