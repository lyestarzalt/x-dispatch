/**
 * Tests for the main-process logger's Sentry forwarding.
 *
 * The logger is the single chokepoint for caught main-process errors —
 * every `logger.<scope>.error(...)` call that includes an `Error` argument
 * should produce one `Sentry.captureException` call tagged with the scope.
 * Non-error log levels and `.error` calls without an Error in args should
 * NOT capture.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock electron — `app.isPackaged` is read at module load to pick log level.
vi.mock('electron', () => ({
  app: { isPackaged: false, getPath: () => '/tmp' },
}));

// Mock electron-log/main so we don't write to a real file or read transport
// internals that don't exist outside an Electron runtime.
vi.mock('electron-log/main', () => {
  const noop = vi.fn();
  return {
    default: {
      info: noop,
      warn: noop,
      error: noop,
      debug: noop,
      transports: {
        file: {
          format: '',
          level: 'debug',
          maxSize: 0,
          getFile: () => ({ path: '/tmp/test.log' }),
        },
        console: { format: '', level: 'debug' },
      },
    },
  };
});

// Mock fs.writeFileSync so the module-load-time log truncation is a no-op.
vi.mock('fs', () => ({ writeFileSync: vi.fn() }));

const captureExceptionMock = vi.fn();
vi.mock('@sentry/electron/main', () => ({
  captureException: captureExceptionMock,
}));

const { default: logger } = await import('./logger');

beforeEach(() => {
  captureExceptionMock.mockClear();
});

describe('logger Sentry forwarding', () => {
  it('captures an Error passed to logger.data.error with the correct scope tag', () => {
    const err = new Error('Failed to load airports');
    logger.data.error('Airport load failed', err);

    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(captureExceptionMock).toHaveBeenCalledWith(err, {
      tags: { scope: 'data' },
      extra: { msg: 'Airport load failed' },
    });
  });

  it('captures the first Error argument when multiple args are passed', () => {
    const err = new Error('boom');
    logger.main.error('Something went wrong', { context: 'startup' }, err, 'trailing string');

    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(captureExceptionMock).toHaveBeenCalledWith(err, {
      tags: { scope: 'main' },
      extra: { msg: 'Something went wrong' },
    });
  });

  it.each([
    ['main', logger.main.error],
    ['data', logger.data.error],
    ['ipc', logger.ipc.error],
    ['security', logger.security.error],
    ['launcher', logger.launcher.error],
    ['tracker', logger.tracker.error],
    ['addon', logger.addon.error],
  ] as const)('tags Sentry events with scope=%s for the matching channel', (scope, fn) => {
    const err = new Error(`oops in ${scope}`);
    fn(`${scope} broke`, err);

    expect(captureExceptionMock).toHaveBeenCalledWith(err, {
      tags: { scope },
      extra: { msg: `${scope} broke` },
    });
  });

  it('does NOT capture when error args contain only plain objects (no Error instance)', () => {
    logger.data.error('Plain object payload', {
      error: 'serialised error message',
      stack: 'fake stack',
    });

    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it('does NOT capture when no extra args are passed', () => {
    logger.main.error('Lonely message with no Error');
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it('does NOT capture for info / warn / debug levels even when given an Error', () => {
    const err = new Error('should not flow to Sentry');
    logger.data.info('info with error', err);
    logger.data.warn('warn with error', err);
    logger.data.debug('debug with error', err);

    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it('captures via the top-level logger.error with scope=default', () => {
    const err = new Error('top-level catch');
    logger.error('Top level boom', err);

    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(captureExceptionMock).toHaveBeenCalledWith(err, {
      tags: { scope: 'default' },
      extra: { msg: 'Top level boom' },
    });
  });
});
