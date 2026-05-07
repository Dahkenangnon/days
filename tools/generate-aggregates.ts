#!/usr/bin/env tsx
/**
 * generate-aggregates.ts
 *
 * Reads all per-day JSON files for a given country + year and:
 *   1. Validates each against day.schema.json (exits 1 if any fail)
 *   2. Patches the 4 computed fields on each day file:
 *        isFirstWorkingDayOfMonth, isLastWorkingDayOfMonth,
 *        workingDayOfMonth, workingDayOfYear
 *   3. Writes 12 month aggregate files: packages/data/{country}/{year}/{MM}.json
 *   4. Writes 1 year summary file:     packages/data/{country}/{year}.json
 *   5. Validates all written aggregate files against month/year schemas
 *
 * Usage:
 *   pnpm generate -- --year 2026
 *   pnpm generate -- --year 2026 --country BJ
 *   pnpm generate -- --year 2026 --country BJ --dry-run
 */

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import Ajv from 'ajv/dist/2020'
import addFormats from 'ajv-formats'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DATA_DIR = join(ROOT, 'packages', 'data')
const SCHEMA_DIR = join(DATA_DIR, 'schema')

// ---------------------------------------------------------------------------
// AJV setup
// ---------------------------------------------------------------------------

const ajv = new Ajv({ allErrors: true })
addFormats(ajv)

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

// ---------------------------------------------------------------------------
// Types (local to this script)
// ---------------------------------------------------------------------------

