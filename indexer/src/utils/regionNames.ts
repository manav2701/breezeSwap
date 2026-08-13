import { keccak256, toHex } from 'viem'

const REGIONS = ['TOKYO', 'SEOUL', 'SINGAPORE', 'DUBAI', 'LONDON'] as const
const VARIABLES = ['RAINFALL', 'TEMPERATURE'] as const

function title(region: string): string {
  return region.charAt(0) + region.slice(1).toLowerCase()
}

/**
 * Display name per region id, covering both variables of every supported city.
 *
 * The city-only ids are legacy: they predate the fix for a collision where a
 * city's rainfall and temperature markets hashed to the same id and therefore
 * read the same oracle slot. They stay mapped so historical markets still
 * render a name, but nothing produces them any more.
 */
export const REGION_NAMES: Record<string, string> = Object.fromEntries([
  ...REGIONS.flatMap((region) =>
    VARIABLES.map((variable) => [keccak256(toHex(`${region}_${variable}`)), title(region)])
  ),
  ...REGIONS.map((region) => [keccak256(toHex(region)), title(region)]),
])

/**
 * @dev Returns null rather than defaulting to 'Tokyo'. The old default made
 * every unrecognised region id render as Tokyo, which is how a set of markets
 * built on the wrong id scheme displayed correct-looking names for weeks.
 * An unknown id is now visible as unknown.
 */
export function getRegionName(regionId: string): string | null {
  return REGION_NAMES[regionId] ?? REGION_NAMES[regionId?.toLowerCase()] ?? null
}
