/**
 * Forwards main-process warnings and errors from electron-log to Sentry Logs.
 *
 * Issues only see exceptions. The 2.9.0 startup freeze threw nothing and only
 * ever appeared as a timing line in the local log, which no one could query.
 * Warnings and errors are rare enough per launch to send as structured logs;
 * info and debug stay on disk, where the log tail attached to issues has them.
 */

export interface ForwardedLog {
  level: 'warn' | 'error';
  message: string;
  attributes: Record<string, string>;
}

const SCOPE_PREFIX = /^\[([A-Za-z]+)\]\s*/;

/** The Sentry log for an electron-log line, or null for levels that stay local. */
export function sentryLogFor(level: string, data: unknown[]): ForwardedLog | null {
  if (level !== 'warn' && level !== 'error') return null;
  const [first, ...rest] = data;
  const text = typeof first === 'string' ? first : String(first);
  const scope = SCOPE_PREFIX.exec(text)?.[1]?.toLowerCase() ?? 'default';
  const attributes: Record<string, string> = { scope };
  const error = rest.find((a): a is Error => a instanceof Error);
  if (error) attributes.error = error.message;
  return { level, message: text.replace(SCOPE_PREFIX, ''), attributes };
}

export const MAX_FORWARDED_PER_SESSION = 50;
export const MAX_FORWARDED_LENGTH = 500;

/**
 * A per-session forwarder: each distinct warning or error goes once, long
 * messages are cut, and after the cap one final line says forwarding paused.
 * A parse warning repeated on every launch, or an error loop, then costs a
 * handful of lines instead of the whole quota.
 */
export function createLogForwarder(): (level: string, data: unknown[]) => ForwardedLog | null {
  const seen = new Set<string>();
  let sent = 0;
  let paused = false;
  return (level, data) => {
    const entry = sentryLogFor(level, data);
    if (!entry) return null;
    const message = entry.message.slice(0, MAX_FORWARDED_LENGTH);
    if (seen.has(message)) return null;
    if (sent >= MAX_FORWARDED_PER_SESSION) {
      if (paused) return null;
      paused = true;
      return {
        level: 'warn',
        message: `Log forwarding paused after ${MAX_FORWARDED_PER_SESSION} lines this session`,
        attributes: { scope: 'sentry' },
      };
    }
    seen.add(message);
    sent++;
    return { ...entry, message };
  };
}
