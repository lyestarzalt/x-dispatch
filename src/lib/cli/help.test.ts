import { describe, expect, it } from 'vitest';
import { buildHelpText, buildVersionText } from './help';

describe('buildHelpText', () => {
  it('includes the running version in the banner', () => {
    expect(buildHelpText('1.2.3')).toMatch(/X-Dispatch v1\.2\.3/);
  });

  it('mentions all four flags', () => {
    const text = buildHelpText('1.2.3');
    expect(text).toContain('--reset-cache');
    expect(text).toContain('--xp-arg=');
    expect(text).toContain('--help');
    expect(text).toContain('--version');
  });

  it('includes the platform invocation matrix', () => {
    const text = buildHelpText('1.2.3');
    expect(text).toMatch(/macOS/);
    expect(text).toMatch(/Windows/);
    expect(text).toMatch(/Linux/);
  });

  it('explains repetition of --xp-arg=', () => {
    const text = buildHelpText('1.2.3');
    expect(text).toMatch(/Repeat the flag/);
  });
});

describe('buildVersionText', () => {
  it('formats as "X-Dispatch <version>"', () => {
    expect(buildVersionText('1.2.3')).toBe('X-Dispatch 1.2.3\n');
  });
});