interface DayRecord {
  schemaVersion: string
  date: string
  country: string
  countryName: string
  countryNames: Record<string, string>
  timezone: string
  dayOfWeek: number
  isWeekend: boolean
  isPublicHoliday: boolean
  isWorkingDay: boolean
  isFirstWorkingDayOfMonth: boolean
  isLastWorkingDayOfMonth: boolean
  isRamadanPeriod: boolean
  holidayName: Record<string, string> | null
  holidayType: string | null
  religiousAffiliation: string | null
  observedDate: string | null
  legalBasis: string | null
  source: string | null
  verifiedAt: string
  confidence: string
  weekNumber: number
  quarter: number
  workingDayOfMonth: number | null
  workingDayOfYear: number | null
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

async function generateForCountryYear(
  countryCode: string,
  year: number,
  schemas: { day: unknown; month: unknown; year: unknown },
  dryRun: boolean,
): Promise<void> {
  const validateDay = ajv.compile(schemas.day as object)
  const validateMonth = ajv.compile(schemas.month as object)
  const validateYear = ajv.compile(schemas.year as object)

  // 1. Read all day files
  const allDays: DayRecord[] = []
  let hasError = false

  for (let month = 1; month <= 12; month++) {
    const numDays = daysInMonth(year, month)
    for (let day = 1; day <= numDays; day++) {
      const filePath = join(
        DATA_DIR,
        countryCode.toLowerCase(),
        String(year),
        pad2(month),
        `${pad2(day)}.json`,
      )
      let raw: string
      try {
        raw = await readFile(filePath, 'utf-8')
      } catch {
        console.error(`Missing day file: ${filePath}`)
        hasError = true
        continue
      }

      let record: DayRecord
      try {
        record = JSON.parse(raw)
      } catch {
        console.error(`Invalid JSON in: ${filePath}`)
        hasError = true
        continue
      }

      if (!validateDay(record)) {
        console.error(`Schema validation failed: ${filePath}`)
        for (const err of validateDay.errors ?? []) {
          console.error(`  ${err.instancePath} ${err.message}`)
        }
        hasError = true
        continue
      }

      allDays.push(record)
    }
  }

  if (hasError) {
    console.error(`\nAborting: validation errors found for ${countryCode} ${year}`)
    process.exit(1)
  }

  // 2. Compute working day ordinals (year-wide pass)
  let workingDayOfYear = 0
  const workingDayOfYearMap = new Map<string, number>()

  for (const d of allDays) {
    if (d.isWorkingDay) {
      workingDayOfYear++
      workingDayOfYearMap.set(d.date, workingDayOfYear)
    }
  }

  // 3. Process month by month — compute all 4 fields
  const monthsData: { month: number; days: DayRecord[] }[] = []

  for (let month = 1; month <= 12; month++) {
    const monthDays = allDays.filter(d => {
      const m = parseInt(d.date.slice(5, 7), 10)
      return m === month
    })

    const workingDays = monthDays.filter(d => d.isWorkingDay)
    const firstWorking = workingDays[0]?.date ?? null
    const lastWorking = workingDays[workingDays.length - 1]?.date ?? null

    let workingDayOfMonth = 0
    for (const d of monthDays) {
      if (d.isWorkingDay) workingDayOfMonth++
      d.isFirstWorkingDayOfMonth = d.date === firstWorking
      d.isLastWorkingDayOfMonth = d.date === lastWorking
      d.workingDayOfMonth = d.isWorkingDay ? workingDayOfMonth : null
      d.workingDayOfYear = workingDayOfYearMap.get(d.date) ?? null
    }

    monthsData.push({ month, days: monthDays })
  }

  // 4. Write patched day files
  if (!dryRun) {
    for (const d of allDays) {
      const [, mm, dd] = d.date.split('-')
      const filePath = join(
        DATA_DIR,
        countryCode.toLowerCase(),
        String(year),
        mm,
        `${dd}.json`,
      )
      await writeFile(filePath, JSON.stringify(d, null, 2), 'utf-8')
    }
    console.log(`✓ ${countryCode} ${year}: patched ${allDays.length} day files`)
  }

  // 5. Build and write month aggregates
  const meta = {
    schemaVersion: '1.0',
    country: countryCode,
    countryName: allDays[0].countryName,
    countryNames: allDays[0].countryNames,
    timezone: allDays[0].timezone,
    year,
  }

  for (const { month, days } of monthsData) {
    const monthRecord = {
      ...meta,
      month,
      workingDaysCount: days.filter(d => d.isWorkingDay).length,
      weekendDaysCount: days.filter(d => d.isWeekend).length,
      publicHolidaysCount: days.filter(d => d.isPublicHoliday).length,
      days: days.map(d => ({
        date: d.date,
        dayOfWeek: d.dayOfWeek,
        isWeekend: d.isWeekend,
        isPublicHoliday: d.isPublicHoliday,
        isWorkingDay: d.isWorkingDay,
        isFirstWorkingDayOfMonth: d.isFirstWorkingDayOfMonth,
        isLastWorkingDayOfMonth: d.isLastWorkingDayOfMonth,
        isRamadanPeriod: d.isRamadanPeriod,
        confidence: d.confidence,
      })),
    }

    if (!validateMonth(monthRecord)) {
      console.error(`Month schema validation failed for ${countryCode} ${year}/${pad2(month)}`)
      for (const err of validateMonth.errors ?? []) {
        console.error(`  ${err.instancePath} ${err.message}`)
      }
      process.exit(1)
    }

    if (!dryRun) {
      const dest = join(DATA_DIR, countryCode.toLowerCase(), String(year), `${pad2(month)}.json`)
      await mkdir(dirname(dest), { recursive: true })
      await writeFile(dest, JSON.stringify(monthRecord, null, 2), 'utf-8')
    } else {
      console.log(`[dry-run] would write month: ${countryCode}/${year}/${pad2(month)}.json`)
    }
  }

  if (!dryRun) console.log(`✓ ${countryCode} ${year}: 12 month aggregate files written`)

  // 6. Build and write year summary
  const yearRecord = {
    ...meta,
    workingDaysCount: allDays.filter(d => d.isWorkingDay).length,
    weekendDaysCount: allDays.filter(d => d.isWeekend).length,
    publicHolidaysCount: allDays.filter(d => d.isPublicHoliday).length,
    days: allDays.map(d => ({
      date: d.date,
      dayOfWeek: d.dayOfWeek,
      isWeekend: d.isWeekend,
      isPublicHoliday: d.isPublicHoliday,
      isWorkingDay: d.isWorkingDay,
      isFirstWorkingDayOfMonth: d.isFirstWorkingDayOfMonth,
      isLastWorkingDayOfMonth: d.isLastWorkingDayOfMonth,
      isRamadanPeriod: d.isRamadanPeriod,
      confidence: d.confidence,
    })),
  }

  if (!validateYear(yearRecord)) {
    console.error(`Year schema validation failed for ${countryCode} ${year}`)
    for (const err of validateYear.errors ?? []) {
      console.error(`  ${err.instancePath} ${err.message}`)
    }
    process.exit(1)
  }

  if (!dryRun) {
    // Year file goes at packages/data/{country}/{year}.json (not inside the year dir)
    const yearFileDest = join(DATA_DIR, countryCode.toLowerCase(), `${String(year)}.json`)
    await writeFile(yearFileDest, JSON.stringify(yearRecord, null, 2), 'utf-8')
    console.log(`✓ ${countryCode} ${year}: year summary written`)
  } else {
    console.log(`[dry-run] would write year: ${countryCode}/${year}.json`)
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      year:      { type: 'string', short: 'y' },
      country:   { type: 'string', short: 'c' },
      'dry-run': { type: 'boolean', default: false },
    },
  })

  const years = (values.year ?? '')
    .split(',')
    .map(s => Number(s.trim()))
    .filter(n => Number.isFinite(n) && n > 2000)

  if (years.length === 0) {
    console.error('Usage: pnpm generate -- --year 2026 [--country BJ] [--dry-run]')
    process.exit(1)
  }

  let countryCodes: string[]

  if (values.country) {
    countryCodes = values.country.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
  } else {
    // All country directories present in packages/data/
    const entries = await readdir(DATA_DIR, { withFileTypes: true })
    countryCodes = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('_') && e.name !== 'schema')
      .map(e => e.name.toUpperCase())
  }

  // Load schemas once
  const daySchema = JSON.parse(await readFile(join(SCHEMA_DIR, 'day.schema.json'), 'utf-8'))
  const monthSchema = JSON.parse(await readFile(join(SCHEMA_DIR, 'month.schema.json'), 'utf-8'))
  const yearSchema = JSON.parse(await readFile(join(SCHEMA_DIR, 'year.schema.json'), 'utf-8'))
  const schemas = { day: daySchema, month: monthSchema, year: yearSchema }

  for (const country of countryCodes) {
    for (const year of years) {
      console.log(`\nProcessing ${country} ${year}...`)
      await generateForCountryYear(country, year, schemas, values['dry-run'] ?? false)
    }
  }

  console.log('\nDone.')
}

main().catch(err => { console.error(err); process.exit(1) })
