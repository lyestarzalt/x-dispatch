import { net } from 'electron';
import logger from '@/lib/utils/logger';
import { getTileCache } from './index';

export interface TileResponse {
  status: number;
  contentType: string;
  body: Uint8Array | null;
  cacheHit: boolean;
}

/**
 * Serve a tile from the disk cache, or fetch it from the origin and cache it.
 * Shared by the `tile-cache://` protocol (desktop) and the `/tile-cache/` HTTP
 * route (tablets).
 */
export async function fetchCachedTile(originalUrl: string): Promise<TileResponse> {
  try {
    const cache = getTileCache();
    const cached = await cache.get(originalUrl);
    if (cached) {
      return {
        status: 200,
        contentType: cached.contentType,
        body: new Uint8Array(cached.data),
        cacheHit: true,
      };
    }
    const response = await net.fetch(originalUrl);
    if (!response.ok) {
      return { status: response.status, contentType: '', body: null, cacheHit: false };
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    cache.put(originalUrl, buffer, contentType);
    return { status: 200, contentType, body: new Uint8Array(buffer), cacheHit: false };
  } catch (err) {
    // Cache closed during shutdown or fetch failed: pass through to the origin.
    try {
      const response = await net.fetch(originalUrl);
      return {
        status: response.status,
        contentType: response.headers.get('content-type') || 'application/octet-stream',
        body: response.ok ? new Uint8Array(await response.arrayBuffer()) : null,
        cacheHit: false,
      };
    } catch (fetchErr) {
      // A tile the user's network can't reach is never a defect: the map skips it.
      // Warn with the message only; an Error argument would be forwarded to Sentry.
      logger.main.warn(`Tile fetch failed: ${originalUrl} (${(fetchErr as Error).message ?? err})`);
      return { status: 502, contentType: '', body: null, cacheHit: false };
    }
  }
}
