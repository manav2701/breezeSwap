import { ORACLE_SCALAR } from '../constants'

// Convert raw oracle int256 to display number (mm or °C)
export function formatOracleValue(raw: bigint | number, variable: 'RAINFALL' | 'TEMPERATURE'): string {
  const display = Number(raw) / Number(ORACLE_SCALAR)
  if (variable === 'RAINFALL') return `${display.toFixed(1)} mm`
  return `${display.toFixed(1)} °C`
}

// Convert display number back to raw oracle units for contract calls
export function toOracleUnits(display: number): bigint {
  return BigInt(Math.round(display * Number(ORACLE_SCALAR)))
}

// Format a payout ratio (0-1 float) as a percentage string
export function formatPayoutRatio(ratio: number | null): string {
  if (ratio === null) return '—'
  return `${(ratio * 100).toFixed(1)}%`
}

// Format collateral amount — handles both 6-decimal (USDT) and 18-decimal (FXRP)
export function formatCollateral(raw: string | bigint | number | undefined | null, decimals: number, symbol: string): string {
  try {
    if (raw === undefined || raw === null || raw === '' || raw === 'NaN') return `0 ${symbol}`
    const num = Number(raw)
    if (isNaN(num)) return `0 ${symbol}`
    const display = num / Math.pow(10, decimals)
    return `${display.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${symbol}`
  } catch {
    return `0 ${symbol}`
  }
}

// Format a unix timestamp or ISO string as a human-readable date
export function formatExpiry(isoString: string): string {
  try {
    if (!isoString) return 'Invalid Date'
    return new Date(isoString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  } catch {
    return 'Invalid Date'
  }
}

// How long until expiry
export function timeUntilExpiry(isoString: string): string {
  try {
    if (!isoString) return 'Invalid Date'
    const diff = new Date(isoString).getTime() - Date.now()
    if (diff < 0) return 'Expired'
    const days = Math.floor(diff / 86400000)
    const hours = Math.floor((diff % 86400000) / 3600000)
    if (days > 0) return `${days}d ${hours}h remaining`
    return `${hours}h remaining`
  } catch {
    return 'Invalid Date'
  }
}
