export interface Reserves {
  collateralReserve: bigint
  weatherReserve: bigint
}

export function calculateMarkPrice(reserves: Reserves): number {
  if (reserves.weatherReserve === 0n) return 0
  return Number((reserves.collateralReserve * 10n ** 18n) / reserves.weatherReserve) / 1e18
}

export function calculatePerpQuote(
  reserves: Reserves,
  collateralIn: bigint,
  leverage: number,
  isLong: boolean,
  feeBps: number = 10
): {
  feeAmount: bigint
  netCollateral: bigint
  exposureOut: bigint
  newMarkPrice: number
  priceImpactBps: number
  entryPrice: number
} {
  const feeAmount = (collateralIn * BigInt(feeBps)) / 10000n
  const netCollateral = collateralIn - feeAmount
  const notional = netCollateral * BigInt(leverage)
  const currentPrice = calculateMarkPrice(reserves)
  const k = reserves.collateralReserve * reserves.weatherReserve

  let newCollateralReserve: bigint
  let newWeatherReserve: bigint
  let exposureOut: bigint

  if (isLong) {
    newCollateralReserve = reserves.collateralReserve + notional
    newWeatherReserve = k / newCollateralReserve
    exposureOut = reserves.weatherReserve - newWeatherReserve
  } else {
    newCollateralReserve = reserves.collateralReserve - notional
    newWeatherReserve = k / newCollateralReserve
    exposureOut = newWeatherReserve - reserves.weatherReserve
  }

  const newReserves: Reserves = { collateralReserve: newCollateralReserve, weatherReserve: newWeatherReserve }
  const newMarkPrice = calculateMarkPrice(newReserves)

  const entryPrice = exposureOut > 0n ? Number((notional * 10n ** 18n) / exposureOut) / 1e18 : newMarkPrice
  const priceImpactBps = currentPrice > 0 ? Math.round(Math.abs((newMarkPrice - currentPrice) / currentPrice) * 10000) : 0

  return { feeAmount, netCollateral, exposureOut, newMarkPrice, priceImpactBps, entryPrice }
}
