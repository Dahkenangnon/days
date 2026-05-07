import { resolve } from './resolver.js'
import { DaysError } from './errors.js'
import type {
  CountryCode,
  DayRecord,
  MonthDayEntry,
  MonthRecord,
  HolidayName,
  CountryNames,
  Confidence,
  ReligiousAffiliation,
} from './types.js'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Sentinel value used in `.verifiedAt` when a DayResult is built from the
 * month-aggregate fallback path (the full day file was unreachable). The value
 * is a valid ISO 8601 date so the field type stays string, but it's far enough
 * in the past that any caller doing `verifiedAt < someDate` checks will treat
 * the data as old/unverified rather than mistakenly fresh.
 */
export const PARTIAL_VERIFIED_AT_SENTINEL = '1970-01-01'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function isoWeekNumber(iso: string): number {
  const d = new Date(`${iso}T00:00:00Z`)
  const dayOfWeek = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function parseDate(iso: string): { year: number; month: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) throw new DaysError('INVALID_DATE', `Invalid ISO date: ${iso}`)
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }
}

function monthPath(country: CountryCode, year: number, month: number): string {
  return `${country.toLowerCase()}/${year}/${pad2(month)}.json`
}

function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

/** Returns all (year, month) pairs that overlap [from, to] (inclusive). */
function monthsInRange(from: string, to: string): Array<{ year: number; month: number }> {
  const start = parseDate(from)
  const end = parseDate(to)
  const result: Array<{ year: number; month: number }> = []
  let y = start.year
  let m = start.month
  while (y < end.year || (y === end.year && m <= end.month)) {
    result.push({ year: y, month: m })
    m++
    if (m > 12) { m = 1; y++ }
  }
  return result
}

// ---------------------------------------------------------------------------
// DayResult — wraps a full DayRecord (from a resolved month entry + day file)
// ---------------------------------------------------------------------------

export class DayResult {
  constructor(private readonly _raw: DayRecord) {}

  isWorking(): boolean            { return this._raw.isWorkingDay }
  isHoliday(): boolean            { return this._raw.isPublicHoliday }
  isWeekend(): boolean            { return this._raw.isWeekend }
  dayOfWeek(): number             { return this._raw.dayOfWeek }
  isFirstWorkingDay(): boolean    { return this._raw.isFirstWorkingDayOfMonth }
  isLastWorkingDay(): boolean     { return this._raw.isLastWorkingDayOfMonth }
  isRamadanPeriod(): boolean      { return this._raw.isRamadanPeriod }
  religiousAffiliation(): ReligiousAffiliation | null { return this._raw.religiousAffiliation }
  name(): HolidayName | null      { return this._raw.holidayName }
  countryName(): string           { return this._raw.countryName }
  countryNames(): CountryNames    { return this._raw.countryNames }
  timezone(): string              { return this._raw.timezone }
  confidence(): Confidence        { return this._raw.confidence }
  raw(): DayRecord                { return this._raw }
}

// ---------------------------------------------------------------------------
// MonthResult — wraps a MonthRecord
// ---------------------------------------------------------------------------

export class MonthResult {
  constructor(private readonly _raw: MonthRecord) {}

  workingDays(): number {
    return this._raw.workingDaysCount
  }

  holidays(): MonthDayEntry[] {
    return this._raw.days.filter(d => d.isPublicHoliday)
  }

  each(fn: (day: MonthDayEntry) => void): void {
    this._raw.days.forEach(fn)
  }

  find(date: string): MonthDayEntry | undefined {
    return this._raw.days.find(d => d.date === date)
  }

  raw(): MonthRecord {
    return this._raw
  }
}

// ---------------------------------------------------------------------------
// RangeResult — wraps a list of month records for a date range
// ---------------------------------------------------------------------------

export class RangeResult {
  private readonly _days: MonthDayEntry[]
  private readonly _workingDaysCount: number

  constructor(months: MonthRecord[], from: string, to: string) {
    // Filter to only days within [from, to] (months may overlap on edges)
    this._days = months
      .flatMap(m => m.days)
      .filter(d => d.date >= from && d.date <= to)

    this._workingDaysCount = this._days.filter(d => d.isWorkingDay).length
  }

  workingDays(): number {
    return this._workingDaysCount
  }

  holidays(): MonthDayEntry[] {
    return this._days.filter(d => d.isPublicHoliday)
  }

  each(fn: (day: MonthDayEntry) => void): void {
    this._days.forEach(fn)
  }
}

// ---------------------------------------------------------------------------
// DaysBuilder — single-country fluent chain
// ---------------------------------------------------------------------------

export class DaysBuilder {
  constructor(private readonly country: CountryCode) {}

