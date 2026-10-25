import { describe, expect, it } from 'vitest';
import { errorMessage } from './errors';

describe('errorMessage', () => {
  it('returns the message of an Error', () => {
    expect(errorMessage(new Error('disk full'))).toBe('disk full');
  });

  it('appends the cause, which is where Node keeps the real reason', () => {
    const err = new TypeError('fetch failed', {
      cause: Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }),
    });
    expect(errorMessage(err)).toBe('fetch failed (ECONNRESET: socket hang up)');
  });

  it('walks a chain of causes', () => {
    const inner = new Error('permission denied');
    const mid = new Error('could not open file', { cause: inner });
    expect(errorMessage(new Error('install failed', { cause: mid }))).toBe(
      'install failed (could not open file (permission denied))'
    );
  });

  it('stringifies whatever else was thrown', () => {
    expect(errorMessage('plain string')).toBe('plain string');
    expect(errorMessage(42)).toBe('42');
    expect(errorMessage(undefined)).toBe('undefined');
    expect(errorMessage({ code: 'EACCES' })).toBe('[object Object]');
  });

  it('uses the Node error code when the cause has one and no message', () => {
    expect(errorMessage(new Error('fetch failed', { cause: { code: 'ECONNREFUSED' } }))).toBe(
      'fetch failed (ECONNREFUSED)'
    );
  });
});
