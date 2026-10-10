import { describe, expect, it } from 'vitest';
import {
  WINDOWS_FMS_PROG_ID,
  findFmsFileInArgv,
  isFmsFileArg,
  macDocumentTypesInfo,
  windowsFmsRegistryCommands,
} from './fileAssociations';

describe('macDocumentTypesInfo', () => {
  it('declares the .fms type as an alternate handler with a matching UTI', () => {
    const info = macDocumentTypesInfo() as {
      CFBundleDocumentTypes: { LSHandlerRank: string; LSItemContentTypes: string[] }[];
      UTImportedTypeDeclarations: {
        UTTypeIdentifier: string;
        UTTypeTagSpecification: Record<string, string[]>;
      }[];
    };
    const [doc] = info.CFBundleDocumentTypes;
    const [uti] = info.UTImportedTypeDeclarations;
    expect(doc!.LSHandlerRank).toBe('Alternate');
    expect(doc!.LSItemContentTypes).toEqual([uti!.UTTypeIdentifier]);
    expect(uti!.UTTypeTagSpecification['public.filename-extension']).toEqual(['fms']);
  });
});

describe('windowsFmsRegistryCommands', () => {
  const exe = 'C:\\Users\\Pilot\\AppData\\Local\\XDispatch\\app-2.3.1\\x-dispatch.exe';
  const commands = windowsFmsRegistryCommands(exe);

  it('writes only under the current user', () => {
    for (const command of commands) {
      expect(command[0]).toMatch(/^HKCU\\Software\\Classes\\/);
      expect(command).toContain('/f');
    }
  });

  it('points the open command at the exe with the file argument quoted', () => {
    const open = commands.find((c) => c[0]!.endsWith('shell\\open\\command'))!;
    expect(open[open.indexOf('/d') + 1]).toBe(`"${exe}" "%1"`);
  });

  it('adds an Open With entry and never sets the .fms default', () => {
    const ext = commands.filter((c) => c[0]!.includes('\\.fms'));
    expect(ext).toHaveLength(1);
    expect(ext[0]![0]).toBe('HKCU\\Software\\Classes\\.fms\\OpenWithProgids');
    expect(ext[0]).toContain(WINDOWS_FMS_PROG_ID);
  });
});

describe('isFmsFileArg', () => {
  it('accepts absolute .fms paths on every platform', () => {
    expect(isFmsFileArg('/Users/pilot/Documents/DAAG-LFPG.fms')).toBe(true);
    expect(isFmsFileArg('C:\\Plans\\DAAG-LFPG.FMS')).toBe(true);
    expect(isFmsFileArg('\\\\nas\\plans\\a.fms')).toBe(true);
  });

  it('rejects switches, relative paths and other extensions', () => {
    expect(isFmsFileArg('--reset-cache')).toBe(false);
    expect(isFmsFileArg('plan.fms')).toBe(false);
    expect(isFmsFileArg('/Users/pilot/plan.fms.exe')).toBe(false);
    expect(isFmsFileArg('/Users/pilot/plan.txt')).toBe(false);
  });
});

describe('findFmsFileInArgv', () => {
  it('finds the file among launcher switches', () => {
    expect(findFmsFileInArgv(['x-dispatch', '--allow-file-access', '/tmp/a.fms'])).toBe(
      '/tmp/a.fms'
    );
    expect(findFmsFileInArgv(['x-dispatch', 'xdispatch://logs'])).toBeNull();
  });
});