  /**
   * Resolve a single day.
   *
   * Strategy: fetch the full day file directly. The full file is the authoritative
   * source for fields like `holidayName`, `legalBasis`, `source`, and `verifiedAt`.
   * If the full file is unavailable (network error, 404), fall back to the month
   * aggregate and return the boolean-flag subset only — this lets predicate methods
   * (`isWorking`, `isHoliday`, ...) work, but `.raw()` will reflect the partial state.
   *
   * Callers that only need flags (not text fields) can also use `.month(year, month)`
   * directly — that path performs a single network request and is preferred.
   */
  async on(date: string): Promise<DayResult> {
    const { year, month, day } = parseDate(date)
    const fullPath = `${this.country.toLowerCase()}/${year}/${pad2(month)}/${pad2(day)}.json`

    // Primary: full day file
    try {
      const full = await resolve<DayRecord>(fullPath)
      return new DayResult(full)
    } catch (cause) {
      // Fall through to month-aggregate fallback below
      void cause
    }

    // Fallback: derive flags-only DayRecord from the month aggregate
    const monthRecord = await resolve<MonthRecord>(monthPath(this.country, year, month))
    const entry = monthRecord.days.find(d => d.date === date)
    if (!entry) {
      throw new DaysError('DAY_NOT_FOUND', `Day ${date} not found in month aggregate`, date)
    }

    const partial: DayRecord = {
      schemaVersion: monthRecord.schemaVersion,
      date,
      country: monthRecord.country,
      countryName: monthRecord.countryName,
      countryNames: monthRecord.countryNames,
      timezone: monthRecord.timezone,
      dayOfWeek: entry.dayOfWeek,
      isWeekend: entry.isWeekend,
      isPublicHoliday: entry.isPublicHoliday,
      isWorkingDay: entry.isWorkingDay,
      isFirstWorkingDayOfMonth: entry.isFirstWorkingDayOfMonth,
      isLastWorkingDayOfMonth: entry.isLastWorkingDayOfMonth,
      isRamadanPeriod: entry.isRamadanPeriod,
      // Text fields are not present in the month aggregate. We do NOT synthesise
      // a fake `verifiedAt`; we leave the partial flag visible so callers know
      // they're looking at the flags-only fallback.
      holidayName: null,
      holidayType: null,
      religiousAffiliation: null,
      observedDate: null,
      legalBasis: null,
      source: null,
      verifiedAt: PARTIAL_VERIFIED_AT_SENTINEL,
      confidence: entry.confidence,
      weekNumber: isoWeekNumber(date),
      quarter: Math.ceil(month / 3),
      workingDayOfMonth: null,
      workingDayOfYear: null,
    }
    return new DayResult(partial)
  }

  /** Resolve a full month aggregate. */
  async month(year: number, month: number): Promise<MonthResult> {
    const record = await resolve<MonthRecord>(monthPath(this.country, year, month))
    return new MonthResult(record)
  }

  /** Resolve all months covering [from, to] and return a RangeResult. */
  async range(from: string, to: string): Promise<RangeResult> {
    if (from > to) throw new DaysError('INVALID_RANGE', `Range start ${from} is after end ${to}`)

    const months = monthsInRange(from, to)
    const records = await Promise.all(
      months.map(({ year, month }) =>
        resolve<MonthRecord>(monthPath(this.country, year, month)),
      ),
    )
    return new RangeResult(records, from, to)
  }

  /** Returns the ISO date of the next working day after `date`. */
  async nextWorkingDay(date: string): Promise<string> {
    let cursor = addDays(date, 1)
    // Safety: scan up to 14 days forward (handles week + public holiday combos)
    for (let i = 0; i < 14; i++) {
      const { year, month } = parseDate(cursor)
      const record = await resolve<MonthRecord>(monthPath(this.country, year, month))
      const entry = record.days.find(d => d.date === cursor)
      if (entry?.isWorkingDay) return cursor
      cursor = addDays(cursor, 1)
    }
    throw new DaysError('NO_WORKING_DAY', `No working day found within 14 days after ${date}`)
  }

  /** Returns the ISO date of the previous working day before `date`. */
  async prevWorkingDay(date: string): Promise<string> {
    let cursor = addDays(date, -1)
    for (let i = 0; i < 14; i++) {
      const { year, month } = parseDate(cursor)
      const record = await resolve<MonthRecord>(monthPath(this.country, year, month))
      const entry = record.days.find(d => d.date === cursor)
      if (entry?.isWorkingDay) return cursor
      cursor = addDays(cursor, -1)
    }
    throw new DaysError('NO_WORKING_DAY', `No working day found within 14 days before ${date}`)
  }

  /** Counts working days in [from, to] (inclusive) using pre-computed month aggregates. */
  async workingDaysInRange(from: string, to: string): Promise<number> {
    const result = await this.range(from, to)
    return result.workingDays()
  }
}

// ---------------------------------------------------------------------------
// MultiBatchResult — wraps multi-country on() responses
// ---------------------------------------------------------------------------

export type BatchResult<C extends CountryCode> = Record<C, DayResult>
