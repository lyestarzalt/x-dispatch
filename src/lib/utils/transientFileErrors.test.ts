import { describe, expect, it } from 'vitest';
import { isTransientFileLockError } from './transientFileErrors';

function errnoError(code: string, message = 'boom'): NodeJS.ErrnoException {
  const error: NodeJS.ErrnoException = new Error(message);
  error.code = code;
  return error;
}

describe('isTransientFileLockError', () => {
  it.each(['UNKNOWN', 'EBUSY', 'EPERM', 'EACCES'])('matches lock code %s', (code) => {
    expect(isTransientFileLockError(errnoError(code))).toBe(true);
  });

  it('matches the real shape Windows reports for a locked manifest', () => {
    const error = errnoError(
      'UNKNOWN',
      "UNKNOWN: unknown error, open 'C:\\Users\\keesk\\AppData\\Roaming\\X-Dispatch\\tile-cache\\manifest.json'"
    );
    expect(isTransientFileLockError(error)).toBe(true);
  });

  it.each(['ENOSPC', 'ENOENT', 'EISDIR', 'EROFS', 'EMFILE'])(
    'does not match non-lock code %s',
    (code) => {
      expect(isTransientFileLockError(errnoError(code))).toBe(false);
    }
  );

  it('does not match an error carrying no errno code', () => {
    expect(isTransientFileLockError(new Error('UNKNOWN: unknown error'))).toBe(false);
  });

  it.each([null, undefined, '', 0, {}, 'EBUSY'])('does not match non-error value %s', (value) => {
    expect(isTransientFileLockError(value)).toBe(false);
  });
});
