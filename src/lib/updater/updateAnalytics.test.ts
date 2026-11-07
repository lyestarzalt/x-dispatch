import { describe, expect, it } from 'vitest';
import { detectInstallKind, downloadedUpdateFacts, updateFailureReason } from './updateAnalytics';

const packaged = {
  isPackaged: true,
  velopack: false,
  platform: 'win32' as NodeJS.Platform,
  squirrelUpdaterExists: false,
  appImage: undefined,
};

describe('detectInstallKind', () => {
  it('names Velopack installs first, whatever else is around them', () => {
    expect(detectInstallKind({ ...packaged, velopack: true, squirrelUpdaterExists: true })).toBe(
      'velopack'
    );
  });

  it('names the installers from before Velopack', () => {
    expect(detectInstallKind({ ...packaged, squirrelUpdaterExists: true })).toBe('squirrel');
    expect(detectInstallKind({ ...packaged, platform: 'darwin' })).toBe('forge_dmg');
    expect(detectInstallKind({ ...packaged, platform: 'linux', appImage: '/a/X.AppImage' })).toBe(
      'appimage_legacy'
    );
  });

  it('separates dev runs and copies with no installer', () => {
    expect(detectInstallKind({ ...packaged, isPackaged: false, velopack: true })).toBe('dev');
    expect(detectInstallKind(packaged)).toBe('other');
  });
});

describe('updateFailureReason', () => {
  it('sorts updater errors into a few causes', () => {
    expect(updateFailureReason('Network error: Http error: http status: 404')).toBe('not_found');
    expect(updateFailureReason('Network error: dns error: no such host')).toBe('network');
    expect(updateFailureReason('Operation timed out')).toBe('network');
  });

  it('reads the network failures Windows reports in other languages', () => {
    expect(
      updateFailureReason(
        'Network error: Http error: io: Der angegebene Host ist unbekannt. (os error 11001)'
      )
    ).toBe('network');
    expect(
      updateFailureReason('Network error: Http error: io: Hôte inconnu. (os error 11001)')
    ).toBe('network');
    expect(updateFailureReason("IO error: cannot decrypt peer's message")).toBe('network');
    expect(updateFailureReason('IO error: Peer disconnected')).toBe('network');
    expect(updateFailureReason('Network error: Http error: io: unexpected end of file')).toBe(
      'network'
    );
    expect(updateFailureReason('Network error: Http error: http status: 404')).toBe('not_found');
    expect(updateFailureReason('Failed to apply delta')).toBe('other');
    expect(updateFailureReason('Checksum mismatch')).toBe('other');
  });
});

describe('downloadedUpdateFacts', () => {
  it('reports a delta update by the size of its deltas', () => {
    const facts = downloadedUpdateFacts({
      DeltasToTarget: [{ Size: 157_000 }, { Size: 3_000_000 }],
      TargetFullRelease: { Size: 200_000_000 },
    });
    expect(facts).toEqual({ kind: 'delta', size_mb: 4 });
  });

  it('reports a full update by the package size', () => {
    const facts = downloadedUpdateFacts({
      DeltasToTarget: [],
      TargetFullRelease: { Size: 201_945_465 },
    });
    expect(facts).toEqual({ kind: 'full', size_mb: 193 });
  });
});
