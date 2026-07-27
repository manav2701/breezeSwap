import { calculateUnrealizedPnl } from '../perpPnl'
import type { PerpPosition } from '@breezeswap/sdk'

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`)
  }
}

function testPnlMatchesKnownScenario() {
  const dummyPos: PerpPosition = {
    id: '1',
    marketAddress: '0x1111111111111111111111111111111111111111',
    positionId: '1',
    traderAddress: '0x2222222222222222222222222222222222222222',
    isLong: true,
    collateral: (10n * 10n ** 18n).toString(), // $10 collateral
    leverage: 2,
    virtualSize: (1n * 10n ** 18n).toString(), // 1 size
    entryMarkPrice: (20n * 10n ** 18n).toString(), // $20 entry price
    openedAt: new Date().toISOString(),
    openTxHash: '0x0',
    isOpen: true,
    closedAt: null,
    closeTxHash: null,
    realizedPnl: null,
    wasLiquidated: false
  }

  // If mark price rises from $20 to $25 (Long): PnL = (25 - 20) * 1 = +$5
  const result = calculateUnrealizedPnl(dummyPos, 25.0)
  assert(result.unrealizedPnl === 5.0, `Expected PnL 5.0, got ${result.unrealizedPnl}`)
  assert(result.equity === 15.0, `Expected equity 15.0, got ${result.equity}`)
  console.log('✓ testPnlMatchesKnownScenario passed')
}

function testLiquidationPriceBoundary() {
  const dummyPos: PerpPosition = {
    id: '2',
    marketAddress: '0x1111111111111111111111111111111111111111',
    positionId: '2',
    traderAddress: '0x2222222222222222222222222222222222222222',
    isLong: true,
    collateral: (20n * 10n ** 18n).toString(), // $20 collateral
    leverage: 5,
    virtualSize: (1n * 10n ** 18n).toString(), // 1 size
    entryMarkPrice: (100n * 10n ** 18n).toString(), // $100 entry price
    openedAt: new Date().toISOString(),
    openTxHash: '0x0',
    isOpen: true,
    closedAt: null,
    closeTxHash: null,
    realizedPnl: null,
    wasLiquidated: false
  }

  // 10% Maintenance Margin requirement: liquidationPrice = (100*1 - 20) / 0.90 = $88.89
  const result = calculateUnrealizedPnl(dummyPos, 100.0)
  assert(Math.abs(result.liquidationPrice - 88.888888) < 0.001, `Expected liquidation price ~88.89, got ${result.liquidationPrice}`)

  // At liquidation price $88.8888, equity = 20 + (88.888888 - 100) = 8.8888
  // 10% of notional ($88.8888) = 8.8888 => Equity == Maintenance Margin!
  const liqCheck = calculateUnrealizedPnl(dummyPos, result.liquidationPrice)
  assert(Math.abs(liqCheck.equity - 0.10 * liqCheck.notionalValue) < 0.001, 'Equity matches 10% maintenance margin exactly at liquidation price boundary')
  console.log('✓ testLiquidationPriceBoundary passed')
}

testPnlMatchesKnownScenario()
testLiquidationPriceBoundary()
console.log('ALL PERP PNL TESTS PASSED SUCCESSFULLY!')
