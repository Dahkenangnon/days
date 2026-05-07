import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { resolve, setConfig, getConfig } from './resolver.js'
import { DaysError } from './errors.js'

describe('resolver', () => {
  let originalFetch: typeof globalThis.fetch
  let originalConfig: ReturnType<typeof getConfig>

  beforeEach(() => {
    originalFetch = globalThis.fetch
    originalConfig = getConfig()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    setConfig(originalConfig)
    vi.restoreAllMocks()
  })

  it('rejects path traversal attempts before touching fs or network', async () => {
    await expect(resolve('../../etc/passwd')).rejects.toBeInstanceOf(DaysError)
    await expect(resolve('../../etc/passwd')).rejects.toMatchObject({
      code: 'CACHE_READ_ERROR',
    })
  })

  it('rejects absolute paths', async () => {
    await expect(resolve('/etc/passwd')).rejects.toMatchObject({
      code: 'CACHE_READ_ERROR',
    })
  })

  it('falls back to CDN when local cache misses', async () => {
    setConfig({
      baseUrl: 'https://days.example.com',
      cacheDir: '/nonexistent/path/that/does/not/exist',
      fallbackToCdn: true,
      timeoutMs: 1_000,
    })

    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ schemaVersion: '1.0' }), { status: 200 }),
    ) as unknown as typeof fetch

    const data = await resolve<{ schemaVersion: string }>('bj/2026/01.json')
    expect(data.schemaVersion).toBe('1.0')
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://days.example.com/bj/2026/01.json',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('throws CACHE_MISS when fallbackToCdn is disabled and cache is empty', async () => {
    setConfig({
      baseUrl: 'https://days.example.com',
      cacheDir: '/nonexistent/path/that/does/not/exist',
      fallbackToCdn: false,
      timeoutMs: 1_000,
    })

    await expect(resolve('bj/2026/01.json')).rejects.toMatchObject({
      code: 'CACHE_MISS',
    })
  })

  it('strips trailing slash on baseUrl when building CDN URL', async () => {
    setConfig({
      baseUrl: 'https://days.example.com/',
      cacheDir: '/nonexistent',
      fallbackToCdn: true,
      timeoutMs: 1_000,
    })

    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({}), { status: 200 }),
    ) as unknown as typeof fetch

    await resolve('x.json')
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://days.example.com/x.json',
      expect.anything(),
    )
  })
})
