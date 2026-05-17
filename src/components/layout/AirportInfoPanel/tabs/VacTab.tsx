import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, FileText, Printer } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Button } from '@/components/ui/button';
import { renderVacPdfToPng } from '@/lib/sia/pdfToPng';
import type { AirportGeorefInput } from '@/lib/sia/georef';
import { useVacChartQuery, useSiaInstallStatusQuery } from '@/queries/useSiaQuery';
import { useAppStore } from '@/stores/appStore';
import type { ParsedAirport } from '@/types/apt';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

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
  const selectedIcao = useAppStore((s) => s.selectedICAO);
  const icao = airport?.id ?? selectedIcao;
  const { data: status } = useSiaInstallStatusQuery();
  const georefInput = useMemo(
    () => (airport ? buildGeorefInput(airport) : null),
    [airport]
  );
  const { data: vacInfo, isLoading, isFetching } = useVacChartQuery(icao, georefInput);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const previewUrlRef = useRef<string | null>(null);

  const clearPreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  const setPreviewFromBytes = useCallback(
    (bytes: Uint8Array) => {
      clearPreviewUrl();
      const blob = new Blob([Uint8Array.from(bytes)], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setPreviewUrl(url);
    },
    [clearPreviewUrl]
  );

  const loadPreview = useCallback(async () => {
    if (!icao || !vacInfo) return;
    setPdfError(null);
    setRendering(true);
    clearPreviewUrl();

    try {
      const cached = await window.siaAPI.getVacPngBytes(icao);
      if (cached?.length) {
        setPreviewFromBytes(cached);
        return;
      }

      const pdfBytes = await window.siaAPI.getVacPdfBytes(icao);
      if (!pdfBytes?.length) {
        setPdfError(t('vac.notFound'));
        return;
      }

      const png = await renderVacPdfToPng(pdfBytes, 1.5);
      await window.siaAPI.writePngCache(vacInfo.icao, png);
      setPreviewFromBytes(png);
    } catch (err) {
      setPdfError((err as Error).message);
    } finally {
      setRendering(false);
    }
  }, [icao, vacInfo, t, clearPreviewUrl, setPreviewFromBytes]);

  useLayoutEffect(() => {
    if (vacInfo) void loadPreview();
    else clearPreviewUrl();
  }, [vacInfo, loadPreview, clearPreviewUrl]);

  useEffect(() => () => clearPreviewUrl(), [clearPreviewUrl]);

  if (!status?.hasData) {
    return (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>{t('vac.noData')}</p>
        <p className="text-xs">{t('sia.attribution')}</p>
      </div>
    );
  }

  if (isLoading || (isFetching && !vacInfo)) {
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
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono uppercase">{vacInfo.chartType}</span>
      </div>

      <div className="overflow-auto rounded-md border border-border/40 bg-background/50 p-1">
        {previewUrl ? (
          <img src={previewUrl} alt={`VAC ${vacInfo.icao}`} className="max-w-full" />
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            {rendering ? t('common.loading') : pdfError ?? t('vac.notFound')}
          </p>
        )}
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
