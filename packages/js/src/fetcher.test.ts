import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fetchJson } from './fetcher.js'
import { DaysError } from './errors.js'

const URL = 'https://days.example.com/test.json'

describe('fetchJson', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('returns parsed JSON on 200 OK', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ ok: 1 }), { status: 200 }),
    ) as unknown as typeof fetch

    const data = await fetchJson<{ ok: number }>(URL)
    expect(data).toEqual({ ok: 1 })
  })

  it('throws DaysError("FETCH_ERROR") on non-2xx', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response('not found', { status: 404, statusText: 'Not Found' }),
    ) as unknown as typeof fetch

    await expect(fetchJson(URL)).rejects.toMatchObject({
      code: 'FETCH_ERROR',
      url: URL,
    })
  })

  it('throws DaysError("PARSE_ERROR") on invalid JSON', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response('not json', { status: 200 }),
    ) as unknown as typeof fetch

    await expect(fetchJson(URL)).rejects.toMatchObject({
      code: 'PARSE_ERROR',
      url: URL,
    })
  })

  it('throws DaysError("NETWORK_ERROR") on transport failure', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch

    await expect(fetchJson(URL)).rejects.toBeInstanceOf(DaysError)
    await expect(fetchJson(URL)).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
  })

  it('throws DaysError("TIMEOUT") when the request exceeds timeoutMs', async () => {
    // Simulate an indefinitely-pending fetch that respects AbortSignal
    globalThis.fetch = vi.fn((_url, init?: { signal?: AbortSignal }) => {
      return new Promise<Response>((_, reject) => {
        const signal = init?.signal
        if (signal) {
          if (signal.aborted) {
            const err = new Error('aborted')
            err.name = 'AbortError'
            reject(err)
            return
          }
          signal.addEventListener('abort', () => {
            const err = new Error('aborted')
            err.name = 'AbortError'
            reject(err)
          })
        }
      })
    }) as unknown as typeof fetch

    await expect(fetchJson(URL, { timeoutMs: 30 })).rejects.toMatchObject({
      code: 'TIMEOUT',
      url: URL,
    })
  })

  it('respects timeoutMs: 0 (no timeout)', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    ) as unknown as typeof fetch

    const result = await fetchJson(URL, { timeoutMs: 0 })
    expect(result).toEqual({ ok: true })
  })
})
