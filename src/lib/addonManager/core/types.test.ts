import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import {
  type BrowserError,
  type SceneryError,
  browserErrorText,
  getBrowserErrorMessage,
  isPluginInUse,
  sceneryErrorText,
} from './types';

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

describe('add-on error texts', () => {
  const en = JSON.parse(
    readFileSync(new URL('../../../i18n/locales/en.json', import.meta.url), 'utf-8')
  ) as {
    addonManager: {
      browser: { errors: Record<string, string> };
      scenery: { errors: Record<string, string> };
    };
  };

  it('maps every browser failure to a translated key', () => {
    const cases: BrowserError[] = [
      { code: 'NOT_FOUND', path: 'x' },
      { code: 'SCAN_FAILED', path: 'x', reason: 'r' },
      { code: 'TOGGLE_FAILED', path: 'x', reason: 'r' },
      { code: 'TOGGLE_FAILED', path: 'x', reason: "EPERM rename 'a.xpl'" },
      { code: 'TOGGLE_FAILED', path: 'x', reason: 'EPERM mkdir' },
      { code: 'DELETE_FAILED', path: 'x', reason: 'r' },
      { code: 'DELETE_FAILED', path: 'x', reason: 'EPERM' },
      { code: 'PATH_TRAVERSAL', path: 'x' },
      { code: 'INVALID_INPUT', field: 'f' },
    ];
    for (const error of cases) {
      const { key } = browserErrorText(error);
      expect(
        en.addonManager.browser.errors[key.replace('addonManager.browser.errors.', '')]
      ).toBeTypeOf('string');
    }
    expect(
      browserErrorText({ code: 'TOGGLE_FAILED', path: 'x', reason: "EPERM rename 'a.xpl'" }).key
    ).toBe('addonManager.browser.errors.PLUGIN_IN_USE');
  });

  it('maps every scenery failure to a translated key', () => {
    const cases: SceneryError[] = [
      { code: 'INI_NOT_FOUND', path: 'x' },
      { code: 'INI_PARSE_ERROR', line: 3, content: 'c' },
      { code: 'FOLDER_NOT_FOUND', folderName: 'f' },
      { code: 'DSF_INVALID', path: 'x', reason: 'r' },
      { code: 'DSF_COMPRESSED', path: 'x' },
      { code: 'WRITE_FAILED', path: 'x', reason: 'r' },
      { code: 'BACKUP_FAILED', reason: 'r' },
    ];
    for (const error of cases) {
      const { key } = sceneryErrorText(error);
      expect(
        en.addonManager.scenery.errors[key.replace('addonManager.scenery.errors.', '')]
      ).toBeTypeOf('string');
    }
  });
});
