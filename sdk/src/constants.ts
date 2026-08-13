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
/**
 * @dev Must match `contracts/deployments/coston2.json`. These are the full-protocol
 * deployment from `script/DeployProtocol.s.sol` at block 33922220, which superseded the
 * pre-waterfall stack. The old addresses are recorded under `superseded` in that file and
 * must not be used: their markets derived a region id from the city name alone, so a city's
 * rainfall and temperature markets shared one oracle slot and cannot settle correctly.
 */
export const CONTRACT_ADDRESSES = {
  [COSTON2_CHAIN_ID]: {
    accessControl: '0x055939d4FB50AF8bEd0b0834689B2e19e4f3454e' as `0x${string}`,
    factory: '0x37E24CcE58A1fCC23e3C88Bdf0Dcc75E19444A5d' as `0x${string}`,
    marketFactory: '0x37E24CcE58A1fCC23e3C88Bdf0Dcc75E19444A5d' as `0x${string}`,
    positionToken: '0xC84941ba6be5580f5502e5D04a3ACa3d2fE2fa39' as `0x${string}`,
    mockWeatherOracle: '0x9c1C9eb2d5Eeede240254AaC84Ca449E647a35E5' as `0x${string}`,
    oracle: '0x9c1C9eb2d5Eeede240254AaC84Ca449E647a35E5' as `0x${string}`,
    /// Demo collateral deployed by the script and minted to the deployer. Not real value.
    mockUsdt: '0x8399c62f02cb1863Af24D71Db4f6F780F81c9d95' as `0x${string}`,
    strikeProbabilityOracle: '0x8e8F99a12Ec5Cec7436E16a70Ce7Ec31f1ECb595' as `0x${string}`,
    feeConfig: '0xc284039C88A9B5B0Cb1D7D149DBa017BF1935052' as `0x${string}`,
    protocolTreasury: '0x7eFC570bFDA83e94c7a65Fc23B339f59097dd1bB' as `0x${string}`,
    insuranceFund: '0x40593E16e34Df12537bb0c07dded55F4a0355198' as `0x${string}`,
    // Capital stack. Absent from every previous deployment.
    firstLossReserve: '0x7abF64b4B0bED8c151F403f8Ae3efA6f8AD22B4E' as `0x${string}`,
    liquidityVault: '0x053d5237A55941bE87cAb5bbB40230AC8Ab644b6' as `0x${string}`,
    juniorTranche: '0x9432b5cE8c6aEc67b7FD04429986fC38149DBF55' as `0x${string}`,
    perilExposureRegistry: '0xa8A1A17642226203397e2cc7aB336f814c0a4Ef4' as `0x${string}`,
    weatherPolicyMarket: '0xB41Fd6739FE2fee81F5eA8A3881eaDEc49B72252' as `0x${string}`,
    perpFactory: '0x82df4B98D83A65Af9CA85ec489bcC9d3742D36B7' as `0x${string}`,
    tokyoPerpMarket: '0x4Cad553561C9A37f9db2D33f5CbcCb527D4dC0dc' as `0x${string}`,
    seoulPerpMarket: '0x2247023AAa6dE770C5b7c7aF91B204553ee3d08A' as `0x${string}`,
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
