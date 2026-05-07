import { describe, it, expect } from 'vitest'
import { DaysError } from './errors.js'

describe('DaysError', () => {
  it('exposes code and url fields', () => {
    const err = new DaysError('NETWORK_ERROR', 'failed', 'https://example.com/x')
    expect(err.code).toBe('NETWORK_ERROR')
    expect(err.url).toBe('https://example.com/x')
    expect(err.message).toBe('failed')
    expect(err.name).toBe('DaysError')
  })

  it('passes instanceof checks across transpiled boundaries', () => {
    const err = new DaysError('FETCH_ERROR', 'boom')
    expect(err).toBeInstanceOf(DaysError)
    expect(err).toBeInstanceOf(Error)
  })

  it('allows omitting the url', () => {
    const err = new DaysError('INVALID_DATE', 'bad')
    expect(err.url).toBeUndefined()
  })
})
