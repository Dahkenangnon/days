import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { DayRecord, MonthRecord, MonthDayEntry } from './types.js'

// Mock the resolver before importing builder
vi.mock('./resolver.js', () => ({
  resolve: vi.fn(),
  setConfig: vi.fn(),
  getConfig: vi.fn(() => ({
    baseUrl: 'https://days.example.com',
    cacheDir: '.days',
    fallbackToCdn: true,
    timeoutMs: 10_000,
  })),
}))

import { resolve } from './resolver.js'
import {
  DaysBuilder,
  DayResult,
  MonthResult,
  RangeResult,
  PARTIAL_VERIFIED_AT_SENTINEL,
} from './builder.js'
import { DaysError } from './errors.js'

const mockResolve = vi.mocked(resolve)

function makeFullDay(date: string): DayRecord {
  return {
    schemaVersion: '1.0',
    date,
    country: 'BJ',
    countryName: 'Bénin',
    countryNames: { fr: 'Bénin', en: 'Benin' },
    timezone: 'Africa/Porto-Novo',
    dayOfWeek: 4,
    isWeekend: false,
    isPublicHoliday: true,
    isWorkingDay: false,
    isFirstWorkingDayOfMonth: false,
    isLastWorkingDayOfMonth: false,
    isRamadanPeriod: false,
    holidayName: { fr: "Jour de l'An", en: "New Year's Day" },
    holidayType: 'national',
    religiousAffiliation: null,
    observedDate: null,
    legalBasis: 'Loi n° 98-004',
    source: 'https://jo.gouv.bj/...',
    verifiedAt: '2025-11-01',
    confidence: 'confirmed',
    weekNumber: 1,
    quarter: 1,
    workingDayOfMonth: null,
    workingDayOfYear: null,
  }
}

function makeMonthEntry(date: string, overrides: Partial<MonthDayEntry> = {}): MonthDayEntry {
  return {
    date,
    dayOfWeek: 4,
    isWeekend: false,
    isPublicHoliday: false,
    isWorkingDay: true,
    isFirstWorkingDayOfMonth: false,
    isLastWorkingDayOfMonth: false,
    isRamadanPeriod: false,
    confidence: 'confirmed',
    ...overrides,
  }
}

function makeMonth(year: number, month: number, days: MonthDayEntry[]): MonthRecord {
  const workingDaysCount = days.filter(d => d.isWorkingDay).length
  const weekendDaysCount = days.filter(d => d.isWeekend).length
  const publicHolidaysCount = days.filter(d => d.isPublicHoliday).length
  return {
    schemaVersion: '1.0',
    country: 'BJ',
    countryName: 'Bénin',
    countryNames: { fr: 'Bénin', en: 'Benin' },
    timezone: 'Africa/Porto-Novo',
    year,
    month,
    workingDaysCount,
    weekendDaysCount,
    publicHolidaysCount,
    days,
  }
}

describe('DaysBuilder.on()', () => {
  beforeEach(() => {
    mockResolve.mockReset()
  })

  it('returns DayResult from the full day file when available', async () => {
    const full = makeFullDay('2026-01-01')
    mockResolve.mockResolvedValueOnce(full)

    const builder = new DaysBuilder('BJ')
    const day = await builder.on('2026-01-01')

    expect(day).toBeInstanceOf(DayResult)
    expect(day.isHoliday()).toBe(true)
    expect(day.isWorking()).toBe(false)
    expect(day.name()).toEqual({ fr: "Jour de l'An", en: "New Year's Day" })
    expect(day.raw().verifiedAt).toBe('2025-11-01')
    expect(mockResolve).toHaveBeenCalledWith('bj/2026/01/01.json')
  })

  it('falls back to month aggregate (with sentinel verifiedAt) when day file is missing', async () => {
    mockResolve.mockRejectedValueOnce(new DaysError('FETCH_ERROR', '404 day'))
    mockResolve.mockResolvedValueOnce(
      makeMonth(2026, 2, [makeMonthEntry('2026-02-02', { isWorkingDay: true })]),
    )

    const builder = new DaysBuilder('BJ')
    const day = await builder.on('2026-02-02')

    expect(day.isWorking()).toBe(true)
    expect(day.name()).toBeNull()
    expect(day.raw().verifiedAt).toBe(PARTIAL_VERIFIED_AT_SENTINEL)
    expect(day.raw().legalBasis).toBeNull()
    expect(day.raw().source).toBeNull()
  })

  it('throws DAY_NOT_FOUND when neither full file nor month entry exists', async () => {
    mockResolve.mockRejectedValueOnce(new DaysError('FETCH_ERROR', '404 day'))
    mockResolve.mockResolvedValueOnce(
      makeMonth(2026, 2, [makeMonthEntry('2026-02-01')]),
    )

    const builder = new DaysBuilder('BJ')
    await expect(builder.on('2026-02-15')).rejects.toMatchObject({ code: 'DAY_NOT_FOUND' })
  })

  it('rejects malformed dates', async () => {
    const builder = new DaysBuilder('BJ')
    await expect(builder.on('not-a-date')).rejects.toMatchObject({ code: 'INVALID_DATE' })
  })
})

