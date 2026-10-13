import { describe, expect, it, vi } from 'vitest';
import {
  DOWNLOAD_PAGE_URL,
  createUpdateStatusStore,
  installerUrl,
  parseLatestManifest,
  pickUpdateTarget,
} from './updateStatus';

const manifest = (version: string, files: string[] = []) => ({
  version,
  files: files.map((name) => ({ name, url: `https://dl.example/${name}` })),
});

describe('parseLatestManifest', () => {
  it('strips the tag prefix and keeps the file list', () => {
    expect(
      parseLatestManifest(
        '{"tag":"v2.2.1","channel":"stable","files":[{"name":"a.exe","url":"https://x/a.exe"},{"name":1}]}',
        'stable'
      )
    ).toEqual({ version: '2.2.1', files: [{ name: 'a.exe', url: 'https://x/a.exe' }] });
  });

  it('rejects the other channel and malformed payloads', () => {
    expect(parseLatestManifest('{"tag":"v2.3.0-rc.1","channel":"rc"}', 'stable')).toBeNull();
    expect(parseLatestManifest('{"tag":"v2.2.1","channel":"stable"}', 'rc')).toBeNull();
    expect(parseLatestManifest('{"channel":"stable"}', 'stable')).toBeNull();
    expect(parseLatestManifest('not json', 'stable')).toBeNull();
  });
});

describe('pickUpdateTarget', () => {
  it('follows the beta while it is ahead of stable', () => {
    expect(pickUpdateTarget(manifest('2.5.0'), manifest('2.5.1-rc.1'))?.feed).toBe('rc');
  });

  it('falls back to stable once stable catches up or passes the beta', () => {
    expect(pickUpdateTarget(manifest('2.5.1'), manifest('2.5.1-rc.1'))?.feed).toBe('stable');
    expect(pickUpdateTarget(manifest('2.6.0'), manifest('2.5.1-rc.1'))?.feed).toBe('stable');
  });

  it('uses whichever manifest could be read', () => {
    expect(pickUpdateTarget(manifest('2.5.0'), null)?.feed).toBe('stable');
    expect(pickUpdateTarget(null, manifest('2.5.1-rc.1'))?.feed).toBe('rc');
    expect(pickUpdateTarget(null, null)).toBeNull();
  });
});

describe('installerUrl', () => {
  const beta = manifest('2.5.1-rc.1', [
    'X-Dispatch-2.5.1-rc.1-mac-apple-silicon.dmg',
    'X-Dispatch-2.5.1-rc.1-mac-intel.dmg',
    'X-Dispatch-2.5.1-rc.1-linux-x64.AppImage',
  ]);

  it('picks the installer for this platform and architecture', () => {
    expect(installerUrl(beta, 'darwin', 'arm64')).toBe(
      'https://dl.example/X-Dispatch-2.5.1-rc.1-mac-apple-silicon.dmg'
    );
    expect(installerUrl(beta, 'linux', 'x64')).toBe(
      'https://dl.example/X-Dispatch-2.5.1-rc.1-linux-x64.AppImage'
    );
  });

  it('falls back to the download page', () => {
    expect(installerUrl(beta, 'linux', 'arm64')).toBe(DOWNLOAD_PAGE_URL);
    expect(installerUrl(beta, 'freebsd', 'x64')).toBe(DOWNLOAD_PAGE_URL);
  });
});

describe('createUpdateStatusStore', () => {
  it('starts idle with the download page as fallback', () => {
    const store = createUpdateStatusStore({ managed: true, channel: 'stable' });
    expect(store.get()).toMatchObject({
      managed: true,
      install: 'idle',
      latestVersion: null,
      installVersion: null,
      error: null,
    });
    expect(store.get().url).toContain('x-dispatch.app');
  });

  it('notifies subscribers only when something changed', () => {
    const store = createUpdateStatusStore({ managed: false, channel: 'stable' });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.patch({ install: 'idle' });
    expect(listener).not.toHaveBeenCalled();

    store.patch({ latestVersion: '2.2.1' });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ latestVersion: '2.2.1' }));

    unsubscribe();
    store.patch({ install: 'checking' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps earlier fields when patching', () => {
    const store = createUpdateStatusStore({ managed: true, channel: 'stable' });
    store.patch({ latestVersion: '2.2.1' });
    store.patch({ install: 'ready', installVersion: '2.2.1' });
    expect(store.get()).toMatchObject({
      latestVersion: '2.2.1',
      install: 'ready',
      installVersion: '2.2.1',
    });
  });
});
