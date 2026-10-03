import { protocol } from 'electron';
import logger from '@/lib/utils/logger';
import { fetchCachedTile } from './fetchTile';

/**
 * Register the tile-cache:// scheme as privileged.
 * MUST be called before app.whenReady().
 */
export function registerTileCacheScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'tile-cache',
      privileges: {
        standard: false,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        bypassCSP: true,
      },
    },
  ]);
}

/**
 * Register the protocol handler for tile-cache:// URLs.
 * Must be called after app.whenReady() and after initTileCache().
 *
 * Reconstructs the original HTTPS URL from tile-cache://host/path,
 * checks disk cache, and either serves cached data or fetches from origin.
 */
export function registerTileCacheHandler(): void {
  protocol.handle('tile-cache', async (request) => {
    // Reconstruct original HTTPS URL: tile-cache://host/path → https://host/path
    const tile = await fetchCachedTile(request.url.replace('tile-cache://', 'https://'));
    if (!tile.body) return new Response(null, { status: tile.status });
    return new Response(new Uint8Array(tile.body), {
      status: 200,
      headers: { 'Content-Type': tile.contentType, 'X-Tile-Cache': tile.cacheHit ? 'HIT' : 'MISS' },
    });
  });

  logger.main.info('Tile cache protocol handler registered');
}
