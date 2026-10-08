import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { CONTENT_SECURITY_POLICY, CSP_META_PLACEHOLDER } from './csp';

function directive(name: string): string[] {
  const entry = CONTENT_SECURITY_POLICY.split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${name} `));
  return entry ? entry.split(/\s+/).slice(1) : [];
}

describe('CONTENT_SECURITY_POLICY', () => {
  it('never allows eval', () => {
    expect(CONTENT_SECURITY_POLICY).not.toContain('unsafe-eval');
  });

  it('allows the terrain tile host for both images and fetches', () => {
    expect(directive('img-src')).toContain('https://tiles.mapterhorn.com');
    expect(directive('connect-src')).toContain('https://tiles.mapterhorn.com');
  });

  it('keeps blob workers for MapLibre', () => {
    expect(directive('worker-src')).toEqual(["'self'", 'blob:']);
  });

  it('is a single line so it fits an HTTP header', () => {
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/[\r\n]/);
  });

  it('is injected into index.html rather than duplicated there', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
    expect(html).toContain(CSP_META_PLACEHOLDER);
    expect(html).not.toContain('default-src');
  });
});
