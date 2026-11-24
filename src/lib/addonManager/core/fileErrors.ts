import { errorMessage } from '@/lib/utils/errors';

/** Another program has the file open, so it cannot be renamed or deleted. */
export interface FileInUseError {
  code: 'FILE_IN_USE';
  path: string;
  /** The file's name alone, which is what the user is shown. */
  fileName: string;
  /** Node's message, for the log. */
  reason: string;
}

/** Calls that change a file. A folder that cannot be listed is a different problem. */
const WRITE_SYSCALLS = new Set(['unlink', 'rename', 'rmdir', 'rm', 'open']);

/** `C:\Program Files\…` or `C:\Program Files (x86)\…`, where Windows refuses writes without elevation. */
export function isWindowsProgramFiles(p: string): boolean {
  return /^[A-Za-z]:[\\/]Program Files( \(x86\))?([\\/]|$)/i.test(p);
}

/**
 * The file another program holds open, when that is why a rename or delete
 * failed. EBUSY says so on every platform. Windows also answers EPERM for a
 * loaded plugin or a PDF open in a viewer, the same code it gives a protected
 * folder; outside Program Files the protection does not apply, so EPERM there
 * means the file is in use.
 */
export function fileInUseError(
  e: unknown,
  platform: NodeJS.Platform = process.platform
): FileInUseError | null {
  if (!e || typeof e !== 'object') return null;
  const { code, syscall, path } = e as NodeJS.ErrnoException;
  if (typeof path !== 'string' || !path || !WRITE_SYSCALLS.has(syscall ?? '')) return null;

  const locked =
    code === 'EBUSY' ||
    (platform === 'win32' &&
      (code === 'EPERM' || code === 'EACCES') &&
      !isWindowsProgramFiles(path));
  if (!locked) return null;

  return {
    code: 'FILE_IN_USE',
    path,
    fileName: path.split(/[\\/]/).pop() ?? path,
    reason: errorMessage(e),
  };
}
