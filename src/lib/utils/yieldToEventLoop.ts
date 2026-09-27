/**
 * Let the event loop drain between slices of synchronous work. Bulk database
 * inserts run in chunks on the main process; awaiting this between chunks
 * keeps IPC and window events responsive while the total work is unchanged.
 */
export function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
