const IGNORED_PREFIXES: readonly string[] = [
  '--inspect',
  '--inspect-brk',
  '--debug-brk',
  '--remote-debugging-port',
  '--remote-debugging-pipe',
  '--no-sandbox',
  '--enable-logging',
  '--disable-gpu',
  '--disable-extensions',
  '--user-data-dir',
  '--js-flags',
  '--lang',
  '--proxy-server',
  '--ignore-certificate-errors',
  '--enable-crashpad',
  '--enable-features',
  '--disable-features',
] as const;

/**
 * Returns true if the token is an Electron/Chromium flag we should
 * silently pass through (Electron parses argv independently).
 */
export function isIgnoredFlag(token: string): boolean {
  return IGNORED_PREFIXES.some((p) => token === p || token.startsWith(p + '='));
}
