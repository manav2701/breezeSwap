import { describe, it, expect } from 'vitest'
import { encodeRegionId, decodeRegionId, KNOWN_REGIONS } from '../regions'

describe('encodeRegionId', () => {
  it('returns a 0x-prefixed keccak256 hash (32 bytes)', () => {
    const id = encodeRegionId('Tokyo')
    expect(id).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('is deterministic for the same input', () => {
    expect(encodeRegionId('Seoul')).toBe(encodeRegionId('Seoul'))
  })

  it('produces different ids for different regions', () => {
    expect(encodeRegionId('Tokyo')).not.toBe(encodeRegionId('London'))
  })
})

describe('decodeRegionId', () => {
  it('resolves a known region id back to its name', () => {
    expect(decodeRegionId(encodeRegionId('Tokyo'))).toBe('Tokyo')
    expect(decodeRegionId(encodeRegionId('London'))).toBe('London')
  })

  it('resolves the *_RAINFALL / *_TEMPERATURE aliases to a city name', () => {
    expect(decodeRegionId(encodeRegionId('DUBAI_TEMPERATURE'))).toBe('Dubai')
    expect(decodeRegionId(encodeRegionId('SINGAPORE_RAINFALL'))).toBe('Singapore')
  })

  it('is case-insensitive on the incoming id', () => {
    const id = encodeRegionId('Seoul')
    expect(decodeRegionId(id.toUpperCase())).toBe('Seoul')
  })

  it('falls back to "Unknown Region" for an unmapped id', () => {
    expect(decodeRegionId('0x' + '00'.repeat(32))).toBe('Unknown Region')
  })
})

describe('KNOWN_REGIONS', () => {
  it('contains an entry for each seeded city', () => {
    const cities = Object.values(KNOWN_REGIONS)
    for (const city of ['Tokyo', 'Seoul', 'Singapore', 'Dubai', 'London']) {
      expect(cities).toContain(city)
    }
  })
})
