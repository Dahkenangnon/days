// All exported types — mirrors JSON Schema definitions exactly

export type CountryCode = 'BJ' | 'BF' | 'CI' | 'GW' | 'ML' | 'NE' | 'SN' | 'TG'

export type Confidence = 'confirmed' | 'tentative' | 'ai-generated'

export type HolidayType = 'national' | 'religious' | 'observance' | 'bridge' | 'school'

export type ReligiousAffiliation = 'christian' | 'islamic' | 'secular' | 'animist'

export interface HolidayName {
  fr: string
  en: string
  [locale: string]: string
}

export interface CountryNames {
  fr: string
  en: string
  pt?: string
  [locale: string]: string | undefined
}

/** Full day record — matches day.schema.json */
export interface DayRecord {
  schemaVersion: string
  date: string
  country: string
  countryName: string
  countryNames: CountryNames
  timezone: string
  dayOfWeek: number
  isWeekend: boolean
  isPublicHoliday: boolean
  isWorkingDay: boolean
  isFirstWorkingDayOfMonth: boolean
  isLastWorkingDayOfMonth: boolean
  isRamadanPeriod: boolean
  holidayName: HolidayName | null
  holidayType: HolidayType | null
  religiousAffiliation: ReligiousAffiliation | null
  observedDate: string | null
  legalBasis: string | null
  source: string | null
  verifiedAt: string
  confidence: Confidence
  weekNumber: number
  quarter: number
  workingDayOfMonth: number | null
  workingDayOfYear: number | null
}

/** Condensed day entry used in month/year aggregate `days[]` arrays */
export interface MonthDayEntry {
  date: string
  dayOfWeek: number
  isWeekend: boolean
  isPublicHoliday: boolean
  isWorkingDay: boolean
  isFirstWorkingDayOfMonth: boolean
  isLastWorkingDayOfMonth: boolean
  isRamadanPeriod: boolean
  confidence: Confidence
}

/** Root shape of a month aggregate file — matches month.schema.json */
export interface MonthRecord {
  schemaVersion: string
  country: string
  countryName: string
  countryNames: CountryNames
  timezone: string
  year: number
  month: number
  workingDaysCount: number
  weekendDaysCount: number
  publicHolidaysCount: number
  days: MonthDayEntry[]
}

/** Root shape of a year summary file — matches year.schema.json */
export interface YearRecord {
  schemaVersion: string
  country: string
  countryName: string
  countryNames: CountryNames
  timezone: string
  year: number
  workingDaysCount: number
  weekendDaysCount: number
  publicHolidaysCount: number
  days: MonthDayEntry[]
}

/** Shape of manifest.json */
export interface ManifestRecord {
  schemaVersion: string
  lastUpdated: string
  countries: string[]
  yearsAvailable: number[]
  baseUrl: string
  endpoints: {
    day: string
    month: string
    year: string
    manifest: string
  }
  schemaUrls: {
    day: string
    month: string
    year: string
    manifest: string
  }
}

export interface DaysConfig {
  baseUrl: string
  cacheDir: string
  fallbackToCdn: boolean
  /** Per-request timeout in milliseconds. Set to 0 to disable. Default: 10000. */
  timeoutMs: number
}
