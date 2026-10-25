/**
 * The renderer logger mirrors the main one: an `.error` call carrying an
 * `Error` reaches Sentry tagged with its scope, everything else only the log.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import logger from './loggerRenderer';

const log = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));
vi.mock('electron-log/renderer', () => ({ default: log }));

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock('@sentry/electron/renderer', () => sentry);

beforeEach(() => vi.clearAllMocks());

describe('renderer logger Sentry forwarding', () => {
  it('captures the Error passed to a scoped .error call, tagged with the scope', () => {
    const err = new Error('boom');
    logger.flight.error('Flight change failed', err);
    expect(log.error).toHaveBeenCalledWith('[Flight] Flight change failed', err);
    expect(sentry.captureException).toHaveBeenCalledWith(err, {
      tags: { scope: 'flight' },
      extra: { msg: 'Flight change failed' },
    });
  });

  it('captures from the unscoped .error too', () => {
    const err = new Error('boom');
    logger.error('Something broke', err);
    expect(sentry.captureException).toHaveBeenCalledWith(err, {
      tags: { scope: 'renderer' },
      extra: { msg: 'Something broke' },
    });
  });

  it('does not capture a string-only error or any warn', () => {
    logger.map.error('Layer missing', 'nav-vors');
    logger.map.warn('Slow tile', new Error('late'));
    expect(sentry.captureException).not.toHaveBeenCalled();
  });
});
