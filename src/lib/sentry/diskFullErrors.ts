/**
 * `ENOSPC` means the user's disk filled up mid-write. Node raises it from any
 * fs call, so it reaches Sentry from wherever we happened to be writing at the
 * time — the tile cache, `saveDb`, the launcher — landing as several separate
 * issues that all say the same thing about the machine and nothing about the
 * app. Callers already handle the failure; only the report is dropped.
 *
 * Unlike `TRANSIENT_NET_ERROR_PATTERN` this can't be expressed as an
 * `ignoreErrors` entry: the message embeds the failing path, so every caller
 * words it differently and a pattern loose enough to catch them all would be
 * loose enough to swallow real bugs. It's checked in `beforeSend` instead,
 * where the original exception — and its exact errno `code` — is still
 * reachable on the hint.
 */

const DISK_FULL_MESSAGE_PATTERN = /\bENOSPC\b/;

/** Depth cap so a self-referencing `cause` chain can't spin forever. */
const MAX_CAUSE_DEPTH = 5;

interface SerializedException {
  value?: string;
}

interface CapturedEvent {
  exception?: { values?: SerializedException[] };
}

/**
 * True when `error`, or anything it wraps via `cause`, is a disk-full failure.
 * Prefers the errno `code` and falls back to the message, since an error that
 * crossed a process or serialization boundary keeps its text but loses `code`.
 */
export function isDiskFullError(error: unknown): boolean {
  let current = error;

  for (let depth = 0; current && depth < MAX_CAUSE_DEPTH; depth++) {
    if ((current as NodeJS.ErrnoException).code === 'ENOSPC') return true;

    const message =
      current instanceof Error ? current.message : typeof current === 'string' ? current : '';
    if (DISK_FULL_MESSAGE_PATTERN.test(message)) return true;

    current = current instanceof Error ? current.cause : undefined;
  }

  return false;
}

/**
 * True when a Sentry event should be dropped as disk-full noise. `beforeSend`
 * gets the original exception on the hint, but it is absent for events that
 * were captured as messages or rehydrated, so the serialized exception values
 * are checked as a fallback.
 */
export function isDiskFullEvent(event: CapturedEvent, originalException: unknown): boolean {
  if (isDiskFullError(originalException)) return true;

  return Boolean(
    event.exception?.values?.some(
      (value) => value.value && DISK_FULL_MESSAGE_PATTERN.test(value.value)
    )
  );
}
