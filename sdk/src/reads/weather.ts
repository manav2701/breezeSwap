import type { WeatherReading } from '../types'
import { fetchJson } from './http'

export async function getWeatherReadings(
  indexerUrl: string,
  regionId: string,
  days = 30,
  chainId: number = 114
): Promise<WeatherReading[]> {
  const data = await fetchJson<{ readings?: any[] }>(
    `${indexerUrl}/api/weather/${regionId}?days=${days}&chainId=${chainId}`,
    () => `Failed to fetch weather data for region: ${regionId}`
  )
  return (data.readings || []).map((r: any) => ({
    regionId,
    regionName: r.region_name || null,
    variable: r.variable || 'RAINFALL',
    value: r.displayValue ?? (Number(r.value) / 1e6),
    readingTimestamp: r.reading_timestamp
  }))
}

export async function getRegions(indexerUrl: string, chainId: number = 114) {
  const data = await fetchJson<{ regions?: any[] }>(
    `${indexerUrl}/api/weather/regions?chainId=${chainId}`,
    () => 'Failed to fetch regions'
  )
  return data.regions || []
}
