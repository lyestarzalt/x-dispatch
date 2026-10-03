export const MIN_REMOTE_PORT = 1024;
export const MAX_REMOTE_PORT = 65535;

/** Null unless the value is an integer in the unprivileged range. */
export function parsePort(value: string | number): number | null {
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(n) || n < MIN_REMOTE_PORT || n > MAX_REMOTE_PORT) return null;
  return n;
}
