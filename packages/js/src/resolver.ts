// Resolver — local cache → CDN fallback
// Resolution always at month-aggregate granularity.
// Node.js fs access is isolated behind dynamic import() so bundlers can
// dead-code-eliminate it for browser targets via the `browser` export condition.

import { fetchJson } from './fetcher.js'
import { DaysError } from './errors.js'
import type { DaysConfig } from './types.js'

let _config: DaysConfig = {
  baseUrl: 'https://days.claviscore.com',
  cacheDir: '.days',
  fallbackToCdn: true,
  timeoutMs: 10_000,
}

export function setConfig(config: DaysConfig): void {
  _config = config
}

export function getConfig(): DaysConfig {
  return _config
}

/**
 * Attempt to read a cached file from the local filesystem.
 * Returns null in browser environments or on cache miss (ENOENT).
 * All other errors (e.g. permission denied) are re-thrown.
 */
async function tryLocalCache<T>(relativePath: string): Promise<T | null> {
  // Guard against path traversal attacks
  if (relativePath.includes('..') || relativePath.startsWith('/')) {
    throw new DaysError('CACHE_READ_ERROR', `Invalid cache path: ${relativePath}`)
  }
  try {
    // Dynamic import keeps this code out of browser bundles entirely.
    // tsup's `platform: 'browser'` build replaces this with the browser stub.
    const { readFile } = await import('node:fs/promises')
    const filePath = `${_config.cacheDir}/${relativePath}`
    const raw = await readFile(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      return null
    }
    // Module not found = running in browser / non-Node environment
    if (err instanceof Error && err.message.includes('Cannot find module')) {
      return null
    }
    // Re-throw unexpected errors (e.g. JSON parse errors, permission errors)
    throw new DaysError(
      'CACHE_READ_ERROR',
      `Failed to read local cache at ${relativePath}: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

/**
 * Resolve a JSON resource by path.
 * Server: tries local cache first, falls back to CDN if miss or fallbackToCdn=true.
 * Browser: CDN only (tryLocalCache returns null immediately).
 *
 * @param path - path relative to baseUrl / cacheDir, e.g. "bj/2026/01.json"
 */
export async function resolve<T>(path: string): Promise<T> {
  const cached = await tryLocalCache<T>(path)
  if (cached !== null) return cached

  if (!_config.fallbackToCdn) {
    throw new DaysError(
      'CACHE_MISS',
      `No local cache entry for ${path} and fallbackToCdn is disabled`,
    )
  }

  const url = `${_config.baseUrl.replace(/\/$/, '')}/${path}`
  return fetchJson<T>(url, { timeoutMs: _config.timeoutMs })
}
