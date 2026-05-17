import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, FileText, Printer } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { Button } from '@/components/ui/button';
import { renderVacPdfToPng } from '@/lib/sia/pdfToPng';
import type { AirportGeorefInput } from '@/lib/sia/georef';
import { useVacChartQuery, useSiaInstallStatusQuery } from '@/queries/useSiaQuery';
import { useAppStore } from '@/stores/appStore';
import type { ParsedAirport } from '@/types/apt';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

function buildGeorefInput(airport: ParsedAirport): AirportGeorefInput {
  const runways = airport.runways
    ?.map((r) => {
      const ends = r.ends ?? [];
      const e0 = ends[0];
      const e1 = ends[1] ?? ends[0];
      if (!e0 || !e1) return null;
      return {
        lat1: e0.latitude,
        lon1: e0.longitude,
        lat2: e1.latitude,
        lon2: e1.longitude,
        lengthM: 0,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return { lat: airport.latitude, lon: airport.longitude, runways };
}

export default function VacTab() {
  const { t } = useTranslation();
  const airport = useAppStore((s) => s.selectedAirportData);
  const icao = useAppStore((s) => s.selectedICAO);
  const { data: status } = useSiaInstallStatusQuery();
  const georefInput = airport ? buildGeorefInput(airport) : null;
  const { data: vacInfo, isLoading } = useVacChartQuery(icao, georefInput);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const loadPdf = useCallback(async () => {
    if (!icao || !canvasRef.current) return;
    setPdfError(null);
    const bytes = await window.siaAPI.getVacPdfBytes(icao);
    if (!bytes) {
      setPdfError(t('vac.notFound'));
      return;
    }
    try {
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.2 });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const png = await renderVacPdfToPng(bytes, 1.5);
      await window.siaAPI.writePngCache(icao, png);
    } catch (err) {
      setPdfError((err as Error).message);
    }
  }, [icao, t]);

  useEffect(() => {
    if (vacInfo) void loadPdf();
  }, [vacInfo, loadPdf]);

  if (!status?.hasData) {
    return (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>{t('vac.noData')}</p>
        <p className="text-xs">{t('sia.attribution')}</p>
      </div>
    );
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;
  }

  if (!vacInfo) {
    return (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>{t('vac.notFound')}</p>
        <p className="text-xs">{t('sia.attribution')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">{t('vac.cycle', { cycle: vacInfo.cycle })}</span>
        {vacInfo.validFrom && vacInfo.validTo && (
          <span>
            {vacInfo.validFrom} → {vacInfo.validTo}
          </span>
        )}
      </div>

      <div className="overflow-auto rounded-md border border-border/40 bg-background/50">
        <canvas ref={canvasRef} className="max-w-full" />
      </div>

      {pdfError && <p className="text-xs text-destructive">{pdfError}</p>}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => icao && void window.siaAPI.openVacPdf(icao)}
        >
          <FileText className="h-3.5 w-3.5" />
          {t('vac.openExternal')}
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" />
          {t('vac.print')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() =>
            void window.appAPI.openExternal(
              'https://www.sia.aviation-civile.gouv.fr/produits-numeriques-en-libre-disposition/eaip.html'
            )
          }
        >
          <ExternalLink className="h-3.5 w-3.5" />
          SIA
        </Button>
      </div>

      <p className="text-[10px] leading-snug text-muted-foreground">{t('sia.attribution')}</p>
    </div>
  );
}
