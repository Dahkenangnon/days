<p align="center">
  <img src="https://days.claviscore.com/banner.png" alt="DaysUnit — open calendar data for West Africa" width="100%">
</p>

# @claviscore/days

Runtime-agnostic JavaScript client for the [DaysUnit](https://days.claviscore.com) UEMOA calendar service.
Working days, public holidays, and calendar metadata for West African countries — fetched from a static CDN, no API keys, no rate limits.

[![npm](https://img.shields.io/npm/v/@claviscore/days)](https://www.npmjs.com/package/@claviscore/days)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Runs on:** Browser, Node ≥ 18, Deno, Bun. Zero calendar data is bundled — files are fetched at runtime or pulled into a local cache via the `days` CLI.

> ⚠️ **Early-access notice:** Only Bénin (`BJ`) data is currently available, and it is still being reviewed. It may contain inaccurate dates. **Do not use it in production applications yet.** We are actively fixing known issues — watch the repository for the first stable release announcement.

## Install

```bash
npm install @claviscore/days
# or
pnpm add @claviscore/days
# or
yarn add @claviscore/days
```

## Usage

```ts
import days from '@claviscore/days'

const d = await days('BJ').on('2026-01-15')
d.isWorking()        // → true
d.isHoliday()        // → false

const m = await days('BJ').month(2026, 1)
m.workingDays()      // → 21

const r = await days('BJ').range('2026-01-01', '2026-03-31')
r.workingDays()      // → number

const next = await days('BJ').nextWorkingDay('2026-01-01')
// → '2026-01-02'

// Multi-country batch (parallel fetches)
const batch = await days(['BJ', 'CI', 'SN']).on('2026-01-01')
batch.BJ.isHoliday()
```

## Configuration

```ts
import { configure } from '@claviscore/days'

configure({
  baseUrl: 'https://days.claviscore.com',  // override CDN
  cacheDir: './.days',                      // local cache (Node/Deno/Bun)
  fallbackToCdn: true,                      // fall back to CDN on cache miss
  timeoutMs: 10_000                         // per-request timeout
})
```

## CLI — offline cache

```bash
# Pre-download a country/year for offline lookup
npx @claviscore/days pull --country BJ --year 2026

# Inspect / clear cache
npx @claviscore/days cache list
npx @claviscore/days cache clear --country BJ --year 2026
```

Add `.days/` to your `.gitignore`.

## Error handling

All I/O errors throw a `DaysError` with a `code` string:

```ts
import { DaysError } from '@claviscore/days'

try {
  await days('BJ').on('2026-01-01')
} catch (err) {
  if (err instanceof DaysError) {
    // err.code: 'NETWORK_ERROR' | 'FETCH_ERROR' | 'PARSE_ERROR'
    //         | 'TIMEOUT' | 'INVALID_DATE' | 'INVALID_RANGE'
    //         | 'DAY_NOT_FOUND' | 'NO_WORKING_DAY' | 'CACHE_MISS' | ...
    console.error(err.code, err.message, err.url)
  }
}
```

## Coverage

Country coverage is reported live in [`manifest.json`](https://days.claviscore.com/manifest.json) — consult it at runtime rather than hard-coding the list.

## Documentation

Full documentation, JSON schemas, and contributing guide:
**https://github.com/Dahkenangnon/days**

## License

[MIT](LICENSE) © 2026-Present Justin Dah-kenangnon

---

## Annex — Field provenance

Each day record carries 25 fields. They split into three classes by how they are obtained — useful for understanding which values come from pure date arithmetic (always trustworthy) and which depend on legal or astronomical sources (where `confidence` matters).

> **What `confidence` actually qualifies.** `confidence` only describes the legally-determined fields below (and the working-day fields that depend on them). The pure-computation fields (`dayOfWeek`, `isWeekend`, `weekNumber`, `quarter`, …) are **always trustworthy regardless of the `confidence` value** — a record marked `tentative` still has a fully reliable `dayOfWeek` and `isWeekend`; only its holiday-related claims should be treated as provisional.

### Pure-computation fields (no source needed, always trustworthy)

Deterministic from the date itself or from the country's static config. **`confidence` does not apply** to these — safe to consume even when the record is `tentative` or `ai-generated`.

| Field | Derivation |
|---|---|
| `schemaVersion` | constant `"1.0"` |
| `date` | input |
| `country` | static config (e.g. `"BJ"`) |
| `countryName` | static config |
| `countryNames` | static config |
| `timezone` | static config (IANA tz) |
| `dayOfWeek` | ISO 8601 weekday (Mon=1 … Sun=7) |
| `isWeekend` | `dayOfWeek ∈ {6, 7}` |
| `weekNumber` | ISO 8601 week number |
| `quarter` | `ceil(month / 3)` |
| `verifiedAt` | metadata — date the record was generated/verified |

### Computed, but transitively dependent on holiday data

Derived by formula at aggregate-generation time, but the formula reads `isPublicHoliday`. They inherit confidence indirectly from the underlying holiday list.

| Field | Formula |
|---|---|
| `isWorkingDay` | `!isWeekend && !isPublicHoliday` |
| `isFirstWorkingDayOfMonth` | first day in month where `isWorkingDay === true` |
| `isLastWorkingDayOfMonth` | last day in month where `isWorkingDay === true` |
| `workingDayOfMonth` | rolling count within month (`null` on non-working days) |
| `workingDayOfYear` | rolling count within year (`null` on non-working days) |

### Legally-determined fields (require a verifiable source)

Cannot be derived from the date — they come from a national law, government decree, or astronomical/religious observation. **These are the only fields that `confidence` qualifies**: `confirmed` means `legalBasis` + `source` are verified against an official text; `tentative` means the date depends on an unpublished annual decree or lunar observation; `ai-generated` means the values are model-proposed and pending human review.

| Field | Why a source is required |
|---|---|
| `isPublicHoliday` | set by national law or annual decree |
| `holidayName` | name as it appears in the official text |
| `holidayType` | `national \| religious \| observance \| bridge \| school` per the decree |
| `religiousAffiliation` | `christian \| islamic \| secular \| animist` |
| `observedDate` | substitution rule — country-specific; only some jurisdictions shift weekend holidays |
| `legalBasis` | citation of the law (e.g. `Loi n° 90-019 du 27 juillet 1990`) |
| `source` | URL to the official text, gazette entry, or government communiqué |
| `isRamadanPeriod` | Islamic lunar calendar — depends on observation/announcement, not pure date arithmetic |
| `confidence` | `confirmed \| tentative \| ai-generated` — reflects the strength of the underlying source |

### Rule of thumb

- **Pure-computation fields** → always trustworthy. `confidence` does not apply to them; use them directly even when the record is `tentative`.
- **Legally-determined fields** → the only fields whose trust level is gated by `confidence`. Must come from a verifiable source.
- **Computed-but-dependent fields** → never edited by hand; produced by `tools/generate-aggregates.ts`. Inherit confidence from the holiday data they depend on.
