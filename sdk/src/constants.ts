export const COSTON2_CHAIN_ID = 114
export const FLARE_MAINNET_CHAIN_ID = 14

/**
 * Live contract registry, keyed by chain ID.
 *
 * Only chains with a verified on-chain deployment appear here. BreezeSwap is
 * currently deployed to Coston2 testnet only — Flare Mainnet (chain 14) is
 * intentionally absent because no mainnet deployment exists yet. The SDK,
 * indexer, and frontend are all genuinely chain-parametrised, so adding a
 * mainnet entry here is the only change required once one is deployed.
 */
export const CONTRACT_ADDRESSES = {
  [COSTON2_CHAIN_ID]: {
    accessControl: '0x3788420AB4Ef4D2c2dd22c151fd6CB93d2543853' as `0x${string}`,
    factory: '0x699fd810EC7C0620a9BF01Cd73356770Ae0aBbaf' as `0x${string}`,
    marketFactory: '0x699fd810EC7C0620a9BF01Cd73356770Ae0aBbaf' as `0x${string}`,
    positionToken: '0x1A3C38499020a733C1534E8f43FBbF3afAf01e15' as `0x${string}`,
    mockWeatherOracle: '0x17EEF37738887b2a6f7149aA3af047D6144D6139' as `0x${string}`,
    oracle: '0x17EEF37738887b2a6f7149aA3af047D6144D6139' as `0x${string}`,
    mockUsdt: '0x639b6b2a0195271557e543F51c0FA417265B2FAC' as `0x${string}`,
    fTestXrp: '0x0b6a8e49F600B4676570c99a38e6a68d5d813DC7' as `0x${string}`,
    ftsoWeatherAdapter: '0x9cd4dFb3B738dCf0DaBB0a94fd054cC9E2F4218c' as `0x${string}`,
    fdcWeatherAdapter: '0x341A6C8AA41A70c11803Cb67dd56E7F62c1fb18A' as `0x${string}`,
    fAssetsCollateralAdapter: '0x4cB99FD30BF78c735a5296462C2C2256bE5DcF54' as `0x${string}`,
    feeConfig: '0xB0D295305d653F044E4178bb6966e76FB79f325C' as `0x${string}`,
    protocolTreasury: '0xecB7Ff4dA80532F5C7803392761643bA4dDe5058' as `0x${string}`,
    insuranceFund: '0x96952FC0fBe43AA72E1D08B11daD5cA56c12a36f' as `0x${string}`,
    perpFactory: '0x05e309f0434942BDfa0D961E25FaCc4483BABe46' as `0x${string}`,
    tokyoPerpMarket: '0x90C9876e41D0C5a7E1E8F660F0B2bD58D64Cb7Be' as `0x${string}`,
    seoulPerpMarket: '0x0e566b3b5917Fa2E712b4cd9D5eAE2411e75E2AB' as `0x${string}`,
    dubaiPerpMarket: '0x3dEc7c280A41a7a2b1272DBe91F1239F6f352DeD' as `0x${string}`,
  }
} as const

/** Chain IDs with a verified on-chain deployment. */
export const DEPLOYED_CHAIN_IDS = [COSTON2_CHAIN_ID] as const

export function isChainDeployed(chainId: number): boolean {
  return chainId in CONTRACT_ADDRESSES
}

/**
 * Resolve the contract registry for a chain.
 *
 * Throws for chains with no deployment rather than falling back to another
 * chain's addresses — a silent fallback would let a caller believe it was
 * writing to one network while pointing at contracts on a different one.
 */
export function getContractAddresses(chainId: number) {
  const addresses = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES]
  if (!addresses) {
    throw new Error(
      `BreezeSwap is not deployed on chain ${chainId}. ` +
        `Deployed chains: ${DEPLOYED_CHAIN_IDS.join(', ')}.`
    )
  }
  return addresses
}

// Decimal precision used in oracle values
export const ORACLE_DECIMALS = 6n
export const ORACLE_SCALAR = 10n ** ORACLE_DECIMALS

// Payout ratios are stored as value * 1e18 (standard WAD)
export const WAD = 10n ** 18n

export const WEATHER_VARIABLES = {
  RAINFALL: 0,
  TEMPERATURE: 1,
} as const

export const PAYOFF_TYPES = {
  BINARY: 0,
  LINEAR: 1,
  CAPPED: 2,
} as const

export const SIDES = {
  LONG: 0,
  SHORT: 1,
} as const
