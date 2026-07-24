import fs from 'fs';
import path from 'path';
import { keccak256, toHex, createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../../contracts/.env') });

export interface RegionConfig {
  name: string;
  lat: number;
  lon: number;
}

export const REGIONS: RegionConfig[] = [
  { name: 'TOKYO', lat: 35.6762, lon: 139.6503 },
  { name: 'SEOUL', lat: 37.5665, lon: 126.9780 },
  { name: 'SINGAPORE', lat: 1.3521, lon: 103.8198 },
  { name: 'DUBAI', lat: 25.2048, lon: 55.2708 },
  { name: 'LONDON', lat: 51.5074, lon: -0.1278 },
];

export interface SeedReading {
  region: string;
  regionId: string;
  date: string;
  timestamp: number;
  precipitation_mm: number;
  precipitation_scaled: string; // BigInt represented as string for JSON
  temp_max_c: number;
  temp_max_scaled: string;
}

export interface SeedLog {
  timestamp: string;
  network: string;
  oracleAddress?: string;
  regionsCount: number;
  totalReadings: number;
  readings: SeedReading[];
}

/**
 * Fetch daily rainfall and temperature for a region from Open-Meteo API.
 */
async function fetchOpenMeteoData(region: RegionConfig): Promise<{ dates: string[]; precip: number[]; tempMax: number[] }> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${region.lat}&longitude=${region.lon}&daily=precipitation_sum,temperature_2m_max&past_days=30&forecast_days=14&timezone=UTC`;
  
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch Open-Meteo data for ${region.name}: ${res.statusText}`);
  }

  const data = await res.json();
  return {
    dates: data.daily.time,
    precip: data.daily.precipitation_sum,
    tempMax: data.daily.temperature_2m_max,
  };
}

export async function runSeeder(oracleAddress?: string) {
  console.log('=== BreezeSwap Open-Meteo Weather Seeder ===');
  const allReadings: SeedReading[] = [];

  for (const region of REGIONS) {
    console.log(`Fetching real weather data for ${region.name}...`);
    const { dates, precip, tempMax } = await fetchOpenMeteoData(region);

    const regionId = keccak256(toHex(region.name));

    for (let i = 0; i < dates.length; i++) {
      const dateStr = dates[i];
      const timestamp = Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 1000);
      const precipMm = precip[i] ?? 0;
      const tempC = tempMax[i] ?? 0;

      // Convert to fixed-point integer (6 decimals: mm * 1e6)
      const precipScaled = BigInt(Math.round(precipMm * 1e6));
      const tempScaled = BigInt(Math.round(tempC * 1e6));

      allReadings.push({
        region: region.name,
        regionId,
        date: dateStr,
        timestamp,
        precipitation_mm: precipMm,
        precipitation_scaled: precipScaled.toString(),
        temp_max_c: tempC,
        temp_max_scaled: tempScaled.toString(),
      });
    }
  }

  console.log(`Total readings collected across ${REGIONS.length} regions: ${allReadings.length}`);

  // Save log summary to seed-log.json
  const seedLog: SeedLog = {
    timestamp: new Date().toISOString(),
    network: 'Coston2',
    oracleAddress: oracleAddress || 'MockOraclePendingDeploy',
    regionsCount: REGIONS.length,
    totalReadings: allReadings.length,
    readings: allReadings,
  };

  const logPath = path.join(__dirname, '../seed-log.json');
  fs.writeFileSync(logPath, JSON.stringify(seedLog, null, 2));
  console.log(`Successfully generated seed log at: ${logPath}`);

  return seedLog;
}

if (require.main === module) {
  const oracleAddr = process.env.MOCK_ORACLE_ADDRESS;
  runSeeder(oracleAddr).catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
}
