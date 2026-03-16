import { net, protocol } from 'electron';
import logger from '@/lib/utils/logger';
import { getTileCache } from './index';

// 1×1 transparent PNG (67 bytes) — returned for missing/failed DEM tiles so MapLibre
// doesn't permanently mark them as errored (it never retries failed raster-dem tiles,
// which cascades and kills the entire hillshade/terrain source).
const EMPTY_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x62, 0x00, 0x00, 0x00, 0x02,
  0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42,
  0x60, 0x82,
]);

function emptyDemResponse(): Response {
  return new Response(EMPTY_PNG, {
    status: 200,
    headers: { 'Content-Type': 'image/png', 'X-Tile-Cache': 'EMPTY' },
  });
}

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
    const isDemTile = originalUrl.includes('mapterhorn.com');

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
        // DEM tiles: return empty image instead of error to prevent MapLibre from
        // permanently marking the tile as failed (it never retries raster-dem errors)
        if (isDemTile) return emptyDemResponse();
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
        if (isDemTile) return emptyDemResponse();
        return new Response(null, { status: 502, statusText: 'Tile fetch failed' });
      }
    }
  });

  logger.main.info('Tile cache protocol handler registered');
}
