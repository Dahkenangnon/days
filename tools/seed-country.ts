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
 *   pnpm tsx tools/seed-country.ts --country BJ --year 2026 --verified-at 2026-05-08
 *
 * What is computed automatically (no manual input needed):
 *   - dayOfWeek, isWeekend, weekNumber, quarter   (pure date arithmetic)
 *   - isWorkingDay                                (!weekend && !isPublicHoliday)
 *   - isRamadanPeriod                             (from country.ramadan range, when set)
 *   - observedDate + substituted holiday entries  (from country.observedDateRule)
 *   - verifiedAt                                  (today, or --verified-at override)
 *
 * What is NOT computed here (patched later by generate-aggregates.ts):
 *   - isFirstWorkingDayOfMonth, isLastWorkingDayOfMonth
 *   - workingDayOfMonth, workingDayOfYear
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

type SubstitutionRule =
  | 'none'
  | 'shift-sunday-to-monday'
  | 'shift-weekend-to-monday'

interface HolidayDef {
  date: string
  name: { fr: string; en: string; [k: string]: string }
  type: 'national' | 'religious' | 'observance' | 'bridge' | 'school'
  religiousAffiliation: 'christian' | 'islamic' | 'secular' | 'animist' | null
  legalBasis: string | null
  source: string | null
  confidence: 'confirmed' | 'tentative' | 'ai-generated'
}

interface RamadanRange {
  start: string
  end: string
}

interface CountryDef {
  timezone: string
  countryName: string
  countryNames: { fr: string; en: string; pt?: string; [k: string]: string | undefined }
  /** Optional. Defaults to 'none' (no weekend-holiday shifting). */
  observedDateRule?: SubstitutionRule
  /** Optional. Map of year → Ramadan start/end (inclusive ISO dates). */
  ramadan?: Record<string, RamadanRange>
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

function isWeekendDate(date: Date): boolean {
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

function toISODate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function assertISODate(s: string, label: string): void {
  if (!ISO_DATE_RE.test(s)) {
    throw new Error(`Invalid ISO date for ${label}: ${s}`)
  }
}

// ---------------------------------------------------------------------------
// Field computation
// ---------------------------------------------------------------------------

/** Inclusive [start, end] check on ISO-date strings (lexicographic == chronological). */
function isInRamadanPeriod(
  dateStr: string,
  ramadan: Record<string, RamadanRange> | undefined,
  year: number,
): boolean {
  if (!ramadan) return false
  const range = ramadan[String(year)]
  if (!range) return false
  return dateStr >= range.start && dateStr <= range.end
}

/**
 * Compute the observed rest day for a holiday that lands on a weekend.
 * Walks forward day-by-day until it finds a non-weekend, non-holiday date.
 * Returns null when the rule is 'none' or the holiday is not on a weekend.
 */
function computeObservedDate(
  holidayDate: Date,
  rule: SubstitutionRule,
  holidayDates: Set<string>,
): string | null {
  if (rule === 'none') return null
  const dow = holidayDate.getUTCDay() // 0=Sun, 6=Sat
  const isSat = dow === 6
  const isSun = dow === 0

  let needsShift = false
  if (rule === 'shift-weekend-to-monday') needsShift = isSat || isSun
  else if (rule === 'shift-sunday-to-monday') needsShift = isSun

  if (!needsShift) return null

  // Walk forward until we find a non-weekend, non-holiday date. Bound the loop
  // so a pathological config (e.g. seven consecutive holidays) cannot hang.
  const candidate = new Date(holidayDate)
  for (let i = 0; i < 14; i++) {
    candidate.setUTCDate(candidate.getUTCDate() + 1)
    const cdow = candidate.getUTCDay()
    const cstr = toISODate(candidate)
    if (cdow !== 0 && cdow !== 6 && !holidayDates.has(cstr)) {
      return cstr
    }
  }
  return null
}

/**
 * Expand the source-defined holiday list with synthetic "observance" entries
 * for substituted weekend holidays, so the substituted day is itself flagged
 * as a public holiday with consistent metadata.
 */
function expandWithSubstitutes(
  defined: HolidayDef[],
  rule: SubstitutionRule,
): { expanded: Map<string, HolidayDef>; observedDateOf: Map<string, string> } {
  const byDate = new Map<string, HolidayDef>(defined.map(h => [h.date, h]))
  const observedDateOf = new Map<string, string>()
  const definedDates = new Set(byDate.keys())

  if (rule === 'none') return { expanded: byDate, observedDateOf }

  for (const h of defined) {
    assertISODate(h.date, `holiday ${h.name?.en ?? h.date}`)
    const [y, m, d] = h.date.split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, d))
    const observed = computeObservedDate(date, rule, definedDates)
    if (!observed) continue

    observedDateOf.set(h.date, observed)

    // Avoid clobbering an existing holiday on the substituted date.
    if (!byDate.has(observed)) {
      byDate.set(observed, {
        ...h,
        date: observed,
        type: 'observance',
      })
    }
  }
  return { expanded: byDate, observedDateOf }
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

async function seedCountryYear(
  countryCode: string,
  year: number,
  def: CountryDef,
  verifiedAt: string,
  dryRun: boolean,
): Promise<void> {
  const definedHolidays = def.holidays[String(year)] ?? []
  const rule: SubstitutionRule = def.observedDateRule ?? 'none'
  const { expanded: holidays, observedDateOf } = expandWithSubstitutes(definedHolidays, rule)

  let filesWritten = 0

  for (let month = 1; month <= 12; month++) {
    const numDays = daysInMonth(year, month)

    for (let day = 1; day <= numDays; day++) {
      const dateStr = `${year}-${pad2(month)}-${pad2(day)}`
      const date = new Date(Date.UTC(year, month - 1, day))

      const weekend = isWeekendDate(date)
      const holiday = holidays.get(dateStr)
      const isPublicHoliday = !!holiday
      const isWorkingDay = !weekend && !isPublicHoliday
      const observedDate = observedDateOf.get(dateStr) ?? null

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
        isRamadanPeriod: isInRamadanPeriod(dateStr, def.ramadan, year),
        holidayName: holiday?.name ?? null,
        holidayType: holiday?.type ?? null,
        religiousAffiliation: holiday?.religiousAffiliation ?? null,
        observedDate,
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
      'verified-at': { type: 'string' },
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
    console.error(
      'Usage: tsx tools/seed-country.ts --country BJ --year 2026 [--verified-at YYYY-MM-DD] [--dry-run]',
    )
    process.exit(1)
  }

  const verifiedAt = values['verified-at'] ?? todayISO()
  assertISODate(verifiedAt, '--verified-at')

  const sourcesRaw = await readFile(SOURCES_PATH, 'utf-8')
  const sources: Sources = JSON.parse(sourcesRaw)

  for (const code of countryCodes) {
    const def = sources[code]
    if (!def) {
      console.error(`Unknown country: ${code}. Check tools/sources.json.`)
      process.exit(1)
    }
    for (const year of years) {
      await seedCountryYear(code, year, def, verifiedAt, values['dry-run'] ?? false)
    }
  }
}

main().catch(err => { console.error(err); process.exit(1) })
