import { isNewerVersion } from '@/lib/utils/versionCompare';
import type { UpdateChannel, UpdateStatus } from '@/types/update';

export const DOWNLOAD_PAGE_URL = 'https://x-dispatch.app/download/';

/** Channel name written into the manifests by publish-r2.sh. */
export type ManifestChannel = 'stable' | 'rc';

export interface ReleaseManifest {
  version: string;
  files: { name: string; url: string }[];
}

/** latest.json or latest-rc.json, or null when it is not a manifest of that channel. */
export function parseLatestManifest(
  json: string,
  channel: ManifestChannel
): ReleaseManifest | null {
  try {
    const payload = JSON.parse(json) as { tag?: unknown; channel?: unknown; files?: unknown };
    if (payload.channel !== channel || typeof payload.tag !== 'string') return null;
    const files = Array.isArray(payload.files)
      ? payload.files.filter(
          (f): f is { name: string; url: string } =>
            typeof f?.name === 'string' && typeof f?.url === 'string'
        )
      : [];
    return { version: payload.tag.replace(/^v/, ''), files };
  } catch {
    return null;
  }
}

/** The beta channel follows whichever of the two is newer; a stable release of the same version wins. */
export function pickUpdateTarget(
  stable: ReleaseManifest | null,
  rc: ReleaseManifest | null
): { manifest: ReleaseManifest; feed: ManifestChannel } | null {
  if (rc && (!stable || isNewerVersion(stable.version, rc.version))) {
    return { manifest: rc, feed: 'rc' };
  }
  return stable ? { manifest: stable, feed: 'stable' } : null;
}

const INSTALLER_SUFFIXES: Record<string, string> = {
  'darwin-arm64': '-mac-apple-silicon.dmg',
  'darwin-x64': '-mac-intel.dmg',
  'linux-x64': '-linux-x64.AppImage',
  'linux-arm64': '-linux-arm64.AppImage',
  'win32-x64': '-windows-x64.exe',
};

/** Direct installer link for this machine; the download page only lists stable releases. */
export function installerUrl(manifest: ReleaseManifest, platform: string, arch: string): string {
  const suffix = INSTALLER_SUFFIXES[`${platform}-${arch}`];
  const file = suffix && manifest.files.find((f) => f.name.endsWith(suffix));
  return file ? file.url : DOWNLOAD_PAGE_URL;
}

export interface UpdateStatusStore {
  get(): UpdateStatus;
  /** Merges the change and notifies listeners when a field actually changed. */
  patch(changes: Partial<UpdateStatus>): UpdateStatus;
  subscribe(listener: (status: UpdateStatus) => void): () => void;
}

export function createUpdateStatusStore(init: {
  managed: boolean;
  channel: UpdateChannel;
}): UpdateStatusStore {
  let status: UpdateStatus = {
    channel: init.channel,
    latestVersion: null,
    latestBetaVersion: null,
    url: DOWNLOAD_PAGE_URL,
    managed: init.managed,
    install: 'idle',
    installVersion: null,
    error: null,
  };
  const listeners = new Set<(status: UpdateStatus) => void>();

  return {
    get: () => status,
    patch(changes) {
      const next = { ...status, ...changes };
      const changed = (Object.keys(next) as (keyof UpdateStatus)[]).some(
        (key) => next[key] !== status[key]
      );
      if (!changed) return status;
      status = next;
      for (const listener of listeners) listener(status);
      return status;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
