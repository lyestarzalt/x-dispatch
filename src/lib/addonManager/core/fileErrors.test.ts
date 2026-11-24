import { describe, expect, it } from 'vitest';
import { fileInUseError, isWindowsProgramFiles } from './fileErrors';

/** The error Node throws, with the fields the file system sets. */
function fsError(code: string, syscall: string, path: string): NodeJS.ErrnoException {
  return Object.assign(new Error(`${code}: operation not permitted, ${syscall} '${path}'`), {
    code,
    syscall,
    path,
  });
}

describe('fileInUseError', () => {
  // X-DISPATCH-9S: a scenery delete stopped on a PDF the user had open.
  it('names the file a viewer holds open in a scenery folder', () => {
    const e = fsError(
      'EPERM',
      'unlink',
      'D:\\Games\\X-Plane 12\\Custom Scenery\\DD_NY_Airports_v2_XP Documents\\KLGA_CHARTS.pdf'
    );
    expect(fileInUseError(e, 'win32')).toEqual({
      code: 'FILE_IN_USE',
      path: 'D:\\Games\\X-Plane 12\\Custom Scenery\\DD_NY_Airports_v2_XP Documents\\KLGA_CHARTS.pdf',
      fileName: 'KLGA_CHARTS.pdf',
      reason: e.message,
    });
  });

  // X-DISPATCH-7S: X-Plane had the plugin loaded while it was switched off.
  it('names the plugin X-Plane has loaded', () => {
    const e = fsError(
      'EPERM',
      'rename',
      'D:\\GAMES\\SteamLibrary\\steamapps\\common\\X-Plane 12\\Resources\\plugins\\SayIntentionsAI\\64\\win.xpl'
    );
    expect(fileInUseError(e, 'win32')?.fileName).toBe('win.xpl');
  });

  it('takes EBUSY as a file in use on every platform', () => {
    const e = fsError('EBUSY', 'unlink', '/Users/pilot/X-Plane 12/Custom Scenery/A/b.pdf');
    expect(fileInUseError(e, 'darwin')?.fileName).toBe('b.pdf');
  });

  it('leaves a protected Program Files folder to the permission message', () => {
    const e = fsError('EPERM', 'rename', 'C:\\Program Files\\X-Plane 12\\Aircraft\\A\\a.acf');
    expect(fileInUseError(e, 'win32')).toBeNull();
  });

  it('leaves a macOS permission refusal to the permission message', () => {
    const e = fsError('EPERM', 'unlink', '/Applications/X-Plane 12/Custom Scenery/A/b.pdf');
    expect(fileInUseError(e, 'darwin')).toBeNull();
  });

  it('only counts writes: a folder that cannot be listed is not a file in use', () => {
    const e = fsError('EPERM', 'scandir', 'D:\\X-Plane 12\\Aircraft\\A');
    expect(fileInUseError(e, 'win32')).toBeNull();
  });

  it('ignores errors that name no file', () => {
    expect(fileInUseError(new Error('boom'), 'win32')).toBeNull();
    expect(fileInUseError(undefined, 'win32')).toBeNull();
  });
});

describe('isWindowsProgramFiles', () => {
  it('matches both Program Files folders on any drive, either slash', () => {
    expect(isWindowsProgramFiles('C:\\Program Files\\X-Plane 12')).toBe(true);
    expect(isWindowsProgramFiles('D:/Program Files (x86)/X-Plane 12')).toBe(true);
    expect(isWindowsProgramFiles('D:\\Games\\X-Plane 12')).toBe(false);
  });
});
