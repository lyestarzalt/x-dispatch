import { describe, expect, it } from 'vitest';
import { parsePort } from './port';

describe('parsePort', () => {
  it('accepts an unprivileged port', () => {
    expect(parsePort('8481')).toBe(8481);
    expect(parsePort(65535)).toBe(65535);
  });

  it('rejects privileged, out-of-range and non-numeric values', () => {
    for (const v of ['80', '0', '65536', 'abc', '', '8480.5', -1]) {
      expect(parsePort(v)).toBeNull();
    }
  });
});
