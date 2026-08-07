import { Router } from 'express'
import { getMarkets, getMarket, getMarketPositions } from './handlers/markets'
import { getUserPositions } from './handlers/positions'
import { getWeatherReadings, getRegions } from './handlers/weather'
import { getAuditLog } from './handlers/admin'
import {
  getPerpMarkets, getPerpMarket, getPerpMarketPositions,
  getFundingHistory, getMarkPriceHistory, getUserPerpPositions,
  getTradeHistory, getPerpMarketStats, getCandles
} from './handlers/perp'
import {
  getTotalFees, getRecentFees, getInsuranceFundBalance, getTreasuryBalance,
  getGlobalTradeHistory
} from './handlers/protocol'
import { healthHandler } from './handlers/health'
import { requireAdminKey } from './adminAuth'

export const router = Router()

router.get('/health', healthHandler)
router.get('/markets', getMarkets)
router.get('/markets/:address', getMarket)
router.get('/markets/:address/positions', getMarketPositions)
router.get('/users/:address/positions', getUserPositions)
router.get('/weather/regions', getRegions)
router.get('/weather/:regionId', getWeatherReadings)
router.get('/admin/audit-log', requireAdminKey, getAuditLog)

// Perp routes
router.get('/perp-markets', getPerpMarkets)
router.get('/perp-markets/:address/stats', getPerpMarketStats)
router.get('/perp-markets/:address/trade-history', getTradeHistory)
router.get('/perp-markets/:address/candles', getCandles)
router.get('/perp-markets/:address', getPerpMarket)
router.get('/perp-markets/:address/positions', getPerpMarketPositions)
router.get('/perp-markets/:address/funding-history', getFundingHistory)
router.get('/perp-markets/:address/mark-price-history', getMarkPriceHistory)
router.get('/users/:address/perp-positions', getUserPerpPositions)

// Protocol routes
router.get('/protocol/fees/total', getTotalFees)
router.get('/protocol/fees/recent', getRecentFees)
router.get('/protocol/insurance-fund', getInsuranceFundBalance)
router.get('/protocol/treasury', getTreasuryBalance)
router.get('/protocol/trade-history', getGlobalTradeHistory)
