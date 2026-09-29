import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildThirdPartyLicenses } from './thirdPartyLicenses';

const ROOT = path.resolve(__dirname, '../../..');

describe('buildThirdPartyLicenses', () => {
  const text = buildThirdPartyLicenses(ROOT);

  it('includes production dependencies with their license text', () => {
    expect(text).toMatch(/^react@\S+ \(MIT\)$/m);
    expect(text).toContain('Permission is hereby granted, free of charge');
  });

  it('leaves out dev dependencies', () => {
    expect(text).not.toMatch(/^vitest@/m);
    expect(text).not.toMatch(/^electron@/m);
  });
});
