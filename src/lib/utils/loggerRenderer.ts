import log from 'electron-log/renderer';
import * as Sentry from '@sentry/electron/renderer';

/**
 * When a `.error` call's args include an `Error`, forward it to Sentry tagged
 * with the logger scope, as the main-process logger does. Strings and plain
 * objects do not capture: a stack trace is what makes the event useful.
 * Sentry.captureException is a no-op when Sentry.init did not run (consent
 * declined, or the renderer started before the config answered).
 */
function captureIfError(scope: string, msg: string, args: unknown[]): void {
  const err = args.find((a): a is Error => a instanceof Error);
  if (err) Sentry.captureException(err, { tags: { scope }, extra: { msg } });
}

const scoped = (tag: string) => ({
  info: (msg: string, ...args: unknown[]) => log.info(`[${tag}] ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]) => log.warn(`[${tag}] ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) => {
    log.error(`[${tag}] ${msg}`, ...args);
    captureIfError(tag.toLowerCase(), msg, args);
  },
  debug: (msg: string, ...args: unknown[]) => log.debug(`[${tag}] ${msg}`, ...args),
});

const logger = {
  info: log.info.bind(log),
  warn: log.warn.bind(log),
  error: (msg: string, ...args: unknown[]) => {
    log.error(msg, ...args);
    captureIfError('renderer', msg, args);
  },
  debug: log.debug.bind(log),
  renderer: scoped('Renderer'),
  map: scoped('Map'),
  flight: scoped('Flight'),
  weather: scoped('Weather'),
};

export default logger;
