import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type StartupFailure,
  buildStartupReport,
  describeStartupFailure,
  formatStartupError,
  hostFromUserAgent,
  isModuleLoadError,
  shouldRetryLoad,
  startupFailureHtml,
} from './startupFallback';

const ELECTRON_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) X-Dispatch/2.4.0 Chrome/136.0.0.0 Electron/36.0.0 Safari/537.36';
const IPAD_UA =
  'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

function failure(partial: Partial<StartupFailure> = {}): StartupFailure {
  return { host: 'desktop', stage: 'load', error: 'TypeError: x', logPath: null, ...partial };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('hostFromUserAgent', () => {
  it('tells the Electron window from a tablet browser', () => {
    expect(hostFromUserAgent(ELECTRON_UA)).toBe('desktop');
    expect(hostFromUserAgent(IPAD_UA)).toBe('browser');
  });
});

describe('describeStartupFailure', () => {
  it('blames a content blocker only in a browser', () => {
    const browser = describeStartupFailure(failure({ host: 'browser' }));
    expect(browser.lines.join(' ')).toMatch(/content blocker/);
    expect(browser.lines.join(' ')).toMatch(/same network/);
    expect(browser.showLog).toBe(false);

    const desktop = describeStartupFailure(failure());
    expect(desktop.title).toBe('X-Dispatch could not start');
    expect(desktop.lines.join(' ')).not.toMatch(/extension|blocker/);
    expect(desktop.lines.join(' ')).toMatch(/Reload the window/);
    expect(desktop.lines.join(' ')).toMatch(/Discord/);
    expect(desktop.showLog).toBe(true);
  });

  it('words a failure while drawing differently from one while loading', () => {
    expect(describeStartupFailure(failure({ stage: 'render' })).title).toBe(
      'X-Dispatch stopped working'
    );
  });
});

describe('buildStartupReport', () => {
  it('carries host, stage, error and user agent', () => {
    expect(
      buildStartupReport({ host: 'browser', stage: 'load', error: 'TypeError: x' }, IPAD_UA)
    ).toEqual({ host: 'browser', stage: 'load', error: 'TypeError: x', userAgent: IPAD_UA });
  });
});

describe('isModuleLoadError', () => {
  it('matches a failed dynamic import in every browser wording', () => {
    expect(
      isModuleLoadError(
        new TypeError(
          'Failed to fetch dynamically imported module: http://localhost:5173/src/bootstrap.tsx?t=1791691855492'
        )
      )
    ).toBe(true);
    expect(isModuleLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isModuleLoadError(new TypeError('error loading dynamically imported module'))).toBe(
      true
    );
    expect(isModuleLoadError(new Error("Cannot read properties of undefined (reading 'x')"))).toBe(
      false
    );
  });
});

describe('shouldRetryLoad', () => {
  function storage(): Storage {
    const map = new Map<string, string>();
    return {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => void map.set(k, v),
      removeItem: (k) => void map.delete(k),
      clear: () => map.clear(),
      key: () => null,
      length: 0,
    };
  }
  const fetchError = new TypeError('Failed to fetch dynamically imported module: x');

  it('reloads once for a failed module fetch', () => {
    const s = storage();
    expect(shouldRetryLoad(fetchError, s)).toBe(true);
    expect(shouldRetryLoad(fetchError, s)).toBe(false);
  });

  it('never retries another kind of error', () => {
    expect(shouldRetryLoad(new Error('boom'), storage())).toBe(false);
  });
});

describe('formatStartupError', () => {
  it('keeps the stack when it carries the message, and copes with non-errors', () => {
    const err = new TypeError('bad');
    expect(formatStartupError(err)).toBe(err.stack);
    expect(formatStartupError('plain')).toBe('plain');
    expect(formatStartupError({ code: 7 })).toBe('{"code":7}');
  });
});
describe('startupFailureHtml', () => {
  it('escapes error text and shows the log path and button on the desktop only', () => {
    const html = startupFailureHtml(
      failure({ error: '<script>alert(1)</script>', logPath: '/Users/me/Library/Logs/x.log' })
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('/Users/me/Library/Logs/x.log');
    expect(html).toContain('data-startup-action="log"');
    expect(html).toContain('data-startup-action="reload"');

    const browser = startupFailureHtml(failure({ host: 'browser' }));
    expect(browser).not.toContain('data-startup-action="log"');
  });
});
