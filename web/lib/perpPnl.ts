import type { PerpPosition } from '@breezeswap/sdk'

export interface PositionRiskAnalysis {
  unrealizedPnl: number
  pnlPercent: number
  equity: number
  notionalValue: number
  liquidationPrice: number
  distanceToLiquidationPercent: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

export function calculateUnrealizedPnl(
  position: PerpPosition,
  currentMarkPrice: number,
  currentFundingIndex = 0
): PositionRiskAnalysis {
  const collateral = Number(position.collateral || 0) / 1e18
  const leverage = Number(position.leverage || 1)
  const virtualSize = Number(position.virtualSize || 0) / 1e18
  const entryMarkPrice = Number(position.entryMarkPrice || 0) / 1e18

  if (virtualSize === 0 || entryMarkPrice === 0) {
    return {
      unrealizedPnl: 0,
      pnlPercent: 0,
      equity: collateral,
      notionalValue: 0,
      liquidationPrice: 0,
      distanceToLiquidationPercent: 100,
      riskLevel: 'LOW'
    }
  }

  // 1. Price PnL
  const priceDelta = position.isLong
    ? currentMarkPrice - entryMarkPrice
    : entryMarkPrice - currentMarkPrice
  const pricePnl = priceDelta * virtualSize

  // 2. Funding PnL (if index available)
  const fundingPnl = 0

  // 3. Equity & Notional
  const unrealizedPnl = pricePnl + fundingPnl
  const equity = collateral + unrealizedPnl
  const pnlPercent = collateral > 0 ? (unrealizedPnl / collateral) * 100 : 0
  const notionalValue = virtualSize * currentMarkPrice

  // 4. Exact Liquidation Price (10% Maintenance Margin requirement)
  // Long: equity = 0.10 * notional => collateral + (markPrice - entryPrice)*virtualSize = 0.10 * markPrice * virtualSize
  // => liquidationPrice = (entryPrice * virtualSize - collateral) / (0.90 * virtualSize)
  // Short: equity = 0.10 * notional => collateral + (entryPrice - markPrice)*virtualSize = 0.10 * markPrice * virtualSize
  // => liquidationPrice = (entryPrice * virtualSize + collateral) / (1.10 * virtualSize)
  let liquidationPrice = 0
  if (position.isLong) {
    liquidationPrice = Math.max(0, (entryMarkPrice * virtualSize - collateral) / (0.90 * virtualSize))
  } else {
    liquidationPrice = (entryMarkPrice * virtualSize + collateral) / (1.10 * virtualSize)
  }

  // 5. Distance to liquidation
  let distanceToLiquidationPercent = 100
  if (currentMarkPrice > 0 && liquidationPrice > 0) {
    distanceToLiquidationPercent = Math.abs(currentMarkPrice - liquidationPrice) / currentMarkPrice * 100
  }

  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW'
  if (equity <= collateral * 0.2 || distanceToLiquidationPercent < 3) {
    riskLevel = 'CRITICAL'
  } else if (distanceToLiquidationPercent < 8) {
    riskLevel = 'HIGH'
  } else if (distanceToLiquidationPercent < 15) {
    riskLevel = 'MEDIUM'
  }

  return {
    unrealizedPnl,
    pnlPercent,
    equity,
    notionalValue,
    liquidationPrice,
    distanceToLiquidationPercent,
    riskLevel
  }
}
