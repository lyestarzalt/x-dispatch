import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import {
  type BrowserError,
  type SceneryError,
  browserErrorText,
  getBrowserErrorMessage,
  sceneryErrorText,
} from './types';

describe('a file another program holds open', () => {
  it('says to close X-Plane when the file is a plugin binary', () => {
    const error: BrowserError = {
      code: 'FILE_IN_USE',
      path: 'D:\\X-Plane 12\\Resources\\plugins\\Foo\\64\\win.xpl',
      fileName: 'win.xpl',
      reason: 'EPERM',
    };
    expect(browserErrorText(error)).toEqual({
      key: 'addonManager.browser.errors.PLUGIN_IN_USE',
      params: {},
    });
  });

  it('says to close X-Plane when the held file is a plugin folder', () => {
    // Sentry X-DISPATCH-A4: deleting a plugin X-Plane had loaded named the folder instead.
    const error: BrowserError = {
      code: 'FILE_IN_USE',
      path: 'D:\\Steam\\steamapps\\common\\X-Plane 12\\Resources\\plugins\\SimLoadManager',
      fileName: 'SimLoadManager',
      reason: 'EPERM',
    };
    expect(browserErrorText(error)).toEqual({
      key: 'addonManager.browser.errors.PLUGIN_IN_USE',
      params: {},
    });
  });

  it('names any other file', () => {
    const error: BrowserError = {
      code: 'FILE_IN_USE',
      path: 'D:\\X-Plane 12\\Aircraft\\A\\manual.pdf',
      fileName: 'manual.pdf',
      reason: 'EPERM',
    };
    expect(browserErrorText(error)).toEqual({
      key: 'addonManager.browser.errors.FILE_IN_USE',
      params: { fileName: 'manual.pdf' },
    });
    expect(
      sceneryErrorText({ code: 'FILE_IN_USE', path: 'x', fileName: 'KLGA_CHARTS.pdf', reason: 'r' })
    ).toEqual({
      key: 'addonManager.scenery.errors.FILE_IN_USE',
      params: { fileName: 'KLGA_CHARTS.pdf' },
    });
  });

  it('keeps the administrator advice for a protected folder', () => {
    const message = getBrowserErrorMessage({
      code: 'TOGGLE_FAILED',
      path: 'Foo',
      reason: "EPERM: operation not permitted, rename 'C:\\Program Files\\X-Plane 12\\a.xpl'",
    });
    expect(message).toContain('administrator');
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
      { code: 'FILE_IN_USE', path: 'x', fileName: 'a.xpl', reason: 'r' },
      { code: 'FILE_IN_USE', path: 'x', fileName: 'a.pdf', reason: 'r' },
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
  });

  it('maps every scenery failure to a translated key', () => {
    const cases: SceneryError[] = [
      { code: 'INI_NOT_FOUND', path: 'x' },
      { code: 'INI_PARSE_ERROR', line: 3, content: 'c' },
      { code: 'FOLDER_NOT_FOUND', folderName: 'f' },
      { code: 'DSF_INVALID', path: 'x', reason: 'r' },
      { code: 'DSF_COMPRESSED', path: 'x' },
      { code: 'WRITE_FAILED', path: 'x', reason: 'r' },
      { code: 'DELETE_FAILED', path: 'x', reason: 'r' },
      { code: 'FILE_IN_USE', path: 'x', fileName: 'f', reason: 'r' },
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