describe('DaysBuilder.month()', () => {
  beforeEach(() => {
    mockResolve.mockReset()
  })

  it('returns MonthResult with correct working-day count', async () => {
    mockResolve.mockResolvedValueOnce(
      makeMonth(2026, 1, [
        makeMonthEntry('2026-01-01', { isPublicHoliday: true, isWorkingDay: false }),
        makeMonthEntry('2026-01-02', { isWorkingDay: true }),
        makeMonthEntry('2026-01-03', { isWeekend: true, isWorkingDay: false }),
      ]),
    )

    const builder = new DaysBuilder('BJ')
    const m = await builder.month(2026, 1)

    expect(m).toBeInstanceOf(MonthResult)
    expect(m.workingDays()).toBe(1)
    expect(m.holidays()).toHaveLength(1)
    expect(m.find('2026-01-02')?.isWorkingDay).toBe(true)
    expect(m.find('2099-01-01')).toBeUndefined()
  })
})

describe('DaysBuilder.range()', () => {
  beforeEach(() => {
    mockResolve.mockReset()
  })

  it('rejects inverted ranges', async () => {
    const builder = new DaysBuilder('BJ')
    await expect(builder.range('2026-03-01', '2026-01-01')).rejects.toMatchObject({
      code: 'INVALID_RANGE',
    })
  })

  it('counts working days across multiple months', async () => {
    mockResolve.mockResolvedValueOnce(
      makeMonth(2026, 1, [
        makeMonthEntry('2026-01-30', { isWorkingDay: true }),
        makeMonthEntry('2026-01-31', { isWeekend: true, isWorkingDay: false }),
      ]),
    )
    mockResolve.mockResolvedValueOnce(
      makeMonth(2026, 2, [
        makeMonthEntry('2026-02-01', { isWeekend: true, isWorkingDay: false }),
        makeMonthEntry('2026-02-02', { isWorkingDay: true }),
      ]),
    )

    const builder = new DaysBuilder('BJ')
    const r = await builder.range('2026-01-30', '2026-02-02')

    expect(r).toBeInstanceOf(RangeResult)
    expect(r.workingDays()).toBe(2)
  })
})

describe('DaysBuilder.nextWorkingDay() / prevWorkingDay()', () => {
  beforeEach(() => {
    mockResolve.mockReset()
  })

  it('finds the next working day skipping weekends and holidays', async () => {
    // Caller asks for next after 2026-01-01 (Thursday holiday)
    // Returns same month aggregate for each call inside the loop
    const month = makeMonth(2026, 1, [
      makeMonthEntry('2026-01-01', { isPublicHoliday: true, isWorkingDay: false }),
      makeMonthEntry('2026-01-02', { isWorkingDay: true }),
    ])
    mockResolve.mockResolvedValue(month)

    const builder = new DaysBuilder('BJ')
    const next = await builder.nextWorkingDay('2026-01-01')
    expect(next).toBe('2026-01-02')
  })

  it('throws NO_WORKING_DAY when 14 consecutive days are non-working', async () => {
    const days = Array.from({ length: 31 }, (_, i) =>
      makeMonthEntry(`2026-01-${String(i + 1).padStart(2, '0')}`, {
        isWeekend: true,
        isWorkingDay: false,
      }),
    )
    mockResolve.mockResolvedValue(makeMonth(2026, 1, days))

    const builder = new DaysBuilder('BJ')
    await expect(builder.nextWorkingDay('2026-01-01')).rejects.toMatchObject({
      code: 'NO_WORKING_DAY',
    })
  })
})
