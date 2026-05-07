import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import days, { configure, DaysError } from './index.js'

describe('days() entry point', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
    configure({
      baseUrl: 'https://days.example.com',
      cacheDir: '/nonexistent/cache/path',
      fallbackToCdn: true,
      timeoutMs: 1_000,
    })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('exports a default function and named DaysError', () => {
    expect(typeof days).toBe('function')
    expect(typeof DaysError).toBe('function')
    expect(typeof configure).toBe('function')
  })

  it('returns a DaysBuilder for a single country code', async () => {
    globalThis.fetch = vi.fn(async () => new Response('not found', { status: 404 })) as unknown as typeof fetch
    // The builder itself is constructed synchronously; trigger a network call
    // to confirm we received the right shape.
    const builder = days('BJ')
    expect(typeof builder.on).toBe('function')
    expect(typeof builder.month).toBe('function')
    expect(typeof builder.range).toBe('function')
  })

  it('returns a multi-builder for an array of country codes', async () => {
    const multi = days(['BJ', 'CI'])
    expect(typeof multi.on).toBe('function')
  })

  it('multi-builder.on() resolves an entry per country in parallel', async () => {
    const dayPayload = {
      schemaVersion: '1.0',
      date: '2026-01-01',
      country: 'XX',
      countryName: 'Test',
      countryNames: { fr: 'Test', en: 'Test' },
      timezone: 'UTC',
      dayOfWeek: 4,
      isWeekend: false,
      isPublicHoliday: false,
      isWorkingDay: true,
      isFirstWorkingDayOfMonth: true,
      isLastWorkingDayOfMonth: false,
      isRamadanPeriod: false,
      holidayName: null,
      holidayType: null,
      religiousAffiliation: null,
      observedDate: null,
      legalBasis: null,
      source: null,
      verifiedAt: '2025-11-01',
      confidence: 'confirmed' as const,
      weekNumber: 1,
      quarter: 1,
      workingDayOfMonth: 1,
      workingDayOfYear: 1,
    }
    globalThis.fetch = vi.fn(async (url) =>
      new Response(JSON.stringify({ ...dayPayload, country: String(url).includes('/bj/') ? 'BJ' : 'CI' }), {
        status: 200,
      }),
    ) as unknown as typeof fetch

    const batch = await days(['BJ', 'CI']).on('2026-01-01')
    expect(batch.BJ.isWorking()).toBe(true)
    expect(batch.CI.isWorking()).toBe(true)
  })
})
