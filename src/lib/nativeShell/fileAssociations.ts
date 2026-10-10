/**
 * Opening `.fms` flight plans from the OS: the macOS Info.plist entries, the
 * Windows per-user registry keys, and the argv check for a file argument.
 *
 * Both platforms list X-Dispatch as an "Open With" choice without taking
 * the default away from whatever the user already uses. Nothing here needs a
 * signed build or admin rights.
 */

export const FMS_EXTENSION = 'fms';
/** The ProgId Windows files the handler under; stable across versions. */
export const WINDOWS_FMS_PROG_ID = 'XDispatch.FlightPlan';
export const FMS_TYPE_NAME = 'X-Plane Flight Plan';
/** Imported UTI for .fms so Launch Services has a content type to match. */
export const MAC_FMS_UTI = 'app.x-dispatch.fms';

/** Extra Info.plist keys for Forge's `packagerConfig.extendInfo`. */
export function macDocumentTypesInfo(): Record<string, unknown> {
  return {
    CFBundleDocumentTypes: [
      {
        CFBundleTypeName: FMS_TYPE_NAME,
        CFBundleTypeRole: 'Viewer',
        // Alternate: listed under Open With, never stealing the default handler.
        LSHandlerRank: 'Alternate',
        LSItemContentTypes: [MAC_FMS_UTI],
      },
    ],
    UTImportedTypeDeclarations: [
      {
        UTTypeIdentifier: MAC_FMS_UTI,
        UTTypeDescription: FMS_TYPE_NAME,
        UTTypeConformsTo: ['public.plain-text', 'public.data'],
        UTTypeTagSpecification: { 'public.filename-extension': [FMS_EXTENSION] },
      },
    ],
  };
}

/**
 * `reg add` argument lists that register the handler for the current user.
 * Idempotent, so main runs them on every launch: the exe path changes with
 * each Squirrel update.
 */
export function windowsFmsRegistryCommands(exePath: string): string[][] {
  const classes = 'HKCU\\Software\\Classes';
  const progId = `${classes}\\${WINDOWS_FMS_PROG_ID}`;
  return [
    [`${progId}`, '/ve', '/t', 'REG_SZ', '/d', FMS_TYPE_NAME, '/f'],
    [`${progId}\\DefaultIcon`, '/ve', '/t', 'REG_SZ', '/d', `"${exePath}",0`, '/f'],
    [`${progId}\\shell\\open\\command`, '/ve', '/t', 'REG_SZ', '/d', `"${exePath}" "%1"`, '/f'],
    // Open With listing only; the default (the empty value of .fms) is left alone.
    [
      `${classes}\\.${FMS_EXTENSION}\\OpenWithProgids`,
      '/v',
      WINDOWS_FMS_PROG_ID,
      '/t',
      'REG_SZ',
      '/d',
      '',
      '/f',
    ],
  ];
}

/** A command line token that is an absolute path to a .fms file. */
export function isFmsFileArg(arg: string): boolean {
  if (typeof arg !== 'string' || arg.startsWith('-') || arg.length > 4096) return false;
  if (!/\.fms$/i.test(arg)) return false;
  // Absolute on either platform: "/Users/…", "C:\…", "\\server\…"
  return /^(\/|[A-Za-z]:[\\/]|\\\\)/.test(arg);
}

/** The .fms file a launch or second instance was asked to open, if any. */
export function findFmsFileInArgv(argv: readonly string[]): string | null {
  return argv.find((arg) => isFmsFileArg(arg)) ?? null;
}
