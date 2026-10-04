import type { UpdateStatus } from '@/types/update';

export const DOWNLOAD_PAGE_URL = 'https://x-dispatch.app/download/';

/** Version named by latest.json, or null when it is not a stable release manifest. */
export function parseLatestStableVersion(json: string): string | null {
  try {
    const payload = JSON.parse(json) as { tag?: unknown; channel?: unknown };
    if (payload.channel !== 'stable' || typeof payload.tag !== 'string') return null;
    return payload.tag.replace(/^v/, '');
  } catch {
    return null;
  }
}

export interface UpdateStatusStore {
  get(): UpdateStatus;
  /** Merges the change and notifies listeners when a field actually changed. */
  patch(changes: Partial<UpdateStatus>): UpdateStatus;
  subscribe(listener: (status: UpdateStatus) => void): () => void;
}

export function createUpdateStatusStore(init: { managed: boolean }): UpdateStatusStore {
  let status: UpdateStatus = {
    latestVersion: null,
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
