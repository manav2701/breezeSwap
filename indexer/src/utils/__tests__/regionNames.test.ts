import { describe, it, expect } from 'vitest'
import { keccak256, toHex } from 'viem'
import { REGION_NAMES, getRegionName } from '../regionNames'

const idOf = (label: string) => keccak256(toHex(label))

describe('getRegionName', () => {
  it('maps *_RAINFALL region ids to city names', () => {
    expect(getRegionName(idOf('TOKYO_RAINFALL'))).toBe('Tokyo')
    expect(getRegionName(idOf('SEOUL_RAINFALL'))).toBe('Seoul')
    expect(getRegionName(idOf('SINGAPORE_RAINFALL'))).toBe('Singapore')
    expect(getRegionName(idOf('LONDON_RAINFALL'))).toBe('London')
  })

  it('maps the *_TEMPERATURE id to its city name', () => {
    expect(getRegionName(idOf('DUBAI_TEMPERATURE'))).toBe('Dubai')
  })

  it('maps the bare city-name ids as well', () => {
    expect(getRegionName(idOf('TOKYO'))).toBe('Tokyo')
    expect(getRegionName(idOf('DUBAI'))).toBe('Dubai')
  })

  it('falls back to "Tokyo" for an unknown region id', () => {
    expect(getRegionName('0x' + 'ab'.repeat(32))).toBe('Tokyo')
  })
})

describe('REGION_NAMES', () => {
  it('covers all five seeded cities', () => {
    const cities = new Set(Object.values(REGION_NAMES))
    for (const city of ['Tokyo', 'Seoul', 'Singapore', 'Dubai', 'London']) {
      expect(cities.has(city)).toBe(true)
    }
  })
})
