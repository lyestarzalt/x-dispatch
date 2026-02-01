import { app } from 'electron';
import log from 'electron-log/main';
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

export const logger = {
  info: (message: string, ...args: unknown[]) => log.info(message, ...args),
  warn: (message: string, ...args: unknown[]) => log.warn(message, ...args),
  error: (message: string, ...args: unknown[]) => log.error(message, ...args),
  debug: (message: string, ...args: unknown[]) => log.debug(message, ...args),

  main: {
    info: (msg: string, ...args: unknown[]) => log.info(`[Main] ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) => log.warn(`[Main] ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => log.error(`[Main] ${msg}`, ...args),
    debug: (msg: string, ...args: unknown[]) => log.debug(`[Main] ${msg}`, ...args),
  },

  data: {
    info: (msg: string, ...args: unknown[]) => log.info(`[Data] ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) => log.warn(`[Data] ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => log.error(`[Data] ${msg}`, ...args),
    debug: (msg: string, ...args: unknown[]) => log.debug(`[Data] ${msg}`, ...args),
  },

  ipc: {
    info: (msg: string, ...args: unknown[]) => log.info(`[IPC] ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) => log.warn(`[IPC] ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => log.error(`[IPC] ${msg}`, ...args),
    debug: (msg: string, ...args: unknown[]) => log.debug(`[IPC] ${msg}`, ...args),
  },

  security: {
    info: (msg: string, ...args: unknown[]) => log.info(`[Security] ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) => log.warn(`[Security] ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => log.error(`[Security] ${msg}`, ...args),
  },

  launcher: {
    info: (msg: string, ...args: unknown[]) => log.info(`[Launcher] ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) => log.warn(`[Launcher] ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => log.error(`[Launcher] ${msg}`, ...args),
    debug: (msg: string, ...args: unknown[]) => log.debug(`[Launcher] ${msg}`, ...args),
  },
};

export function getLogPath(): string {
  return log.transports.file.getFile().path;
}

export default logger;
