export const COSTON2_CHAIN_ID = 114

export const CONTRACT_ADDRESSES = {
  [COSTON2_CHAIN_ID]: {
    factory: '0xe8969c988D4CF26AA9A98B8a95fF93D14E80615A' as `0x${string}`,
    positionToken: '0x611653F531D6c584801449548728290EbE298d28' as `0x${string}`,
    mockWeatherOracle: '0x376b26e7C91AE050E48Aa1Ca7233625EA258A3ab' as `0x${string}`,
    mockUsdt: '0x61bB87822841428249405Cc77bcBF004C217fc64' as `0x${string}`,
    fTestXrp: '0x0b6a8e49F600B4676570c99a38e6a68d5d813DC7' as `0x${string}`,
    ftsoWeatherAdapter: '0x112E2Cd1Bd31874E2b24Eb7c75A3bA1408c67b5A' as `0x${string}`,
    fdcWeatherAdapter: '0xA2EF417a007A6E199F757809A7B56Db45c54861b' as `0x${string}`,
    fAssetsCollateralAdapter: '0xf84c832Ca8fdfb9FFCE433A359d959ED6f37Bc7B' as `0x${string}`,
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
