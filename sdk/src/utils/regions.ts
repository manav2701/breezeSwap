import { keccak256, toHex } from 'viem'

/**
 * A region identifier names a DATA SERIES, not a place.
 *
 * `IWeatherOracle.getReading(regionId, timestamp)` takes no weather-variable
 * argument, and `MockWeatherOracle` stores readings as
 * `regionId => timestamp => Reading`. The region id is therefore the only thing
 * separating one series from another, so the variable has to be part of it.
 *
 * Encoding the city alone is what produced the defect this module now exists to
 * prevent: a Tokyo rainfall market and a Tokyo temperature market both hashed to
 * `keccak256("Tokyo")`, so both read the same oracle slot. Writing 45 mm of
 * rainfall settled the temperature market as though Tokyo had hit 45 degrees.
 * Nothing reverted and nothing logged, because from the oracle's point of view
 * the two markets were asking the same question.
 */
import type { WeatherVariable } from '../types'

/** Weather variable as encoded by `BreezeMarket.WeatherVariable`. */
export const WEATHER_VARIABLE_BY_INDEX: Record<number, WeatherVariable> = {
  0: 'RAINFALL',
  1: 'TEMPERATURE',
}

/**
 * Canonical region id: `keccak256("<REGION>_<VARIABLE>")`, upper case.
 *
 * Matches `weather-seed/src/climatology.ts`, which is what priced the strike
 * probabilities the protocol quotes against, so a market created here is
 * addressable by the pricing data that already exists.
 */
export function encodeRegionId(
  regionName: string,
  variable: WeatherVariable
): `0x${string}` {
  return keccak256(toHex(`${regionName.toUpperCase()}_${variable}`))
}

/** The cities the climatology seeder covers. */
export const SUPPORTED_REGIONS = ['Tokyo', 'Seoul', 'Singapore', 'Dubai', 'London'] as const

export type SupportedRegion = (typeof SUPPORTED_REGIONS)[number]

/**
 * Display names by region id, for both variables of every supported city.
 *
 * @dev The legacy city-only ids are still listed so that markets created before
 * the collision was fixed keep rendering a readable name instead of "Unknown
 * Region". They are deliberately NOT produced by `encodeRegionId` any more, and
 * `isLegacyRegionId` exists so a caller can warn on them.
 */
export const KNOWN_REGIONS: Record<string, string> = Object.fromEntries([
  ...SUPPORTED_REGIONS.flatMap((name) => [
    [encodeRegionId(name, 'RAINFALL'), name],
    [encodeRegionId(name, 'TEMPERATURE'), name],
  ]),
  ...SUPPORTED_REGIONS.map((name) => [keccak256(toHex(name)), name]),
])

/** Ids from the city-only scheme, which cannot distinguish the two variables. */
export const LEGACY_REGION_IDS: ReadonlySet<string> = new Set(
  SUPPORTED_REGIONS.map((name) => keccak256(toHex(name)))
)

export function isLegacyRegionId(regionId: string): boolean {
  return LEGACY_REGION_IDS.has(regionId.toLowerCase() as `0x${string}`)
    || LEGACY_REGION_IDS.has(regionId as `0x${string}`)
}

export function decodeRegionId(regionId: string): string {
  return KNOWN_REGIONS[regionId.toLowerCase()] ?? KNOWN_REGIONS[regionId] ?? 'Unknown Region'
}
