import { describe, expect, it } from 'vitest';
import { isAllowedNavigation } from './navigationGuard';

describe('isAllowedNavigation', () => {
  it('allows the packaged app and the dev server', () => {
    expect(isAllowedNavigation('file:///Applications/X-Dispatch.app/index.html')).toBe(true);
    expect(isAllowedNavigation('http://localhost:5173/?view=flight-strip')).toBe(true);
    expect(isAllowedNavigation('http://127.0.0.1:5173/')).toBe(true);
  });

  it('blocks remote pages and malformed URLs', () => {
    expect(isAllowedNavigation('https://example.com/')).toBe(false);
    expect(isAllowedNavigation('https://localhost.evil.com/')).toBe(false);
    expect(isAllowedNavigation('not a url')).toBe(false);
  });
});
