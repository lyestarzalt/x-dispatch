/**
 * Windows lets any process take a lock on a file, so an open can fail simply
 * because something else got there first — antivirus scanning a freshly written
 * file, OneDrive or a backup agent syncing it, the search indexer reading it.
 * Node surfaces these as `UNKNOWN` (the catch-all for a Win32 error it has no
 * errno for), `EBUSY`, `EPERM` or `EACCES` rather than anything descriptive.
 *
 * They clear on their own within a second or two, so the right response is to
 * try again later rather than to report a bug. Note this cannot distinguish a
 * lock from a genuine, permanent permission problem — `EPERM` and `EACCES` mean
 * both — so callers should bound how long they retry instead of assuming the
 * condition always resolves.
 */

const TRANSIENT_FILE_LOCK_CODES = new Set(['UNKNOWN', 'EBUSY', 'EPERM', 'EACCES']);

/** True when `error` looks like a temporary file lock rather than a real fault. */
export function isTransientFileLockError(error: unknown): boolean {
  if (!error) return false;
  const code = (error as NodeJS.ErrnoException).code;
  return typeof code === 'string' && TRANSIENT_FILE_LOCK_CODES.has(code);
}
