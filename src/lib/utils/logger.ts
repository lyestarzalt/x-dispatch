import { app } from 'electron';
import log from 'electron-log/main';
import * as Sentry from '@sentry/electron/main';
import * as fs from 'fs';

log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}';
log.transports.console.format = '[{level}] {text}';

const isDev = !app.isPackaged;

if (isDev) {
  log.transports.file.level = 'debug';
  log.transports.console.level = 'debug';
} else {
  log.transports.file.level = 'info';
  log.transports.console.level = 'warn';
}

const logFile = log.transports.file.getFile();
if (logFile) {
  try {
    fs.writeFileSync(logFile.path, '');
  } catch {
    /* ignore */
  }
}

log.transports.file.maxSize = 1 * 1024 * 1024;

/**
 * When a `.error` call's args include an `Error` instance, forward it to
 * Sentry tagged with the originating logger scope. The `msg` becomes an
 * extra so the issue title in Sentry matches what we logged. Plain-object
 * payloads (e.g. `logger.data.error('X', { foo: 1 })`) intentionally do
 * NOT trigger capture — callers that want a Sentry event must hand us an
 * actual `Error` so the stack trace is meaningful. Sentry.captureException
 * is a no-op when Sentry.init didn't run (consent declined / not yet
 * initialized), so we don't need to guard it.
 */
function captureIfError(scope: string, msg: string, args: unknown[]): void {
  const err = args.find((a): a is Error => a instanceof Error);
  if (err) {
    Sentry.captureException(err, { tags: { scope }, extra: { msg } });
  }
}

const logger = {
  info: (message: string, ...args: unknown[]) => log.info(message, ...args),
  warn: (message: string, ...args: unknown[]) => log.warn(message, ...args),
  error: (message: string, ...args: unknown[]) => {
    log.error(message, ...args);
    captureIfError('default', message, args);
  },
  debug: (message: string, ...args: unknown[]) => log.debug(message, ...args),

  main: {
    info: (msg: string, ...args: unknown[]) => log.info(`[Main] ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) => log.warn(`[Main] ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => {
      log.error(`[Main] ${msg}`, ...args);
      captureIfError('main', msg, args);
    },
    debug: (msg: string, ...args: unknown[]) => log.debug(`[Main] ${msg}`, ...args),
  },

  data: {
    info: (msg: string, ...args: unknown[]) => log.info(`[Data] ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) => log.warn(`[Data] ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => {
      log.error(`[Data] ${msg}`, ...args);
      captureIfError('data', msg, args);
    },
    debug: (msg: string, ...args: unknown[]) => log.debug(`[Data] ${msg}`, ...args),
  },

  ipc: {
    info: (msg: string, ...args: unknown[]) => log.info(`[IPC] ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) => log.warn(`[IPC] ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => {
      log.error(`[IPC] ${msg}`, ...args);
      captureIfError('ipc', msg, args);
    },
    debug: (msg: string, ...args: unknown[]) => log.debug(`[IPC] ${msg}`, ...args),
  },

  security: {
    info: (msg: string, ...args: unknown[]) => log.info(`[Security] ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) => log.warn(`[Security] ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => {
      log.error(`[Security] ${msg}`, ...args);
      captureIfError('security', msg, args);
    },
  },

  launcher: {
    info: (msg: string, ...args: unknown[]) => log.info(`[Launcher] ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) => log.warn(`[Launcher] ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => {
      log.error(`[Launcher] ${msg}`, ...args);
      captureIfError('launcher', msg, args);
    },
    debug: (msg: string, ...args: unknown[]) => log.debug(`[Launcher] ${msg}`, ...args),
  },

  tracker: {
    info: (msg: string, ...args: unknown[]) => log.info(`[Tracker] ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) => log.warn(`[Tracker] ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => {
      log.error(`[Tracker] ${msg}`, ...args);
      captureIfError('tracker', msg, args);
    },
    debug: (msg: string, ...args: unknown[]) => log.debug(`[Tracker] ${msg}`, ...args),
  },

  addon: {
    info: (msg: string, ...args: unknown[]) => log.info(`[Addon] ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) => log.warn(`[Addon] ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => {
      log.error(`[Addon] ${msg}`, ...args);
      captureIfError('addon', msg, args);
    },
    debug: (msg: string, ...args: unknown[]) => log.debug(`[Addon] ${msg}`, ...args),
  },
};

export function getLogPath(): string {
  return log.transports.file.getFile().path;
}

export default logger;
