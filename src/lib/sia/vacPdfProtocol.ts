import { net, protocol } from 'electron';
import * as fs from 'fs';
import { pathToFileURL } from 'url';
import logger from '@/lib/utils/logger';
import { getChartStore } from './chartStore';

/** vac-pdf://LFPO/chart.pdf — stream VAC PDF from local SIA install (no IPC blob copy). */
export function registerVacPdfScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'vac-pdf',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        bypassCSP: true,
      },
    },
  ]);
}

export function registerVacPdfHandler(): void {
  protocol.handle('vac-pdf', async (request) => {
    try {
      const url = new URL(request.url);
      const icao = url.hostname.toUpperCase();
      if (!icao) return new Response(null, { status: 400 });

      const pdfPath = getChartStore().getVacPdfPath(icao);
      if (!pdfPath || !fs.existsSync(pdfPath)) {
        return new Response(null, { status: 404 });
      }

      return net.fetch(pathToFileURL(pdfPath).href);
    } catch (err) {
      logger.main.error('vac-pdf protocol error', err);
      return new Response(null, { status: 500 });
    }
  });

  logger.main.info('VAC PDF protocol handler registered');
}
