import { describe, expect, it } from 'vitest';
import { scrubEventPaths, scrubUserPaths } from './scrubPaths';

describe('scrubUserPaths', () => {
  it('hides the account name in Windows, macOS and Linux home paths', () => {
    expect(
      scrubUserPaths("EPERM: rename 'C:\\Users\\Admin\\AppData\\Roaming\\X-Dispatch\\x.db'")
    ).toBe("EPERM: rename 'C:\\Users\\<user>\\AppData\\Roaming\\X-Dispatch\\x.db'");
    expect(scrubUserPaths("open '/Users/ronaldchen/Desktop/XP12/Custom Scenery/apt.dat'")).toBe(
      "open '/Users/<user>/Desktop/XP12/Custom Scenery/apt.dat'"
    );
    expect(scrubUserPaths('/home/lyes/X-Plane 12/')).toBe('/home/<user>/X-Plane 12/');
  });

  it('handles forward slashes and lower-case drive letters on Windows', () => {
    expect(scrubUserPaths('file:///c:/Users/agoes/AppData/Local/XDispatch/app.asar')).toBe(
      'file:///c:/Users/<user>/AppData/Local/XDispatch/app.asar'
    );
  });

  it('leaves everything else alone', () => {
    expect(scrubUserPaths('C:\\X-Plane 12\\Aircraft\\B738')).toBe('C:\\X-Plane 12\\Aircraft\\B738');
    expect(scrubUserPaths('no path here')).toBe('no path here');
  });

  it('scrubs every occurrence', () => {
    expect(scrubUserPaths('/Users/a/x -> /Users/b/y')).toBe('/Users/<user>/x -> /Users/<user>/y');
  });
});

describe('scrubEventPaths', () => {
  it('scrubs the message, every exception value and breadcrumb messages', () => {
    const event = {
      message: "open '/Users/ron/apt.dat'",
      exception: {
        values: [
          { type: 'Error', value: "EPERM 'C:\\Users\\Admin\\x.db'" },
          { type: 'E', value: undefined },
        ],
      },
      breadcrumbs: [{ message: 'read /home/lyes/file' }, { category: 'ui' }],
    };
    const out = scrubEventPaths(event);
    expect(out.message).toBe("open '/Users/<user>/apt.dat'");
    expect(out.exception?.values?.[0]?.value).toBe("EPERM 'C:\\Users\\<user>\\x.db'");
    expect(out.exception?.values?.[1]?.value).toBeUndefined();
    expect(out.breadcrumbs?.[0]?.message).toBe('read /home/<user>/file');
    expect(out.breadcrumbs?.[1]).toEqual({ category: 'ui' });
  });

  it('returns the same event object, for use as beforeSend', () => {
    const event = { message: 'x' };
    expect(scrubEventPaths(event)).toBe(event);
  });
});
