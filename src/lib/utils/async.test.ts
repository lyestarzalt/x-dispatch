import { afterEach, describe, expect, it, vi } from 'vitest';
import { mapWithConcurrency, withTimeout } from './async';

afterEach(() => {
  vi.useRealTimers();
});

describe('mapWithConcurrency', () => {
  it('keeps results in input order', async () => {
    const out = await mapWithConcurrency([30, 10, 20], 3, async (ms) => {
      await new Promise((r) => setTimeout(r, ms));
      return ms * 2;
    });
    expect(out).toEqual([60, 20, 40]);
  });

  it('never runs more than the limit at once', async () => {
    let running = 0;
    let peak = 0;
    await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async () => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
    });
    expect(peak).toBe(2);
  });

  it('returns an empty list for no items', async () => {
    expect(await mapWithConcurrency([], 4, async (x) => x)).toEqual([]);
  });
});

describe('withTimeout', () => {
  it('passes a prompt answer through and rejects a late one', async () => {
    vi.useFakeTimers();
    await expect(withTimeout(Promise.resolve(true), 100, 'Setting')).resolves.toBe(true);

    const late = withTimeout(new Promise<boolean>(() => undefined), 100, 'Setting');
    const outcome = late.catch((e: Error) => e.message);
    await vi.advanceTimersByTimeAsync(100);
    await expect(outcome).resolves.toBe('Setting did not answer within 100 ms');
  });

  it('keeps the original rejection', async () => {
    await expect(withTimeout(Promise.reject(new Error('nope')), 100, 'Setting')).rejects.toThrow(
      'nope'
    );
  });
});
