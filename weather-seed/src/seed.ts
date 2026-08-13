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

/** Upper case, because the region id is derived from this. See `regionIdFor`. */
export const REGIONS: RegionConfig[] = [
  { name: 'TOKYO', lat: 35.6762, lon: 139.6503 },
  { name: 'SEOUL', lat: 37.5665, lon: 126.9780 },
  { name: 'SINGAPORE', lat: 1.3521, lon: 103.8198 },
  { name: 'DUBAI', lat: 25.2048, lon: 55.2708 },
  { name: 'LONDON', lat: 51.5074, lon: -0.1278 },
];

export type WeatherVariable = 'RAINFALL' | 'TEMPERATURE';

export const WEATHER_VARIABLES: WeatherVariable[] = ['RAINFALL', 'TEMPERATURE'];

/**
 * A region id names a DATA SERIES, not a city.
 *
 * `IWeatherOracle.getReading(regionId, timestamp)` has no weather-variable
 * argument and `MockWeatherOracle` stores `regionId => timestamp => Reading`,
 * so the region id is the only thing separating one series from another.
 * Hashing the city alone put a city's rainfall and temperature in the same
 * slot: seeding 45 mm of rain also told the temperature market that Tokyo had
 * reached 45 degrees. Nothing reverted, because both markets were asking the
 * oracle the same question.
 *
 * Must stay identical to `encodeRegionId` in the SDK and `regionId` in
 * `climatology.ts`, or readings land where nothing reads them.
 */
export function regionIdFor(name: string, variable: WeatherVariable): `0x${string}` {
  return keccak256(toHex(`${name.toUpperCase()}_${variable}`));
}

/** Matches ORACLE_DECIMALS in the contracts. */
const ORACLE_SCALAR = 1e6;

export interface SeedReading {
  region: string;
  variable: WeatherVariable;
  regionId: `0x${string}`;
  date: string;
  timestamp: number;
  /** Natural units: mm for rainfall, degrees C for temperature. */
  value: number;
  /** Fixed-point, as the oracle stores it. */
  valueScaled: string;
}

export interface SeedLog {
  timestamp: string;
  network: string;
  oracleAddress?: string;
  broadcast: boolean;
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

const ORACLE_ABI = [
  {
    type: 'function',
    name: 'setReading',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'regionId', type: 'bytes32' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'value', type: 'int256' },
    ],
    outputs: [],
  },
  // Read side, used to resume an interrupted run. `readings` is the public mapping, so an
  // exact (regionId, timestamp) lookup reports whether that slot was already written.
  // `getReading` is the wrong tool here: it falls back to the latest reading when the exact
  // timestamp is absent, so it would report a present value for a day that was never
  // written and the run would skip it.
  {
    type: 'function',
    name: 'readings',
    stateMutability: 'view',
    inputs: [
      { name: 'regionId', type: 'bytes32' },
      { name: 'timestamp', type: 'uint256' },
    ],
    outputs: [
      { name: 'value', type: 'int256' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'isValid', type: 'bool' },
    ],
  },
] as const;

/**
 * Write the fetched readings to `MockWeatherOracle`.
 *
 * @dev Deliberately opt-in. Fetching is read-only and safe to run at any time;
 * this spends gas and mutates the settlement source every market depends on, so
 * it must never happen as a side effect of collecting data. The caller has to
 * pass `--broadcast` AND supply both env vars.
 *
 * Requires the signing key to hold `ORACLE_UPDATER_ROLE`.
 */
