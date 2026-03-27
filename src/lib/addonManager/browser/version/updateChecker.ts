import type { AircraftInfo, PluginInfo } from '../../core/types';

const UPDATE_CACHE_DURATION = 60 * 60 * 1000; // 1 hour
const MAX_CACHE_SIZE = 500;

interface UpdateCacheEntry {
  latestVersion: string | undefined;
  timestamp: number;
}

const updateCache = new Map<string, UpdateCacheEntry>();

/**
 * Check for updates for items with updateUrl.
 * Mutates items in place with latestVersion and hasUpdate.
 * Skips items where cfgDisabled is true.
 */
export async function checkUpdates(items: (AircraftInfo | PluginInfo)[]): Promise<void> {
  const itemsWithUrl = items.filter((i) => i.updateUrl && i.version && !i.cfgDisabled);

  const results = await Promise.allSettled(
    itemsWithUrl.map(async (item) => {
      const cached = getCachedVersion(item.updateUrl!);
      if (cached !== undefined) {
        return { folderName: item.folderName, remoteVersion: cached };
      }

      const remoteVersion = await fetchRemoteVersion(item.updateUrl!);
      setCachedVersion(item.updateUrl!, remoteVersion);
      return { folderName: item.folderName, remoteVersion };
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.remoteVersion) {
      const item = items.find((i) => i.folderName === result.value.folderName);
      if (item) {
        item.latestVersion = result.value.remoteVersion;
        item.hasUpdate = item.version !== result.value.remoteVersion;
      }
    }
  }
}

/**
 * Validate URL is safe to fetch (https only, no internal/localhost).
 */
function isValidUpdateUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    // Only allow https
    if (url.protocol !== 'https:') {
      return false;
    }
    // Block localhost and internal IPs
    const host = url.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      host.startsWith('172.16.') ||
      host.endsWith('.local')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch remote version from skunkcrafts_updater.cfg.
 */
async function fetchRemoteVersion(baseUrl: string): Promise<string | undefined> {
  try {
    const url = `${baseUrl}/skunkcrafts_updater.cfg`;

    // Security: validate URL before fetching
    if (!isValidUpdateUrl(url)) {
      return undefined;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return undefined;

    const text = await response.text();

    for (const line of text.split('\n')) {
      if (line.trim().startsWith('version|')) {
        return line.trim().slice('version|'.length).trim();
      }
    }
  } catch {
    // Ignore fetch errors
  }
  return undefined;
}

/**
 * Get cached version (undefined = cache miss).
 */
function getCachedVersion(updateUrl: string): string | undefined {
  const entry = updateCache.get(updateUrl);
  if (!entry) return undefined;

  if (Date.now() - entry.timestamp > UPDATE_CACHE_DURATION) {
    updateCache.delete(updateUrl);
    return undefined;
  }

  return entry.latestVersion;
}

/**
 * Cache a version result.
 */
function setCachedVersion(updateUrl: string, version: string | undefined): void {
  if (updateCache.size >= MAX_CACHE_SIZE) {
    evictCache();
  }

  updateCache.set(updateUrl, {
    latestVersion: version,
    timestamp: Date.now(),
  });
}

/**
 * Evict old cache entries.
 */
function evictCache(): void {
  const now = Date.now();

  // Remove expired first
  for (const [key, entry] of updateCache) {
    if (now - entry.timestamp > UPDATE_CACHE_DURATION) {
      updateCache.delete(key);
    }
  }

  // If still too big, remove oldest 10%
  if (updateCache.size >= MAX_CACHE_SIZE) {
    const sorted = [...updateCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = Math.max(10, Math.floor(updateCache.size * 0.1));
    for (let i = 0; i < toRemove; i++) {
      const entry = sorted[i];
      if (entry) updateCache.delete(entry[0]);
    }
  }
}
