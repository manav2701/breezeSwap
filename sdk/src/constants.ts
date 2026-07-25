export const COSTON2_CHAIN_ID = 114

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
  }
} as const

// Decimal precision used in oracle values
// All oracle values are stored as value * 1e6
// e.g. 12.5mm rainfall = 12500000n on-chain
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
