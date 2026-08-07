import { Request, Response } from 'express'
import { supabase } from '../../db/client'
import { parseInteger, requireRegionId } from '../validate'
import { respondWithError } from '../errors'

// GET /api/weather/regions
export async function getRegions(req: Request, res: Response) {
  try {
    const { data, error } = await supabase
      .from('weather_readings')
      .select('region_id, region_name')
      .order('region_name')

    if (error || !data) return res.json({ regions: [] })

    const unique = [...new Map(data.map((r) => [r.region_id, r])).values()]
    res.json({ regions: unique })
  } catch (err: unknown) {
    respondWithError(res, err, 'getRegions', { regions: [] })
  }
}

// GET /api/weather/:regionId
export async function getWeatherReadings(req: Request, res: Response) {
  try {
    const regionId = requireRegionId(req.params.regionId)
    const days = parseInteger(req.query.days, { fallback: 30, min: 1, max: 365, name: 'days' })
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('weather_readings')
      .select('value, reading_timestamp, variable')
      .eq('region_id', regionId)
      .gte('reading_timestamp', since)
      .order('reading_timestamp', { ascending: true })

    if (error || !data) return res.json({ readings: [] })

    const normalized = data.map((r) => ({
      ...r,
      displayValue: Number(r.value) / 1e6
    }))

    res.json({ readings: normalized })
  } catch (err: unknown) {
    respondWithError(res, err, 'getWeatherReadings', { readings: [] })
  }
}
