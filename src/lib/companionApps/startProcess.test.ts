import { describe, expect, it } from 'vitest';
import {
  buildStartProcessScript,
  classifyStartProcessFailure,
  encodePowerShellCommand,
  splitArguments,
  windowsPowerShellPath,
} from './startProcess';

describe('windowsPowerShellPath', () => {
  it('points at Windows PowerShell 5.1 under SystemRoot', () => {
    expect(windowsPowerShellPath({ SystemRoot: 'D:\\Win' })).toBe(
      'D:\\Win\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
    );
    expect(windowsPowerShellPath({})).toBe(
      'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
    );
  });
});

describe('buildStartProcessScript', () => {
  it('starts the app in its own folder when no working directory is set', () => {
    const script = buildStartProcessScript({ exePath: 'C:\\Tools\\XPME\\xpme.exe' });
    expect(script).toContain(
      "Start-Process -FilePath 'C:\\Tools\\XPME\\xpme.exe' -WorkingDirectory 'C:\\Tools\\XPME'"
    );
    expect(script).not.toContain('-ArgumentList');
  });

  it('passes each argument double-quoted, as Windows parses a command line', () => {
    const script = buildStartProcessScript({
      exePath: 'C:\\a\\b.exe',
      args: '  --port 8086   --name=x  ',
      cwd: 'D:\\work',
    });
    expect(script).toContain(
      `-WorkingDirectory 'D:\\work' -ArgumentList '"--port"','"8086"','"--name=x"'`
    );
  });

  it('escapes a single quote in a path, the only character PowerShell needs escaped', () => {
    const script = buildStartProcessScript({ exePath: "C:\\Users\\O'Neil\\tool.exe" });
    expect(script).toContain("-FilePath 'C:\\Users\\O''Neil\\tool.exe'");
  });

  it('keeps a hostile path or argument inside its string literal', () => {
    // Values come from settings, or from a tablet over the network. Inside a
    // PowerShell single-quoted string nothing is special but the quote itself,
    // so `$`, backticks, `;` and newlines stay text.
    const exePath = "C:\\x'; Remove-Item -Recurse C:\\ ; '$env:TEMP`n";
    const script = buildStartProcessScript({ exePath, args: "a'b $(Get-Date) ;c", cwd: "D:\\';" });
    expect(script).toContain("-FilePath 'C:\\x''; Remove-Item -Recurse C:\\ ; ''$env:TEMP`n'");
    expect(script).toContain("-WorkingDirectory 'D:\\'';'");
    expect(script).toContain(`-ArgumentList '"a''b"','"$(Get-Date)"','";c"'`);
    // Every value is one literal: the quotes pair up and no statement separator is loose.
    const launchLine = script.split('\n').find((l) => l.includes('Start-Process'))!;
    expect(launchLine.split("'").length % 2).toBe(1);
  });

  it('reports the Win32 code before the message, so the reason survives a localized Windows', () => {
    const script = buildStartProcessScript({ exePath: 'C:\\x.exe' });
    expect(script).toContain('[System.ComponentModel.Win32Exception]');
    expect(script).toContain('[Console]::Error.WriteLine("$code $($_.Exception.Message)")');
    expect(script).toContain('exit 1');
  });
});

describe('encodePowerShellCommand', () => {
  it('encodes UTF-16LE as -EncodedCommand expects', () => {
    expect(encodePowerShellCommand('exit 0')).toBe(
      Buffer.from('exit 0', 'utf16le').toString('base64')
    );
    expect(Buffer.from(encodePowerShellCommand('ü'), 'base64').toString('utf16le')).toBe('ü');
  });
});

describe('splitArguments', () => {
  it('splits on whitespace and ignores blanks', () => {
    expect(splitArguments(undefined)).toEqual([]);
    expect(splitArguments('   ')).toEqual([]);
    expect(splitArguments(' -a  -b ')).toEqual(['-a', '-b']);
  });
});

describe('classifyStartProcessFailure', () => {
  it('reads the Win32 code the script leads with', () => {
    expect(classifyStartProcessFailure('2 The system cannot find the file specified')).toBe(
      'FILE_MISSING'
    );
    expect(classifyStartProcessFailure('3 Le chemin d’accès spécifié est introuvable')).toBe(
      'FILE_MISSING'
    );
    expect(classifyStartProcessFailure('5 Access is denied')).toBe('ACCESS_DENIED');
    expect(classifyStartProcessFailure('1223 The operation was canceled by the user')).toBe(
      'CANCELLED'
    );
  });

  it('falls back to a plain failure for anything else', () => {
    expect(classifyStartProcessFailure('-1 Something')).toBe('SPAWN_FAILED');
    expect(classifyStartProcessFailure('')).toBe('SPAWN_FAILED');
  });
});
