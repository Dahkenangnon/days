<p align="center">
  <img src="https://days.claviscore.com/banner.png" alt="DaysUnit — open calendar data for West Africa" width="100%">
</p>

# @claviscore/days

Runtime-agnostic JavaScript client for the [DaysUnit](https://days.claviscore.com) UEMOA calendar service.
Working days, public holidays, and calendar metadata for West African countries — fetched from a static CDN, no API keys, no rate limits.

[![npm](https://img.shields.io/npm/v/@claviscore/days)](https://www.npmjs.com/package/@claviscore/days)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Runs on:** Browser, Node ≥ 18, Deno, Bun. Zero calendar data is bundled — files are fetched at runtime or pulled into a local cache via the `days` CLI.

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
npx days pull --country BJ --year 2026

# Inspect / clear cache
npx days cache list
npx days cache clear --country BJ --year 2026
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
