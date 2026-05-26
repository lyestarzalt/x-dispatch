import { describe, expect, it } from 'vitest';
import { compareSemverLike, isModuleManifest, parseGithubRepo } from './manifest';

describe('modules manifest utils', () => {
  it('validates minimal manifest shape', () => {
    expect(
      isModuleManifest({
        id: 'sia-france',
        name: 'SIA France',
        version: '1.0.0',
        kind: 'bundled',
      })
    ).toBe(true);
    expect(
      isModuleManifest({
        id: 'legacy',
        name: 'Legacy',
        version: '1.0.0',
        kind: 'core',
      })
    ).toBe(true);
    expect(
      isModuleManifest({
        id: 'missing-fields',
        kind: 'external',
      })
    ).toBe(false);
  });

  it('compares semver-like versions', () => {
    expect(compareSemverLike('1.8.4e', '1.8.4')).toBe(true);
    expect(compareSemverLike('1.8.3', '1.8.4')).toBe(false);
    expect(compareSemverLike('v1.9.0', '1.8.4')).toBe(true);
  });

  it('parses github repository references', () => {
    expect(parseGithubRepo('4SLSL/x-dispatch-module-sia-france')).toBe(
      '4SLSL/x-dispatch-module-sia-france'
    );
    expect(parseGithubRepo('https://github.com/4SLSL/x-dispatch-module-sia-france')).toBe(
      '4SLSL/x-dispatch-module-sia-france'
    );
    expect(parseGithubRepo('https://example.com/nope')).toBeNull();
  });
});
