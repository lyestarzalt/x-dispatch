import { resolveBuffer } from '@recent-cli/resolve-lnk';
import { describe, expect, it } from 'vitest';
import { buildMinimalLnk } from './buildLnkFixture';

describe('buildMinimalLnk', () => {
  it('produces a buffer the parser library accepts and recovers an ASCII path', () => {
    const buf = buildMinimalLnk('C:\\X-Plane 12\\Custom Scenery\\Heathrow', 'ascii');
    const target = resolveBuffer(buf);
    expect(target).toBe('C:\\X-Plane 12\\Custom Scenery\\Heathrow');
  });

  it('encodes a UTF-16 path the parser recovers correctly', () => {
    const buf = buildMinimalLnk('D:\\Сцены\\Шереметьево', 'utf16le');
    const target = resolveBuffer(buf);
    expect(target).toBe('D:\\Сцены\\Шереметьево');
  });
});
