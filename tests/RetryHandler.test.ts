import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.stubEnv('FALCON_USERNAME', 'user@example.com');
vi.stubEnv('FALCON_PASSWORD', 'password123');
vi.stubEnv('FALCON_AUTH_SECRET', 'JBSWY3DPEHPK3PXP');
vi.stubEnv('APP_NAME', 'test-app');

import { RetryHandler } from '../src';

describe('RetryHandler', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('withRetry', () => {
    it('returns result on first success', async () => {
      const result = await RetryHandler.withRetry(
        async () => 42,
        'test-op',
      );
      expect(result).toBe(42);
    });

    it('does not retry by default (shouldRetry defaults to false)', async () => {
      let calls = 0;
      await expect(
        RetryHandler.withRetry(
          async () => { calls++; throw new Error('fail'); },
          'test-op',
          { maxAttempts: 3 },
        )
      ).rejects.toThrow('fail');
      expect(calls).toBe(1);
    });

    it('retries when shouldRetry returns true', async () => {
      let calls = 0;
      await expect(
        RetryHandler.withRetry(
          async () => { calls++; throw new Error('transient'); },
          'test-op',
          { maxAttempts: 3, delay: 1, shouldRetry: () => true },
        )
      ).rejects.toThrow('transient');
      expect(calls).toBe(3);
    });

    it('succeeds on a later attempt', async () => {
      let calls = 0;
      const result = await RetryHandler.withRetry(
        async () => {
          calls++;
          if (calls < 3) throw new Error('not yet');
          return 'done';
        },
        'test-op',
        { maxAttempts: 5, delay: 1, shouldRetry: () => true },
      );
      expect(result).toBe('done');
      expect(calls).toBe(3);
    });

    it('uses exponential backoff by default', async () => {
      const timestamps: number[] = [];
      let calls = 0;
      const start = Date.now();

      await expect(
        RetryHandler.withRetry(
          async () => { calls++; timestamps.push(Date.now() - start); throw new Error('fail'); },
          'test-op',
          { maxAttempts: 3, delay: 50, shouldRetry: () => true },
        )
      ).rejects.toThrow('fail');

      expect(calls).toBe(3);
      // Between attempt 1→2: ~50ms, between 2→3: ~100ms (exponential)
      const gap1 = timestamps[1] - timestamps[0];
      const gap2 = timestamps[2] - timestamps[1];
      expect(gap2).toBeGreaterThan(gap1);
    });

    it('uses linear backoff when specified', async () => {
      const timestamps: number[] = [];
      let calls = 0;
      const start = Date.now();

      await expect(
        RetryHandler.withRetry(
          async () => { calls++; timestamps.push(Date.now() - start); throw new Error('fail'); },
          'test-op',
          { maxAttempts: 3, delay: 50, backoff: 'linear', shouldRetry: () => true },
        )
      ).rejects.toThrow('fail');

      expect(calls).toBe(3);
      // Both gaps should be ~50ms (linear)
      const gap1 = timestamps[1] - timestamps[0];
      const gap2 = timestamps[2] - timestamps[1];
      expect(Math.abs(gap2 - gap1)).toBeLessThan(30);
    });

    it('wraps non-Error throws', async () => {
      await expect(
        RetryHandler.withRetry(
          async () => { throw 'string error'; },
          'test-op',
        )
      ).rejects.toThrow('string error');
    });
  });

  describe('withPlaywrightRetry', () => {
    it('retries timeout errors', async () => {
      let calls = 0;
      await expect(
        RetryHandler.withPlaywrightRetry(
          async () => { calls++; throw new Error('timeout 30000ms exceeded'); },
          'test-op',
          { maxAttempts: 3, delay: 1 },
        )
      ).rejects.toThrow('timeout');
      expect(calls).toBe(3);
    });

    it('retries "waiting for" errors', async () => {
      let calls = 0;
      await expect(
        RetryHandler.withPlaywrightRetry(
          async () => { calls++; throw new Error('waiting for selector'); },
          'test-op',
          { maxAttempts: 2, delay: 1 },
        )
      ).rejects.toThrow('waiting for');
      expect(calls).toBe(2);
    });

    it('retries "not found" errors', async () => {
      let calls = 0;
      await expect(
        RetryHandler.withPlaywrightRetry(
          async () => { calls++; throw new Error('element not found'); },
          'test-op',
          { maxAttempts: 2, delay: 1 },
        )
      ).rejects.toThrow('not found');
      expect(calls).toBe(2);
    });

    it('does not retry assertion errors', async () => {
      let calls = 0;
      await expect(
        RetryHandler.withPlaywrightRetry(
          async () => { calls++; throw new Error('expect(locator).toBeVisible'); },
          'test-op',
          { maxAttempts: 3, delay: 1 },
        )
      ).rejects.toThrow('expect(');
      expect(calls).toBe(1);
    });

    it('respects custom shouldRetry in addition to built-in checks', async () => {
      let calls = 0;
      await expect(
        RetryHandler.withPlaywrightRetry(
          async () => { calls++; throw new Error('custom retriable error'); },
          'test-op',
          {
            maxAttempts: 3,
            delay: 1,
            shouldRetry: (err) => err.message.includes('custom retriable'),
          },
        )
      ).rejects.toThrow('custom retriable');
      expect(calls).toBe(3);
    });

    it('does not retry unknown errors', async () => {
      let calls = 0;
      await expect(
        RetryHandler.withPlaywrightRetry(
          async () => { calls++; throw new Error('something completely different'); },
          'test-op',
          { maxAttempts: 3, delay: 1 },
        )
      ).rejects.toThrow('something completely different');
      expect(calls).toBe(1);
    });
  });
});
