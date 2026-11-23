/** Resolves after `ms` milliseconds. */
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `fn` over every item with at most `limit` running at once, results in input
 * order. For disk scans where an unbounded `Promise.all` would open too many
 * files or hold too much in memory.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (let i = next++; i < items.length; i = next++) {
      results[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * The promise, or a rejection when it takes longer than the deadline. `what` names the thing
 * waited for in the error. The first calls to the desktop go over a WebSocket on a tablet; a
 * socket that never opens would otherwise hold the whole app at a blank page.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  what: string,
  timers: { setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout } = globalThis
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = timers.setTimeout(
      () => reject(new Error(`${what} did not answer within ${ms} ms`)),
      ms
    );
    promise.then(
      (value) => {
        timers.clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        timers.clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    );
  });
}
