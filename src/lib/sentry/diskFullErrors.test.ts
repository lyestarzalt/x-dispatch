import { describe, expect, it } from 'vitest';
import { isDiskFullError, isDiskFullEvent } from './diskFullErrors';

function errnoError(code: string, message: string): NodeJS.ErrnoException {
  const error: NodeJS.ErrnoException = new Error(message);
  error.code = code;
  return error;
}

describe('isDiskFullError', () => {
  it('matches on the errno code regardless of wording', () => {
    expect(isDiskFullError(errnoError('ENOSPC', 'write failed'))).toBe(true);
  });

  it.each([
    'ENOSPC: no space left on device, write',
    "ENOSPC: no space left on device, open 'C:\\Users\\eth\\AppData\\Roaming\\X-Dispatch\\tile-cache\\tiles\\008219dbce59ce671bb8c2831d1475f0'",
  ])('matches on the message when errno is missing: %s', (message) => {
    expect(isDiskFullError(new Error(message))).toBe(true);
  });

  it('unwraps a cause chain', () => {
    const wrapped = new Error('Failed to persist airport cache', {
      cause: errnoError('ENOSPC', 'no space left on device, write'),
    });
    expect(isDiskFullError(wrapped)).toBe(true);
  });

  it.each([
    errnoError('EPERM', "EPERM: operation not permitted, open '/Users/les/X-Plane/apt.dat'"),
    errnoError('ENOENT', 'ENOENT: no such file or directory'),
    errnoError('EACCES', 'spawn X-Plane.exe EACCES'),
    new Error('database disk image is malformed'),
    new TypeError('Object has been destroyed'),
  ])('does not match unrelated error %s', (error) => {
    expect(isDiskFullError(error)).toBe(false);
  });

  it.each([null, undefined, '', 0, {}])('does not match non-error value %s', (value) => {
    expect(isDiskFullError(value)).toBe(false);
  });

  it('does not match ENOSPC as a substring of a longer token', () => {
    expect(isDiskFullError(new Error('ENOSPCX: fabricated code'))).toBe(false);
  });

  it('terminates on a self-referencing cause chain', () => {
    const looping: Error & { cause?: unknown } = new Error('outer');
    looping.cause = looping;
    expect(isDiskFullError(looping)).toBe(false);
  });
});

describe('isDiskFullEvent', () => {
  it('drops an event whose original exception is disk-full', () => {
    expect(isDiskFullEvent({}, errnoError('ENOSPC', 'write failed'))).toBe(true);
  });

  it('falls back to serialized exception values when the hint is missing', () => {
    const event = {
      exception: { values: [{ value: 'ENOSPC: no space left on device, write' }] },
    };
    expect(isDiskFullEvent(event, undefined)).toBe(true);
  });

  it('keeps an event that is unrelated to disk space', () => {
    const event = { exception: { values: [{ value: 'TypeError: fetch failed' }] } };
    expect(isDiskFullEvent(event, new TypeError('fetch failed'))).toBe(false);
  });

  it('keeps an event with no exception data at all', () => {
    expect(isDiskFullEvent({}, undefined)).toBe(false);
  });
});
