import log from 'electron-log/renderer';

const scoped = (tag: string) => ({
  info: (msg: string, ...args: unknown[]) => log.info(`[${tag}] ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]) => log.warn(`[${tag}] ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) => log.error(`[${tag}] ${msg}`, ...args),
  debug: (msg: string, ...args: unknown[]) => log.debug(`[${tag}] ${msg}`, ...args),
});

const logger = {
  info: log.info.bind(log),
  warn: log.warn.bind(log),
  error: log.error.bind(log),
  debug: log.debug.bind(log),
  renderer: scoped('Renderer'),
  map: scoped('Map'),
  flight: scoped('Flight'),
  weather: scoped('Weather'),
};

export default logger;
