import fs from 'fs'
import path from 'path'
import { keccak256, toHex, createWalletClient, createPublicClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import dotenv from 'dotenv'
import { REGIONS, regionIdFor, type RegionConfig } from './seed'

dotenv.config({ path: path.join(__dirname, '../../.env') })
dotenv.config({ path: path.join(__dirname, '../../contracts/.env') })

/**
 * Builds the historical strike probabilities that price BreezeSwap policies.
 *
 * Without these, a weather contract has no price: both sides post equal
 * collateral, which silently claims every outcome is a coin flip. If a
 * threshold has been breached in 27 of the last 30 years, whoever takes the
 * "yes" side at even money loses by construction.
 *
 * This script pulls multi-decade daily history from the Open-Meteo archive,
 * aggregates it into monthly totals, and counts how often each strike was
 * actually breached. That frequency is the fair price.
 */

/** Matches ORACLE_DECIMALS in the contracts. */
const ORACLE_SCALAR = 1_000_000n

/** Contracts refuse to price against a thinner record than this. */
const MIN_SAMPLE_YEARS = 10

const YEARS_OF_HISTORY = 30

/** Every rainfall strike worth pricing, in mm of monthly total. */
const ALL_RAINFALL_THRESHOLDS_MM = [10, 20, 40, 60, 80, 120, 160, 200, 300]

/**
 * Thresholds actually published, overridable with `CLIMATOLOGY_THRESHOLDS`.
 *
 * Each strike is one transaction, so the full set across five regions, twelve months and
 * both directions is 1,080 of them, around 42 C2FLR at 700 gwei. That is more than a single
 * faucet grant, and gas is the binding constraint on a testnet rather than anything about
 * the data.
 *
 * Publishing a subset is safe because it is not lossy in any permanent sense: `isPriced`
 * gates per strike, an unpriced strike leaves a market unpriced rather than mispriced, and
 * the publisher skips whatever is already on-chain. So the remaining thresholds can be
 * added later by re-running with a wider list and nothing is repaid.
 *
 *   CLIMATOLOGY_THRESHOLDS=10,20,40,60,80,120,160,200,300 pnpm climatology
 */
const RAINFALL_THRESHOLDS_MM = (() => {
  const raw = process.env.CLIMATOLOGY_THRESHOLDS
  if (!raw) return ALL_RAINFALL_THRESHOLDS_MM

  const parsed = raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)

  if (parsed.length === 0) {
    throw new Error(`CLIMATOLOGY_THRESHOLDS set but parsed to nothing: "${raw}"`)
  }
  return parsed
})()

const WEATHER_VARIABLE_RAINFALL = 0

/**
 * Expected value of a SINGLE oracle reading for a region-month.
 *
 * Distinct from the strike probabilities above, and the distinction matters. Strikes are
 * priced off MONTHLY TOTALS. A perpetual market's index price is one reading, so the
 * figure it needs is mean DAILY rainfall — posting a monthly total would compare a
 * daily-scale mark against a monthly-scale level and be wrong by roughly thirty times.
 * `BreezePerpFactory` uses this to refuse a market whose opening mark is nowhere near the
 * climate it tracks.
 */
export interface ClimatologyLevel {
  region: string
  regionId: `0x${string}`
  monthOfYear: number
  /** Mean daily total, in the variable's natural units. */
  expectedDailyMm: number
  /** In the oracle's fixed-point units. */
  expectedLevelScaled: string
  sampleYears: number
}

export interface StrikeProbability {
  region: string
  regionId: `0x${string}`
  variable: number
  triggerBelow: boolean
  thresholdMm: number
  /** Threshold in the oracle's fixed-point units. */
  thresholdScaled: string
  monthOfYear: number
  probabilityBps: number
  sampleYears: number
  /** Monthly totals the figure was derived from, for auditability. */
  observedTotalsMm: number[]
}

/**
 * @dev Delegates to the seeder's helper rather than re-deriving the hash. These
 * two files had drifted to different schemes once already, which put the
 * probabilities and the readings under different ids so neither could find the
 * other. One definition, imported.
 */
function regionId(name: string): `0x${string}` {
  return regionIdFor(name, 'RAINFALL')
}

/**
 * Daily precipitation for the last `YEARS_OF_HISTORY` complete years.
 *
 * Uses the archive endpoint rather than the forecast endpoint — the forecast
 * API only reaches back ~92 days, which is nowhere near enough to establish a
 * frequency.
 */
