import { describe, it, expect, vi } from 'vitest'
import { withRetry } from '../retry'

describe('withRetry', () => {
  it('returns the result and calls fn once when it succeeds first time', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries and succeeds on a later attempt', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom-1'))
      .mockRejectedValueOnce(new Error('boom-2'))
      .mockResolvedValue('recovered')
    // small delay so the test stays fast
    const result = await withRetry(fn, 3, 1)
    expect(result).toBe('recovered')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('throws the last error after exhausting all retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'))
    await expect(withRetry(fn, 3, 1)).rejects.toThrow('always fails')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('honours a custom retry count', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('nope'))
    await expect(withRetry(fn, 5, 1)).rejects.toThrow('nope')
    expect(fn).toHaveBeenCalledTimes(5)
  })

  it('applies an increasing backoff delay between attempts', async () => {
    vi.useFakeTimers()
    try {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('e1'))
        .mockResolvedValue('done')
      const promise = withRetry(fn, 3, 1000)
      // first attempt runs synchronously and rejects; backoff = 1000 * (0 + 1)
      await vi.advanceTimersByTimeAsync(1000)
      await expect(promise).resolves.toBe('done')
      expect(fn).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})
