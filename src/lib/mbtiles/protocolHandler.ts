import { protocol } from 'electron';
import logger from '@/lib/utils/logger';
import { getMbtilesReader } from './MbtilesStore';

export function registerMbtilesScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'mbtiles',
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
 * URL: mbtiles://tile/{z}/{x}/{y}
 */
export function registerMbtilesHandler(): void {
  protocol.handle('mbtiles', async (request) => {
    try {
      const url = new URL(request.url);
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] !== 'tile' || parts.length < 4) {
        return new Response(null, { status: 400 });
      }
      const z = parseInt(parts[1]!, 10);
      const x = parseInt(parts[2]!, 10);
      const y = parseInt(parts[3]!, 10);
      if (Number.isNaN(z) || Number.isNaN(x) || Number.isNaN(y)) {
        return new Response(null, { status: 400 });
      }

      const reader = getMbtilesReader();
      if (!reader) {
        return new Response(null, { status: 404 });
      }

      const tile = reader.getTile(z, x, y);
      if (!tile) {
        return new Response(null, { status: 204 });
      }

      const meta = reader.getMetadata();
      const format = (meta.format ?? 'png').toLowerCase();
      const contentType =
        format === 'jpg' || format === 'jpeg'
          ? 'image/jpeg'
          : format === 'webp'
            ? 'image/webp'
            : 'image/png';

      return new Response(new Uint8Array(tile), {
        status: 200,
        headers: { 'Content-Type': contentType },
      });
    } catch (err) {
      logger.main.error('mbtiles protocol error', err);
      return new Response(null, { status: 500 });
    }
  });

  logger.main.info('MBTiles protocol handler registered');
}
