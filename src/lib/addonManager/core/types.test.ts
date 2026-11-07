import { describe, expect, it } from 'vitest';
import { getBrowserErrorMessage, isPluginInUse } from './types';

describe('plugin toggle errors', () => {
  const locked =
    "EPERM: operation not permitted, rename 'D:\\X-Plane 12\\Resources\\plugins\\Foo\\win_x64\\Foo.xpl' -> 'D:\\X-Plane 12\\Resources\\plugins\\Foo\\win_x64\\Foo.xfmp'";

  it('tells a loaded plugin apart from a protected folder', () => {
    expect(isPluginInUse(locked)).toBe(true);
    expect(isPluginInUse("EPERM: operation not permitted, mkdir 'C:\\Program Files\\X'")).toBe(
      false
    );
    expect(isPluginInUse(undefined)).toBe(false);
  });

  it('says to close X-Plane when its plugin cannot be renamed', () => {
    const message = getBrowserErrorMessage({ code: 'TOGGLE_FAILED', path: 'Foo', reason: locked });
    expect(message).toContain('Close X-Plane');
    expect(message).not.toContain('administrator');
  });
});
