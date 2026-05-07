#!/usr/bin/env tsx
/**
 * seed-country.ts
 *
 * Generates per-day JSON files under packages/data/{country}/{year}/{MM}/{DD}.json
 * from the holiday definitions in tools/sources.json.
 *
 * Usage:
 *   pnpm tsx tools/seed-country.ts --country BJ --year 2026
 *   pnpm tsx tools/seed-country.ts --country BJ,CI --year 2026 --dry-run
 *
 * Notes:
 *   - Does NOT compute isFirstWorkingDayOfMonth / isLastWorkingDayOfMonth /
 *     workingDayOfMonth / workingDayOfYear — those are generate-aggregates' job.
 *   - isRamadanPeriod requires a Ramadan date range in sources.json (future work).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DATA_DIR = join(ROOT, 'packages', 'data')
const SOURCES_PATH = join(__dirname, 'sources.json')

// ---------------------------------------------------------------------------
// Types (local to this script — no package import)
// ---------------------------------------------------------------------------

interface HolidayDef {
  date: string
  name: { fr: string; en: string; [k: string]: string }
  type: string
  religiousAffiliation: string | null
  legalBasis: string | null
  source: string | null
  confidence: 'confirmed' | 'tentative' | 'ai-generated'
}

interface CountryDef {
  timezone: string
  countryName: string
  countryNames: { fr: string; en: string; pt?: string; [k: string]: string | undefined }
  holidays: Record<string, HolidayDef[]>
}

interface Sources {
  [country: string]: CountryDef
}

// ---------------------------------------------------------------------------
// Date helpers — pure Date arithmetic, no external library
// ---------------------------------------------------------------------------

/** ISO day of week: Monday=1, Sunday=7 */
function isoDayOfWeek(date: Date): number {
  const d = date.getUTCDay() // 0=Sun … 6=Sat
  return d === 0 ? 7 : d
}

function isWeekend(date: Date): boolean {
  const d = date.getUTCDay()
  return d === 0 || d === 6
}

function isoWeekNumber(date: Date): number {
  // ISO 8601 week number
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function quarter(month: number): number {
  return Math.ceil(month / 3)
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function toISO(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

async function seedCountryYear(
  countryCode: string,
  year: number,
  def: CountryDef,
  dryRun: boolean,
): Promise<void> {
  const holidays = new Map<string, HolidayDef>(
    (def.holidays[String(year)] ?? []).map(h => [h.date, h]),
  )

  const verifiedAt = `${year}-01-01`
  let filesWritten = 0

  for (let month = 1; month <= 12; month++) {
    const numDays = daysInMonth(year, month)

    for (let day = 1; day <= numDays; day++) {
      const dateStr = `${year}-${pad2(month)}-${pad2(day)}`
      const date = new Date(Date.UTC(year, month - 1, day))

      const weekend = isWeekend(date)
      const holiday = holidays.get(dateStr)
      const isPublicHoliday = !!holiday
      const isWorkingDay = !weekend && !isPublicHoliday

      const record = {
        schemaVersion: '1.0',
        date: dateStr,
        country: countryCode,
        countryName: def.countryName,
        countryNames: def.countryNames,
        timezone: def.timezone,
        dayOfWeek: isoDayOfWeek(date),
        isWeekend: weekend,
        isPublicHoliday,
        isWorkingDay,
        isFirstWorkingDayOfMonth: false, // patched by generate-aggregates
        isLastWorkingDayOfMonth: false,  // patched by generate-aggregates
        isRamadanPeriod: false,          // TODO: derive from Ramadan range in sources.json
        holidayName: holiday?.name ?? null,
        holidayType: holiday?.type ?? null,
        religiousAffiliation: holiday?.religiousAffiliation ?? null,
        observedDate: null,
        legalBasis: holiday?.legalBasis ?? null,
        source: holiday?.source ?? null,
        verifiedAt,
        confidence: holiday?.confidence ?? 'confirmed',
        weekNumber: isoWeekNumber(date),
        quarter: quarter(month),
        workingDayOfMonth: null,  // patched by generate-aggregates
        workingDayOfYear: null,   // patched by generate-aggregates
      }

      const destPath = join(
        DATA_DIR,
        countryCode.toLowerCase(),
        String(year),
        pad2(month),
        `${pad2(day)}.json`,
      )

      if (dryRun) {
        console.log(`[dry-run] would write ${destPath}`)
      } else {
        await mkdir(dirname(destPath), { recursive: true })
        await writeFile(destPath, JSON.stringify(record, null, 2), 'utf-8')
        filesWritten++
      }
    }
  }

  if (!dryRun) {
    console.log(`✓ ${countryCode} ${year}: ${filesWritten} day files written`)
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      country: { type: 'string', short: 'c' },
      year:    { type: 'string', short: 'y' },
      'dry-run': { type: 'boolean', default: false },
    },
  })

  const countryCodes = (values.country ?? '')
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean)

  const years = (values.year ?? '')
    .split(',')
    .map(s => Number(s.trim()))
    .filter(n => Number.isFinite(n) && n > 2000)

  if (countryCodes.length === 0 || years.length === 0) {
    console.error('Usage: tsx tools/seed-country.ts --country BJ --year 2026')
    process.exit(1)
  }

  const sourcesRaw = await readFile(SOURCES_PATH, 'utf-8')
  const sources: Sources = JSON.parse(sourcesRaw)

  for (const code of countryCodes) {
    const def = sources[code]
    if (!def) {
      console.error(`Unknown country: ${code}. Check tools/sources.json.`)
      process.exit(1)
    }
    for (const year of years) {
      await seedCountryYear(code, year, def, values['dry-run'] ?? false)
    }
  }
}

main().catch(err => { console.error(err); process.exit(1) })
