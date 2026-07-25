import { Router } from 'express'
import { getMarkets, getMarket, getMarketPositions } from './handlers/markets'
import { getUserPositions } from './handlers/positions'
import { getWeatherReadings, getRegions } from './handlers/weather'
import { getAuditLog } from './handlers/admin'
import { healthHandler } from './handlers/health'

export const router = Router()

router.get('/health', healthHandler)
router.get('/markets', getMarkets)
router.get('/markets/:address', getMarket)
router.get('/markets/:address/positions', getMarketPositions)
router.get('/users/:address/positions', getUserPositions)
router.get('/weather/regions', getRegions)
router.get('/weather/:regionId', getWeatherReadings)
router.get('/admin/audit-log', getAuditLog)
