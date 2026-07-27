import type { WeatherReading } from '../types'

export async function getWeatherReadings(
  indexerUrl: string,
  regionId: string,
  days = 30,
  chainId: number = 114
): Promise<WeatherReading[]> {
  const res = await fetch(`${indexerUrl}/api/weather/${regionId}?days=${days}&chainId=${chainId}`)
  if (!res.ok) throw new Error(`Failed to fetch weather data for region: ${regionId}`)
  const data = await res.json()
  return (data.readings || []).map((r: any) => ({
    regionId,
    regionName: r.region_name || null,
    variable: r.variable || 'RAINFALL',
    value: r.displayValue ?? (Number(r.value) / 1e6),
    readingTimestamp: r.reading_timestamp
  }))
}

export async function getRegions(indexerUrl: string, chainId: number = 114) {
  const res = await fetch(`${indexerUrl}/api/weather/regions?chainId=${chainId}`)
  if (!res.ok) throw new Error('Failed to fetch regions')
  const data = await res.json()
  return data.regions || []
}
