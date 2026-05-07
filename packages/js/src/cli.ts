import { Command } from 'commander'
import { writeFile, mkdir, readdir, rm, stat } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fetchJson } from './fetcher.js'
import { DaysError } from './errors.js'
import type { ManifestRecord, MonthRecord, CountryCode } from './types.js'

const UEMOA: CountryCode[] = ['BJ', 'BF', 'CI', 'GW', 'ML', 'NE', 'SN', 'TG']
const DEFAULT_BASE_URL = 'https://days.claviscore.com'
const DEFAULT_CACHE_DIR = '.days'

const COUNTRY_CODE_RE = /^[A-Z]{2}$/
const YEAR_RE = /^\d{4}$/

/** Reject any string containing path separators, traversal, or shell metacharacters. */
function assertSafeCountry(raw: string): void {
  if (!COUNTRY_CODE_RE.test(raw)) {
    console.error(`Error: invalid country code "${raw}" — must be a 2-letter ISO 3166-1 alpha-2 code`)
    process.exit(1)
  }
}

function assertSafeYear(raw: string): void {
  if (!YEAR_RE.test(raw)) {
    console.error(`Error: invalid year "${raw}" — must be a 4-digit year`)
    process.exit(1)
  }
}

const program = new Command()

program
  .name('days')
  .description('DaysUnit CLI — download and manage calendar data for UEMOA countries')
  .version('1.0.0')

// ---------------------------------------------------------------------------
// days pull
// ---------------------------------------------------------------------------

program
  .command('pull')
  .description('Download month-aggregate JSON files from the CDN into the local cache')
  .option('--country <codes>', 'Comma-separated country codes (e.g. BJ,CI,SN)')
  .option('--year <years>', 'Comma-separated years (e.g. 2026,2027)')
  .option('--uemoa', 'All 8 UEMOA member states (convenience alias)')
  .option('--out <dir>', 'Cache directory (default: .days/)', DEFAULT_CACHE_DIR)
  .option('--base-url <url>', 'CDN base URL override', DEFAULT_BASE_URL)
  .action(async (opts: {
    country?: string
    year?: string
    uemoa?: boolean
    out: string
    baseUrl: string
  }) => {
    const baseUrl = opts.baseUrl.replace(/\/$/, '')
    const cacheDir = opts.out

    // Resolve country list
    const countries: string[] = opts.uemoa
      ? [...UEMOA]
      : (opts.country ?? '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean)

    if (countries.length === 0) {
      console.error('Error: specify --country <codes> or --uemoa')
      process.exit(1)
    }
    countries.forEach(assertSafeCountry)

    // Resolve year list
    const yearTokens = (opts.year ?? '').split(',').map(s => s.trim()).filter(Boolean)
    yearTokens.forEach(assertSafeYear)
    const years: number[] = yearTokens.map(Number).filter(n => Number.isFinite(n) && n > 2000)

    if (years.length === 0) {
      console.error('Error: specify --year <years>')
      process.exit(1)
    }

    // Validate against manifest
    let manifest: ManifestRecord
    try {
      manifest = await fetchJson<ManifestRecord>(`${baseUrl}/manifest.json`)
    } catch (err) {
      console.error(`Error fetching manifest: ${err instanceof DaysError ? err.message : err}`)
      process.exit(1)
    }

    for (const country of countries) {
      if (!manifest.countries.includes(country)) {
        console.error(`Error: country ${country} is not in the manifest`)
        process.exit(1)
      }
    }
    for (const year of years) {
      if (!manifest.yearsAvailable.includes(year)) {
        console.error(`Error: year ${year} is not available in the manifest`)
        process.exit(1)
      }
    }

    // Fetch all (country, year) pairs
    let hasError = false

    for (const country of countries) {
      for (const year of years) {
        const months = Array.from({ length: 12 }, (_, i) => i + 1)

        await Promise.all(
          months.map(async month => {
            const pad = String(month).padStart(2, '0')
            const url = `${baseUrl}/${country.toLowerCase()}/${year}/${pad}.json`
            const dest = join(cacheDir, country.toLowerCase(), String(year), `${pad}.json`)

            // Skip if exists and CDN Last-Modified hasn't changed
            try {
              await stat(dest)
              // File exists — re-fetch to check freshness (simple approach: always overwrite)
              // A production implementation would compare ETag / Last-Modified
            } catch {
              // ENOENT — proceed with download
            }

            try {
              const data = await fetchJson<MonthRecord>(url)
              await mkdir(dirname(dest), { recursive: true })
              await writeFile(dest, JSON.stringify(data, null, 2), 'utf-8')
              console.log(`✓ ${dest}`)
            } catch (err) {
              console.error(`✗ ${url}: ${err instanceof DaysError ? err.message : err}`)
              hasError = true
            }
          }),
        )
      }
    }

    if (hasError) process.exit(1)
  })

// ---------------------------------------------------------------------------
// days cache list
// ---------------------------------------------------------------------------

const cache = program.command('cache').description('Manage the local data cache')

cache
  .command('list')
  .description('List locally cached country + year pairs')
  .option('--out <dir>', 'Cache directory', DEFAULT_CACHE_DIR)
  .action(async (opts: { out: string }) => {
    const cacheDir = opts.out
    let countries: string[]
    try {
      countries = await readdir(cacheDir)
    } catch {
      console.log('Cache is empty (directory does not exist)')
      return
    }

    let found = false
    for (const country of countries.sort()) {
      let years: string[]
      try {
        years = await readdir(join(cacheDir, country))
      } catch {
        continue
      }
      for (const year of years.sort()) {
        let months: string[]
        try {
          months = await readdir(join(cacheDir, country, year))
        } catch {
          continue
        }
        console.log(`${country.toUpperCase()} / ${year} — ${months.length} month file(s)`)
        found = true
      }
    }

    if (!found) console.log('Cache is empty')
  })

// ---------------------------------------------------------------------------
// days cache clear
// ---------------------------------------------------------------------------

cache
  .command('clear')
  .description('Remove cached files')
  .option('--country <code>', 'Limit to a specific country code')
  .option('--year <year>', 'Limit to a specific year')
  .option('--out <dir>', 'Cache directory', DEFAULT_CACHE_DIR)
  .action(async (opts: { country?: string; year?: string; out: string }) => {
    const cacheDir = opts.out
    if (opts.country) assertSafeCountry(opts.country.toUpperCase())
    if (opts.year) assertSafeYear(opts.year)

    let target: string
    if (opts.country && opts.year) {
      target = join(cacheDir, opts.country.toLowerCase(), opts.year)
    } else if (opts.country) {
      target = join(cacheDir, opts.country.toLowerCase())
    } else {
      target = cacheDir
    }

    try {
      await rm(target, { recursive: true, force: true })
      console.log(`Cleared: ${target}`)
    } catch (err) {
      console.error(`Error clearing cache: ${err instanceof Error ? err.message : err}`)
      process.exit(1)
    }
  })

program.parse(process.argv)