async function postOnChain(readings: SeedReading[]): Promise<boolean> {
  const oracleAddress = process.env.MOCK_WEATHER_ORACLE_ADDRESS as `0x${string}` | undefined;
  const pk = process.env.PRIVATE_KEY as `0x${string}` | undefined;
  const rpcUrl = process.env.COSTON2_RPC ?? 'https://coston2-api.flare.network/ext/C/rpc';

  if (!oracleAddress || !pk) {
    console.log('\nSkipping on-chain write: set MOCK_WEATHER_ORACLE_ADDRESS and PRIVATE_KEY to publish.');
    return false;
  }

  const account = privateKeyToAccount(pk);
  const chain = {
    id: 114,
    name: 'Flare Coston2',
    nativeCurrency: { name: 'Coston2 FLR', symbol: 'C2FLR', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  } as const;

  const wallet = createWalletClient({ account, chain, transport: http(rpcUrl) });
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

  // Pinned rather than estimated. Across hundreds of sequential transactions the difference
  // between the chain's base fee and a client's padded estimate is the difference between
  // finishing the run and stopping half way: the same deployment cost 21.9 C2FLR pinned
  // against a 41 C2FLR estimate. Must stay above the base fee or transactions never mine.
  const gasPrice = process.env.GAS_PRICE_WEI ? BigInt(process.env.GAS_PRICE_WEI) : undefined;
  if (gasPrice) console.log(`gas price pinned at ${Number(gasPrice) / 1e9} gwei`);

  console.log(`\nWriting ${readings.length} readings to ${oracleAddress} as ${account.address}...`);

  let written = 0;
  let skipped = 0;

  for (const r of readings) {
    // Resume rather than restart. 440 readings cost roughly 34 C2FLR at 650 gwei, which is
    // a third of a faucet grant, so a run that stops part-way through is the normal case.
    // Re-writing a reading that is already present costs the same as writing a new one.
    const existing = (await publicClient.readContract({
      address: oracleAddress,
      abi: ORACLE_ABI,
      functionName: 'readings',
      args: [r.regionId, BigInt(r.timestamp)],
    })) as readonly [bigint, bigint, boolean];

    if (existing[2] && existing[0] === BigInt(r.valueScaled)) {
      skipped++;
      continue;
    }

    try {
      const hash = await wallet.writeContract({
        address: oracleAddress,
        abi: ORACLE_ABI,
        functionName: 'setReading',
        args: [r.regionId, BigInt(r.timestamp), BigInt(r.valueScaled)],
        ...(gasPrice ? { gasPrice } : {}),
      });
      await publicClient.waitForTransactionReceipt({ hash });
      written++;
      if (written % 25 === 0) {
        console.log(`  ${written} written, ${skipped} already present, ${readings.length} total`);
      }
    } catch (err: any) {
      // Running out of gas is the expected way this ends, so stop and say where, rather
      // than issuing hundreds of further calls that will each fail the same way.
      const msg = err?.shortMessage ?? err?.message ?? String(err);
      console.error(`\nStopped at ${r.region}/${r.variable} @ ${r.date}: ${msg}`);
      console.error(`Wrote ${written}, skipped ${skipped}. Top up and re-run to continue.`);
      return written > 0;
    }
  }

  console.log(`\nReadings: ${written} written, ${skipped} already present, ${readings.length} total.`);
  if (written === 0 && skipped === readings.length) {
    console.log('Oracle already fully seeded.');
  }
  return written > 0 || skipped > 0;
}

export async function runSeeder(opts: { broadcast?: boolean } = {}) {
  console.log('=== BreezeSwap Open-Meteo Weather Seeder ===');
  const allReadings: SeedReading[] = [];

  for (const region of REGIONS) {
    console.log(`Fetching real weather data for ${region.name}...`);
    const { dates, precip, tempMax } = await fetchOpenMeteoData(region);

    for (let i = 0; i < dates.length; i++) {
      const dateStr = dates[i];
      // Midnight UTC. `WeatherPolicyMarket` samples on an exact grid and treats
      // a non-matching timestamp as absent, so readings must land on the day
      // boundary rather than at an arbitrary fetch time.
      const timestamp = Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 1000);

      const series: Array<[WeatherVariable, number]> = [
        ['RAINFALL', precip[i] ?? 0],
        ['TEMPERATURE', tempMax[i] ?? 0],
      ];

      for (const [variable, value] of series) {
        allReadings.push({
          region: region.name,
          variable,
          regionId: regionIdFor(region.name, variable),
          date: dateStr,
          timestamp,
          value,
          valueScaled: BigInt(Math.round(value * ORACLE_SCALAR)).toString(),
        });
      }
    }
  }

  console.log(
    `Collected ${allReadings.length} readings across ${REGIONS.length} regions x ${WEATHER_VARIABLES.length} variables.`
  );

  let broadcast = false;
  if (opts.broadcast) {
    broadcast = await postOnChain(allReadings);
  } else {
    console.log('\nDry run. Re-run with --broadcast to write these readings on-chain.');
  }

  const seedLog: SeedLog = {
    timestamp: new Date().toISOString(),
    network: 'Coston2',
    oracleAddress: process.env.MOCK_WEATHER_ORACLE_ADDRESS || 'MockOraclePendingDeploy',
    broadcast,
    regionsCount: REGIONS.length,
    totalReadings: allReadings.length,
    readings: allReadings,
  };

  const logPath = path.join(__dirname, '../seed-log.json');
  fs.writeFileSync(logPath, JSON.stringify(seedLog, null, 2));
  console.log(`Wrote seed log to: ${logPath}`);

  return seedLog;
}

if (require.main === module) {
  runSeeder({ broadcast: process.argv.includes('--broadcast') }).catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
}
