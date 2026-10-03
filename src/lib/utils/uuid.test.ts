import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuid } from './uuid';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => vi.unstubAllGlobals());

describe('uuid', () => {
  it('returns a v4 UUID', () => {
    expect(uuid()).toMatch(V4);
    expect(uuid()).not.toBe(uuid());
  });

  it('still works where crypto.randomUUID is missing (plain HTTP on a LAN)', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto),
    });
    expect(uuid()).toMatch(V4);
  });
});