async function fetchArchive(
  region: RegionConfig,
  startYear: number,
  endYear: number
): Promise<{ dates: string[]; precip: (number | null)[] }> {
  const url =
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${region.lat}&longitude=${region.lon}` +
    `&start_date=${startYear}-01-01&end_date=${endYear}-12-31` +
    `&daily=precipitation_sum&timezone=UTC`

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Open-Meteo archive failed for ${region.name}: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()
  if (!data?.daily?.time) {
    throw new Error(`Open-Meteo archive returned no daily series for ${region.name}`)
  }

  return { dates: data.daily.time, precip: data.daily.precipitation_sum }
}

/**
 * Collapse daily readings into one total per (year, month).
 *
 * Months missing more than a few days are dropped rather than under-counted —
 * a month with half its days absent would look artificially dry and would bias
 * every strike priced from it.
 */
function monthlyTotals(
  dates: string[],
  precip: (number | null)[]
): Map<number, Map<number, number>> {
  const byMonth = new Map<number, Map<number, { total: number; days: number }>>()

  for (let i = 0; i < dates.length; i++) {
    const value = precip[i]
    if (value === null || value === undefined || Number.isNaN(value)) continue

    const [yearStr, monthStr] = dates[i].split('-')
    const year = Number(yearStr)
    const month = Number(monthStr)

    if (!byMonth.has(month)) byMonth.set(month, new Map())
    const years = byMonth.get(month)!
    const entry = years.get(year) ?? { total: 0, days: 0 }
    entry.total += value
    entry.days += 1
    years.set(year, entry)
  }

  const result = new Map<number, Map<number, number>>()
  for (const [month, years] of byMonth) {
    const cleaned = new Map<number, number>()
    for (const [year, { total, days }] of years) {
      const daysInMonth = new Date(year, month, 0).getDate()
      if (days >= daysInMonth - 2) cleaned.set(year, total)
    }
    result.set(month, cleaned)
  }
  return result
}

function computeProbabilities(region: RegionConfig, totals: Map<number, Map<number, number>>) {
  const out: StrikeProbability[] = []

  for (const [month, years] of totals) {
    const observed = [...years.values()]
    if (observed.length < MIN_SAMPLE_YEARS) continue

    for (const thresholdMm of RAINFALL_THRESHOLDS_MM) {
      // Drought cover: pays when the month comes in BELOW the strike.
      const below = observed.filter((t) => t < thresholdMm).length
      // Flood cover: pays when it comes in ABOVE.
      const above = observed.filter((t) => t > thresholdMm).length

      for (const [triggerBelow, hits] of [
        [true, below],
        [false, above],
      ] as const) {
        out.push({
          region: region.name,
          regionId: regionId(region.name),
          variable: WEATHER_VARIABLE_RAINFALL,
          triggerBelow,
          thresholdMm,
          thresholdScaled: (BigInt(thresholdMm) * ORACLE_SCALAR).toString(),
          monthOfYear: month,
          probabilityBps: Math.round((hits / observed.length) * 10000),
          sampleYears: observed.length,
          observedTotalsMm: observed.map((t) => Number(t.toFixed(1))),
        })
      }
    }
  }

  return out
}

/**
 * Mean daily rainfall per month, across every year with a usable record.
 *
 * Averaged as `sum(totals) / sum(days)` rather than as the mean of per-year daily means,
 * so a month with more observed days carries proportionally more weight — which is right,
 * because the quantity being estimated is the expectation of one day's reading.
 */
function computeLevels(
  region: RegionConfig,
  totals: Map<number, Map<number, number>>
): ClimatologyLevel[] {
  const out: ClimatologyLevel[] = []

  for (const [month, years] of totals) {
    if (years.size < MIN_SAMPLE_YEARS) continue

    let totalMm = 0
    let totalDays = 0
    for (const [year, total] of years) {
      totalMm += total
      totalDays += new Date(year, month, 0).getDate()
    }
    if (totalDays === 0) continue

    const expectedDailyMm = totalMm / totalDays
    out.push({
      region: region.name,
      regionId: regionId(region.name),
      monthOfYear: month,
      expectedDailyMm: Number(expectedDailyMm.toFixed(3)),
      // Rounded, and floored at 1 unit: the contract rejects a zero level, and a region
      // that genuinely averages under 0.000001mm/day is not one to open a market on.
      expectedLevelScaled: String(
        BigInt(Math.max(1, Math.round(expectedDailyMm * Number(ORACLE_SCALAR))))
      ),
      sampleYears: years.size,
    })
  }

  return out
}

const STRIKE_ORACLE_ABI = [
  {
    type: 'function',
    name: 'setClimatologyLevel',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'regionId', type: 'bytes32' },
      { name: 'monthOfYear', type: 'uint8' },
      { name: 'level', type: 'uint256' },
      { name: 'sampleYears', type: 'uint16' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setStrikeProbability',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'regionId', type: 'bytes32' },
      { name: 'variable', type: 'uint8' },
      { name: 'triggerBelow', type: 'bool' },
      { name: 'threshold', type: 'uint256' },
      { name: 'monthOfYear', type: 'uint8' },
      { name: 'probabilityBps', type: 'uint32' },
      { name: 'sampleYears', type: 'uint16' },
    ],
    outputs: [],
  },
  // Read side, used to resume an interrupted run instead of re-paying for strikes that
  // are already on-chain.
  {
    type: 'function',
    name: 'strikeKey',
    stateMutability: 'pure',
    inputs: [
      { name: 'regionId', type: 'bytes32' },
      { name: 'variable', type: 'uint8' },
      { name: 'triggerBelow', type: 'bool' },
      { name: 'threshold', type: 'uint256' },
      { name: 'monthOfYear', type: 'uint8' },
    ],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'isPriced',
    stateMutability: 'view',
    inputs: [{ name: 'key', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'levelKey',
    stateMutability: 'pure',
    inputs: [
      { name: 'regionId', type: 'bytes32' },
      { name: 'monthOfYear', type: 'uint8' },
    ],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'isLevelSet',
    stateMutability: 'view',
    inputs: [{ name: 'key', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

async function postOnChain(strikes: StrikeProbability[], levels: ClimatologyLevel[]) {
  const oracleAddress = process.env.STRIKE_PROBABILITY_ORACLE as `0x${string}` | undefined
  const pk = process.env.PRIVATE_KEY as `0x${string}` | undefined
  const rpcUrl = process.env.COSTON2_RPC ?? 'https://coston2-api.flare.network/ext/C/rpc'

  if (!oracleAddress || !pk) {
    console.log(
      '\nSkipping on-chain posting — set STRIKE_PROBABILITY_ORACLE and PRIVATE_KEY to publish.'
    )
    return
  }

  const account = privateKeyToAccount(pk)
  const chain = {
    id: 114,
    name: 'Flare Coston2',
    nativeCurrency: { name: 'Coston2 FLR', symbol: 'C2FLR', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  } as const

  const wallet = createWalletClient({ account, chain, transport: http(rpcUrl) })
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) })

  // Pinned rather than estimated, for the same reason as the reading seeder: over a
  // thousand sequential transactions, a padded fee estimate is the difference between
  // finishing and running dry. Must stay above the chain's base fee.
  const gasPrice = process.env.GAS_PRICE_WEI ? BigInt(process.env.GAS_PRICE_WEI) : undefined
  if (gasPrice) console.log(`gas price pinned at ${Number(gasPrice) / 1e9} gwei`)

  // Levels are published BEFORE strikes, deliberately.
  //
  // There are only 60 of them against 1,080 strikes, so they are roughly 2 C2FLR of the
  // 44 this run costs, and they are what `BreezePerpFactory._checkInitialMark` consults to
  // refuse a market opening at a mark unrelated to the climate it tracks. Publishing the
  // expensive half first meant any run that ran out of gas part-way left the cheap,
  // creation-gating half unwritten.
  console.log(`\nPosting ${levels.length} expected levels to ${oracleAddress}...`)

  let levelsWritten = 0
  let levelsSkipped = 0

  for (const l of levels) {
    const key = await publicClient.readContract({
      address: oracleAddress,
      abi: STRIKE_ORACLE_ABI,
      functionName: 'levelKey',
      args: [l.regionId, l.monthOfYear],
    })

    if (await publicClient.readContract({
      address: oracleAddress,
      abi: STRIKE_ORACLE_ABI,
      functionName: 'isLevelSet',
      args: [key],
    })) {
      levelsSkipped++
      continue
    }

    try {
      const hash = await wallet.writeContract({
        address: oracleAddress,
        abi: STRIKE_ORACLE_ABI,
        functionName: 'setClimatologyLevel',
        args: [l.regionId, l.monthOfYear, BigInt(l.expectedLevelScaled), l.sampleYears],
        ...(gasPrice ? { gasPrice } : {}),
      })
      await publicClient.waitForTransactionReceipt({ hash })
      levelsWritten++
      console.log(
        `  ${l.region} m${l.monthOfYear} mean daily = ${l.expectedDailyMm.toFixed(2)}mm`
      )
    } catch (err: any) {
      const msg = err?.shortMessage ?? err?.message ?? String(err)
      console.error(`\nStopped at level ${l.region} m${l.monthOfYear}: ${msg}`)
      console.error(`Levels: ${levelsWritten} written. Top up and re-run to continue.`)
      return
    }
  }

  console.log(`\nLevels: ${levelsWritten} written, ${levelsSkipped} already present.`)
  console.log(`\nPosting ${strikes.length} strike probabilities to ${oracleAddress}...`)

  let written = 0
  let skipped = 0

  for (const s of strikes) {
    // Resume rather than restart. This is 1,080 sequential transactions costing roughly
    // 39 C2FLR at 650 gwei, which is more than a single faucet grant, so being interrupted
    // part-way is the normal case rather than the exception. Re-posting a strike that is
    // already on-chain writes the same value for the same money, so the run asks first.
    const key = await publicClient.readContract({
      address: oracleAddress,
      abi: STRIKE_ORACLE_ABI,
      functionName: 'strikeKey',
      args: [s.regionId, s.variable, s.triggerBelow, BigInt(s.thresholdScaled), s.monthOfYear],
    })

    if (await publicClient.readContract({
      address: oracleAddress,
      abi: STRIKE_ORACLE_ABI,
      functionName: 'isPriced',
      args: [key],
    })) {
      skipped++
      continue
    }

    try {
      const hash = await wallet.writeContract({
        address: oracleAddress,
        abi: STRIKE_ORACLE_ABI,
        functionName: 'setStrikeProbability',
        args: [
          s.regionId,
          s.variable,
          s.triggerBelow,
          BigInt(s.thresholdScaled),
          s.monthOfYear,
          s.probabilityBps,
          s.sampleYears,
        ],
        ...(gasPrice ? { gasPrice } : {}),
      })
      await publicClient.waitForTransactionReceipt({ hash })
      written++
      if (written % 25 === 0) {
        console.log(`  ${written} written, ${skipped} already present, ${strikes.length} total`)
      }
    } catch (err: any) {
      // Out of gas is the expected way this run ends, so say so plainly and stop rather
      // than hammering the RPC for the remaining hundreds of strikes.
      const msg = err?.shortMessage ?? err?.message ?? String(err)
      console.error(`\nStopped at ${s.region} m${s.monthOfYear} ${s.thresholdMm}mm: ${msg}`)
      console.error(`Wrote ${written}, skipped ${skipped}. Top up and re-run to continue.`)
      return
    }
  }

  console.log(`\nStrikes: ${written} written, ${skipped} already present.`)
  console.log('Climatology publishing complete.')
}

async function main() {
  const endYear = new Date().getUTCFullYear() - 1 // last complete year
  const startYear = endYear - YEARS_OF_HISTORY + 1

  console.log(`BreezeSwap climatology — ${startYear}-${endYear} (${YEARS_OF_HISTORY} years)\n`)

  const all: StrikeProbability[] = []
  const allLevels: ClimatologyLevel[] = []

  for (const region of REGIONS) {
    process.stdout.write(`Fetching ${region.name}... `)
    const { dates, precip } = await fetchArchive(region, startYear, endYear)
    const totals = monthlyTotals(dates, precip)
    const strikes = computeProbabilities(region, totals)
    const levels = computeLevels(region, totals)
    all.push(...strikes)
    allLevels.push(...levels)
    console.log(
      `${dates.length} days -> ${strikes.length} priced strikes, ${levels.length} levels`
    )

    // Show one month so the numbers are legible rather than just a count.
    const august = totals.get(8)
    if (august && august.size > 0) {
      const vals = [...august.values()].sort((a, b) => a - b)
      const median = vals[Math.floor(vals.length / 2)]
      console.log(
        `    August total rainfall: median ${median.toFixed(0)}mm, ` +
          `min ${vals[0].toFixed(0)}mm, max ${vals[vals.length - 1].toFixed(0)}mm ` +
          `across ${vals.length} years`
      )
    }
  }

  const outPath = path.join(__dirname, '../climatology.json')
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: 'Open-Meteo Archive API',
        startYear,
        endYear,
        minSampleYears: MIN_SAMPLE_YEARS,
        strikeCount: all.length,
        strikes: all,
        // Mean DAILY level per region-month, for the perp factory's opening-mark check.
        // Deliberately separate from `strikes`, which are priced off monthly totals.
        levelCount: allLevels.length,
        levels: allLevels,
      },
      null,
      2
    )
  )
  console.log(
    `\nWrote ${all.length} strike probabilities and ${allLevels.length} expected levels to ${outPath}`
  )

  await postOnChain(all, allLevels)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
