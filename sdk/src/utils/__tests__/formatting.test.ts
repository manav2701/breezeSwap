import { describe, it, expect } from 'vitest'
import {
  formatOracleValue,
  toOracleUnits,
  formatPayoutRatio,
  formatCollateral,
  formatExpiry,
  timeUntilExpiry,
} from '../formatting'
import { ORACLE_SCALAR } from '../../constants'

describe('formatOracleValue', () => {
  it('formats a rainfall reading in millimetres', () => {
    expect(formatOracleValue(25_000_000n, 'RAINFALL')).toBe('25.0 mm')
  })

  it('formats a temperature reading in degrees Celsius', () => {
    expect(formatOracleValue(25_000_000n, 'TEMPERATURE')).toBe('25.0 °C')
  })

  it('rounds to a single decimal place', () => {
    // 12.34 -> 12.3
    expect(formatOracleValue(12_340_000n, 'RAINFALL')).toBe('12.3 mm')
  })

  it('accepts a plain number as well as a bigint', () => {
    expect(formatOracleValue(1_500_000, 'TEMPERATURE')).toBe('1.5 °C')
  })

  it('handles negative temperatures', () => {
    expect(formatOracleValue(-5_000_000n, 'TEMPERATURE')).toBe('-5.0 °C')
  })
})

describe('toOracleUnits', () => {
  it('scales a display value up to raw oracle units', () => {
    expect(toOracleUnits(25)).toBe(25n * ORACLE_SCALAR)
  })

  it('rounds fractional units to the nearest integer', () => {
    // 1.2345671 * 1e6 = 1234567.1 -> 1234567
    expect(toOracleUnits(1.2345671)).toBe(1_234_567n)
  })

  it('round-trips with formatOracleValue for a clean value', () => {
    const raw = toOracleUnits(30)
    expect(formatOracleValue(raw, 'TEMPERATURE')).toBe('30.0 °C')
  })
})

describe('formatPayoutRatio', () => {
  it('returns an em dash for null', () => {
    expect(formatPayoutRatio(null)).toBe('—')
  })

  it('formats a ratio as a percentage', () => {
    expect(formatPayoutRatio(0.5)).toBe('50.0%')
  })

  it('formats zero and one at the boundaries', () => {
    expect(formatPayoutRatio(0)).toBe('0.0%')
    expect(formatPayoutRatio(1)).toBe('100.0%')
  })
})

describe('formatCollateral', () => {
  it('returns a zero string for undefined/null/empty/NaN input', () => {
    expect(formatCollateral(undefined, 6, 'USDT')).toBe('0 USDT')
    expect(formatCollateral(null, 6, 'USDT')).toBe('0 USDT')
    expect(formatCollateral('', 6, 'USDT')).toBe('0 USDT')
    expect(formatCollateral('NaN', 6, 'USDT')).toBe('0 USDT')
  })

  it('scales down a 6-decimal (USDT) amount', () => {
    expect(formatCollateral(2_000_000n, 6, 'USDT')).toBe('2 USDT')
    expect(formatCollateral('1500000', 6, 'USDT')).toBe('1.5 USDT')
  })

  it('scales down an 18-decimal (FXRP) amount', () => {
    expect(formatCollateral(3n * 10n ** 18n, 18, 'FXRP')).toBe('3 FXRP')
  })

  it('caps the display at two fractional digits', () => {
    // 1.239 -> 1.24
    expect(formatCollateral(1_239_000n, 6, 'USDT')).toBe('1.24 USDT')
  })

  it('returns a safe zero string when Number() yields NaN', () => {
    expect(formatCollateral('not-a-number', 6, 'USDT')).toBe('0 USDT')
  })
})

describe('formatExpiry', () => {
  it('returns "Invalid Date" for an empty string', () => {
    expect(formatExpiry('')).toBe('Invalid Date')
  })

  it('formats a valid ISO string into a readable date', () => {
    const out = formatExpiry('2025-01-15T12:00:00.000Z')
    expect(out).toContain('2025')
    expect(out).toContain('Jan')
  })
})

describe('timeUntilExpiry', () => {
  it('returns "Invalid Date" for an empty string', () => {
    expect(timeUntilExpiry('')).toBe('Invalid Date')
  })

  it('returns "Expired" for a past timestamp', () => {
    expect(timeUntilExpiry('2000-01-01T00:00:00.000Z')).toBe('Expired')
  })

  it('reports days and hours remaining for a future timestamp', () => {
    const future = new Date(Date.now() + (2 * 86_400_000 + 3 * 3_600_000)).toISOString()
    expect(timeUntilExpiry(future)).toBe('2d 3h remaining')
  })

  it('reports only hours when less than a day remains', () => {
    const future = new Date(Date.now() + 5 * 3_600_000).toISOString()
    expect(timeUntilExpiry(future)).toBe('5h remaining')
  })
})
