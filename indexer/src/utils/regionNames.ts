import { keccak256, toHex } from 'viem'

export const REGION_NAMES: Record<string, string> = {
  [keccak256(toHex('TOKYO_RAINFALL'))]: 'Tokyo',
  [keccak256(toHex('SEOUL_RAINFALL'))]: 'Seoul',
  [keccak256(toHex('SINGAPORE_RAINFALL'))]: 'Singapore',
  [keccak256(toHex('DUBAI_TEMPERATURE'))]: 'Dubai',
  [keccak256(toHex('LONDON_RAINFALL'))]: 'London',
  [keccak256(toHex('TOKYO'))]: 'Tokyo',
  [keccak256(toHex('SEOUL'))]: 'Seoul',
  [keccak256(toHex('SINGAPORE'))]: 'Singapore',
  [keccak256(toHex('DUBAI'))]: 'Dubai',
  [keccak256(toHex('LONDON'))]: 'London'
}

export function getRegionName(regionId: string): string {
  return REGION_NAMES[regionId] || 'Tokyo'
}
