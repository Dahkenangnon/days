// Runtime-agnostic JSON fetcher — uses only globalThis.fetch + AbortController
// (Web Standard APIs). Zero Node.js built-in imports; safe for browser builds.

import { DaysError } from './errors.js'

export interface FetchOptions {
  /** Per-request timeout in milliseconds. 0 disables the timeout. */
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 10_000

export async function fetchJson<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const controller = new AbortController()
  const timer = timeoutMs > 0
    ? setTimeout(() => controller.abort(), timeoutMs)
    : undefined

  let response: Response
  try {
    response = await globalThis.fetch(url, { signal: controller.signal })
  } catch (cause) {
    if (cause instanceof Error && (cause.name === 'AbortError' || cause.name === 'TimeoutError')) {
      throw new DaysError(
        'TIMEOUT',
        `Request timed out after ${timeoutMs}ms for ${url}`,
        url,
      )
    }
    throw new DaysError(
      'NETWORK_ERROR',
      `Network request failed for ${url}: ${cause instanceof Error ? cause.message : String(cause)}`,
      url,
    )
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }

  if (!response.ok) {
    throw new DaysError(
      'FETCH_ERROR',
      `HTTP ${response.status} ${response.statusText} for ${url}`,
      url,
    )
  }

  try {
    return (await response.json()) as T
  } catch {
    throw new DaysError('PARSE_ERROR', `Failed to parse JSON response from ${url}`, url)
  }
}
