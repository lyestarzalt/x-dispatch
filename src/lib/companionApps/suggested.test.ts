import { describe, expect, it } from 'vitest';
import { SUGGESTED_COMPANION_APPS } from './suggested';

describe('SUGGESTED_COMPANION_APPS', () => {
  it('exports a non-empty array', () => {
    expect(SUGGESTED_COMPANION_APPS.length).toBeGreaterThan(0);
  });

  it('includes XPME with --start-service and a mount-friendly delay', () => {
    const xpme = SUGGESTED_COMPANION_APPS.find((s) => s.id === 'xpme');
    expect(xpme).toBeDefined();
    expect(xpme!.args).toBe('--start-service');
    expect(xpme!.delayBeforeXPlaneSec).toBeGreaterThanOrEqual(5);
    expect(xpme!.pathHints.win32).toBeTruthy();
    expect(xpme!.pathHints.darwin).toBeTruthy();
    expect(xpme!.pathHints.linux).toBeTruthy();
  });

  it('has unique ids', () => {
    const ids = SUGGESTED_COMPANION_APPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
