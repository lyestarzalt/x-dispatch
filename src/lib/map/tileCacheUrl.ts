/**
 * Tiles go through the desktop's disk cache. In the Electron window that is the
 * `tile-cache://` protocol; in a browser on another device it is the same
 * cache behind the `/tile-cache/` route of the tablet access server.
 */
import { TILE_PATH_PREFIX } from '@/lib/remote/protocol';

export function isRemoteClient(): boolean {
  return typeof window !== 'undefined' && window.appAPI?.isRemoteClient === true;
}

export function toTileCacheUrl(httpsUrl: string): string {
  const rest = httpsUrl.replace(/^https:\/\//, '');
  return isRemoteClient() ? `${location.origin}${TILE_PATH_PREFIX}${rest}` : `tile-cache://${rest}`;
}
