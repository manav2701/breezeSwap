import { keccak256, toHex } from 'viem'

// The regionId on-chain is keccak256(regionName as UTF-8 bytes)
export function encodeRegionId(regionName: string): `0x${string}` {
  return keccak256(toHex(regionName))
}

// Pre-computed map for the 5 seeded regions
export const KNOWN_REGIONS: Record<string, string> = {
  [encodeRegionId('Tokyo')]: 'Tokyo',
  [encodeRegionId('Seoul')]: 'Seoul',
  [encodeRegionId('Singapore')]: 'Singapore',
  [encodeRegionId('Dubai')]: 'Dubai',
  [encodeRegionId('London')]: 'London',
  [encodeRegionId('TOKYO_RAINFALL')]: 'Tokyo',
  [encodeRegionId('SEOUL_RAINFALL')]: 'Seoul',
  [encodeRegionId('SINGAPORE_RAINFALL')]: 'Singapore',
  [encodeRegionId('DUBAI_TEMPERATURE')]: 'Dubai',
  [encodeRegionId('LONDON_RAINFALL')]: 'London',
}

export function decodeRegionId(regionId: string): string {
  return KNOWN_REGIONS[regionId.toLowerCase()] ?? KNOWN_REGIONS[regionId] ?? 'Unknown Region'
}
