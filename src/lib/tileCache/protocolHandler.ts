import { net, protocol } from 'electron';
import logger from '@/lib/utils/logger';
import { getTileCache } from './index';

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
    const originalUrl = request.url.replace('tile-cache://', 'https://');

    try {
      const cache = getTileCache();

      // Try cache first
      const cached = await cache.get(originalUrl);
      if (cached) {
        return new Response(new Uint8Array(cached.data), {
          status: 200,
          headers: {
            'Content-Type': cached.contentType,
            'X-Tile-Cache': 'HIT',
          },
        });
      }

      // Cache miss — fetch from origin
      const response = await net.fetch(originalUrl);

      if (!response.ok) {
        return new Response(null, { status: response.status, statusText: response.statusText });
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentType = response.headers.get('content-type') || 'application/octet-stream';

      // Store in cache
      cache.put(originalUrl, buffer, contentType);

      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'X-Tile-Cache': 'MISS',
        },
      });
    } catch (err) {
      // Cache closed during shutdown or fetch failed — passthrough to origin
      try {
        return await net.fetch(originalUrl);
      } catch {
        logger.main.error(`Tile cache fetch failed: ${originalUrl}`, err);
        return new Response(null, { status: 502, statusText: 'Tile fetch failed' });
      }
    }
  });

  logger.main.info('Tile cache protocol handler registered');
}
