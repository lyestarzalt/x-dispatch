import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { validatePathWithin } from './pathGuard';

describe('validatePathWithin', () => {
  const base = path.resolve('/xp/Aircraft');

  it('accepts a path inside the base', () => {
    expect(validatePathWithin(base, path.join(base, 'Laminar', 'B738'))).toBe(true);
  });

  it('rejects the base itself and a parent escape', () => {
    expect(validatePathWithin(base, base)).toBe(false);
    expect(validatePathWithin(base, path.join(base, '..', 'Resources'))).toBe(false);
  });

  it('rejects a sibling that only shares the prefix', () => {
    expect(validatePathWithin(base, `${base}-backup${path.sep}x`)).toBe(false);
  });
});
