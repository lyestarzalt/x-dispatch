import { errorMessage } from '@/lib/utils/errors';

/**
 * What a start that goes wrong shows instead of a blank page, and what it reports to main.
 * Pure, so it can be tested without a DOM; the page wiring is startupPage.ts. It runs before
 * i18n, React or the design tokens exist (any of them may be what failed), so it has no
 * imports, uses system colours, and its text is English on purpose.
 */

/** Where the page runs: the Electron window, or a browser on another device (tablet access). */
export type StartupHost = 'desktop' | 'browser';

/** Where it broke: loading the app's modules, or React drawing the window. */
export type StartupStage = 'load' | 'render';

export interface StartupFailure {
  host: StartupHost;
  stage: StartupStage;
  error: string;
  logPath: string | null;
}

/** What main receives, logs and forwards to Sentry. Plain data: it crosses IPC or a WebSocket. */
export interface StartupFailureReport {
  host: StartupHost;
  stage: StartupStage;
  /** Message and stack. */
  error: string;
  userAgent: string;
}

export interface StartupFailureText {
  title: string;
  lines: string[];
  showLog: boolean;
}

/** How long the first call to the desktop may take before the app renders without its answer. */
export const BRIDGE_CALL_TIMEOUT_MS = 5_000;
const DISCORD_HINT = 'If it keeps happening, share the log file on the X-Dispatch Discord server.';

/** Electron puts its own token in the user agent; a tablet browser has none. */
export function hostFromUserAgent(userAgent: string): StartupHost {
  return /\bElectron\//.test(userAgent) ? 'desktop' : 'browser';
}

/** Message first, then the stack, so a screenshot of the page is enough to act on. */
export function formatStartupError(err: unknown): string {
  if (err instanceof Error) {
    return err.stack && err.stack.includes(err.message) ? err.stack : `${err.name}: ${err.message}`;
  }
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/** Browsers word a failed module fetch differently; the dev server restarting looks like any of them. */
export function isModuleLoadError(err: unknown): boolean {
  const message = errorMessage(err);
  return /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(
    message
  );
}

/** The words for the fallback page, by where it runs and where it broke. */
export function describeStartupFailure(failure: StartupFailure): StartupFailureText {
  if (failure.host === 'browser') {
    return {
      title: 'X-Dispatch could not load',
      lines: [
        'A browser extension such as an ad or content blocker may have blocked part of the app. Turn it off for this address and reload.',
        'Make sure X-Dispatch is still running on the computer and that this device is on the same network.',
      ],
      showLog: false,
    };
  }
  return {
    title: failure.stage === 'render' ? 'X-Dispatch stopped working' : 'X-Dispatch could not start',
    lines: ['Reload the window, or quit and open X-Dispatch again.', DISCORD_HINT],
    showLog: true,
  };
}

export function buildStartupReport(
  failure: Pick<StartupFailure, 'host' | 'stage' | 'error'>,
  userAgent: string
): StartupFailureReport {
  return { host: failure.host, stage: failure.stage, error: failure.error, userAgent };
}

/**
 * The promise, or a rejection when it takes longer than the deadline. The first calls to the
 * desktop go over a WebSocket on a tablet; a socket that never opens would otherwise hold the
 * whole app at a blank page.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  what: string,
  timers: { setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout } = globalThis
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = timers.setTimeout(
      () => reject(new Error(`${what} did not answer within ${ms} ms`)),
      ms
    );
    promise.then(
      (value) => {
        timers.clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        timers.clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    );
  });
}

const RETRY_FLAG_KEY = 'x-dispatch-startup-retried';

/**
 * A module that fails to load is usually transient: the dev server rebuilding, a tablet page
 * served before the desktop updated its chunks, or a dropped fetch. A reload fixes it, once:
 * a second failure is a real one.
 */
export function shouldRetryLoad(
  err: unknown,
  storage: Pick<Storage, 'getItem' | 'setItem'>
): boolean {
  if (!isModuleLoadError(err)) return false;
  if (storage.getItem(RETRY_FLAG_KEY)) return false;
  storage.setItem(RETRY_FLAG_KEY, '1');
  return true;
}

export function clearRetryFlag(storage: Pick<Storage, 'removeItem'>): void {
  storage.removeItem(RETRY_FLAG_KEY);
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** The fallback page: system fonts and colours only, since the app's stylesheet may be what failed. */
export function startupFailureHtml(failure: StartupFailure): string {
  const text = describeStartupFailure(failure);
  const lines = text.lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('');
  const logPath = failure.logPath
    ? `<p style="opacity:.7;font-size:.85rem">Log file: <code>${escapeHtml(failure.logPath)}</code></p>`
    : '';
  const buttonStyle = 'font:inherit;padding:.4rem 1rem;cursor:pointer';
  const openLog = text.showLog
    ? `<button type="button" data-startup-action="log" style="${buttonStyle}">Open log file</button>`
    : '';
  return (
    '<div style="font-family:system-ui,sans-serif;color-scheme:light dark;background:Canvas;color:CanvasText;' +
    'min-height:100vh;box-sizing:border-box;padding:2rem;line-height:1.5">' +
    '<div style="max-width:40rem;margin:0 auto">' +
    `<h1 style="font-size:1.25rem;margin:0 0 1rem">${escapeHtml(text.title)}</h1>` +
    lines +
    '<p style="display:flex;gap:.5rem;flex-wrap:wrap;margin:1.5rem 0">' +
    `<button type="button" data-startup-action="reload" style="${buttonStyle}">Reload</button>` +
    openLog +
    '</p>' +
    `<pre style="white-space:pre-wrap;word-break:break-word;opacity:.7;font-size:.8rem">${escapeHtml(failure.error)}</pre>` +
    logPath +
    '</div></div>'
  );
}
