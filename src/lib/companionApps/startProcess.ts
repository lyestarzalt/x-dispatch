import * as path from 'path';

/**
 * The PowerShell `Start-Process` launch used on Windows.
 *
 * Node's `spawn` is `CreateProcess`, which refuses an app whose manifest asks
 * for administrator rights (error 740) and cannot run a batch file or a
 * shortcut. `Start-Process` is `ShellExecute`, the call Explorer makes: Windows
 * shows its own UAC prompt when an app needs one, and `.bat`, `.cmd` and `.lnk`
 * open as they do from a double click. Heroic Games Launcher and the `open`
 * package launch the same way.
 */

export interface StartProcessInput {
  exePath: string;
  /** Arguments as the user typed them, split on whitespace. */
  args?: string;
  /** Defaults to the executable's folder, as a Windows shortcut's "Start in" does. */
  cwd?: string;
}

/** Windows PowerShell 5.1 ships with every supported Windows and cannot be uninstalled. */
export function windowsPowerShellPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.win32.join(
    env.SystemRoot ?? 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe'
  );
}

/** Flags before `-EncodedCommand`: no profile, no prompts, no policy in the way. */
export const POWERSHELL_FLAGS = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass'];

/** A PowerShell single-quoted string literal; only the quote itself needs escaping. */
function psString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * One argument as Windows will parse it: wrapped in double quotes, with any
 * inner double quote escaped. `Start-Process` joins the list with spaces and
 * does no quoting of its own.
 */
function windowsArgument(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

export function splitArguments(args: string | undefined): string[] {
  const trimmed = args?.trim();
  return trimmed ? trimmed.split(/\s+/) : [];
}

/**
 * The script `-EncodedCommand` runs. It exits 0 once Windows has started the
 * app, or 1 with the Win32 error code and message on stderr. The code comes
 * from the exception, not the message, because Windows writes the message in
 * the system language.
 */
export function buildStartProcessScript(input: StartProcessInput): string {
  const cwd = input.cwd?.trim() || path.win32.dirname(input.exePath);
  const args = splitArguments(input.args).map((a) => psString(windowsArgument(a)));
  const argumentList = args.length > 0 ? ` -ArgumentList ${args.join(',')}` : '';
  return [
    "$ErrorActionPreference = 'Stop'",
    "$ProgressPreference = 'SilentlyContinue'",
    'try {',
    `  Start-Process -FilePath ${psString(input.exePath)} -WorkingDirectory ${psString(cwd)}${argumentList}`,
    '  exit 0',
    '} catch {',
    '  $e = $_.Exception',
    '  while ($e -and -not ($e -is [System.ComponentModel.Win32Exception])) { $e = $e.InnerException }',
    '  $code = if ($e) { $e.NativeErrorCode } else { -1 }',
    '  [Console]::Error.WriteLine("$code $($_.Exception.Message)")',
    '  exit 1',
    '}',
  ].join('\n');
}

/** `-EncodedCommand` takes the script as base64 of UTF-16LE. */
export function encodePowerShellCommand(script: string): string {
  return Buffer.from(script, 'utf16le').toString('base64');
}

export type StartProcessFailure = 'FILE_MISSING' | 'ACCESS_DENIED' | 'CANCELLED' | 'SPAWN_FAILED';

/**
 * What the script's stderr says went wrong, from the Win32 code it leads with:
 * 2 and 3 are a missing file or folder, 5 is access denied (antivirus, folder
 * permissions), 1223 is the user closing the UAC prompt.
 */
export function classifyStartProcessFailure(stderr: string): StartProcessFailure {
  const code = Number(stderr.trim().split(/\s+/)[0]);
  switch (code) {
    case 2:
    case 3:
      return 'FILE_MISSING';
    case 5:
      return 'ACCESS_DENIED';
    case 1223:
      return 'CANCELLED';
    default:
      return 'SPAWN_FAILED';
  }
}
