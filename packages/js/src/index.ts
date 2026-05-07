import { setConfig, getConfig } from './resolver.js'
import { DaysBuilder } from './builder.js'
import type { CountryCode, DaysConfig } from './types.js'
import type { BatchResult } from './builder.js'

// Re-export all types for consumers
export type {
  CountryCode,
  Confidence,
  HolidayType,
  ReligiousAffiliation,
  HolidayName,
  CountryNames,
  DayRecord,
  MonthDayEntry,
  MonthRecord,
  YearRecord,
  ManifestRecord,
  DaysConfig,
} from './types.js'

export { DaysError } from './errors.js'
export { DayResult, MonthResult, RangeResult } from './builder.js'
export type { BatchResult } from './builder.js'

// ---------------------------------------------------------------------------
// configure() — set global options once at app startup
// ---------------------------------------------------------------------------

export function configure(opts: Partial<DaysConfig>): void {
  setConfig({ ...getConfig(), ...opts })
}

// ---------------------------------------------------------------------------
// days() — entry-point factory
// Single country: returns DaysBuilder (fluent chain)
// Array of countries: on() returns BatchResult<C>
// ---------------------------------------------------------------------------

function days<C extends CountryCode>(country: C): DaysBuilder
function days<C extends CountryCode>(countries: C[]): MultiBuilder<C>
function days<C extends CountryCode>(input: C | C[]): DaysBuilder | MultiBuilder<C> {
  // getConfig() ensures the resolver-side config is initialised before any I/O.
  void getConfig()
  if (Array.isArray(input)) {
    return new MultiBuilder<C>(input)
  }
  return new DaysBuilder(input)
}

export default days

// ---------------------------------------------------------------------------
// MultiBuilder — multi-country batch
// ---------------------------------------------------------------------------

class MultiBuilder<C extends CountryCode> {
  constructor(private readonly countries: C[]) {}

  async on(date: string): Promise<BatchResult<C>> {
    const entries = await Promise.all(
      this.countries.map(async c => {
        const builder = new DaysBuilder(c)
        const result = await builder.on(date)
        return [c, result] as [C, (typeof result)]
      }),
    )
    return Object.fromEntries(entries) as BatchResult<C>
  }
}
