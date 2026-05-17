import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, FileText, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AirportGeorefInput } from '@/lib/sia/georef';
import { useVacChartQuery, useSiaInstallStatusQuery } from '@/queries/useSiaQuery';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/stores/appStore';
import type { ParsedAirport } from '@/types/apt';

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
  const queryClient = useQueryClient();
  const airport = useAppStore((s) => s.selectedAirportData);
  const selectedIcao = useAppStore((s) => s.selectedICAO);
  const icao = selectedIcao ?? airport?.id ?? null;
  const { data: status } = useSiaInstallStatusQuery();
  const georefInput = useMemo(
    () => (airport ? buildGeorefInput(airport) : null),
    [airport]
  );
  const { data: vacInfo, isLoading, isFetching, refetch } = useVacChartQuery(icao, georefInput);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const blobUrlRef = useRef<string | null>(null);
  const reindexedRef = useRef(false);

  const clearPreview = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  const showPngPreview = useCallback(
    (bytes: Uint8Array) => {
      clearPreview();
      const blob = new Blob([Uint8Array.from(bytes)], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      setPreviewUrl(url);
    },
    [clearPreview]
  );

  const loadPreview = useCallback(async () => {
    if (!icao || !vacInfo) return;
    setPreviewError(null);
    setLoadingPreview(true);
    clearPreview();

    try {
      let png = await window.siaAPI.getVacPngBytes(icao);
      if (!png?.length) {
        png = await window.siaAPI.renderVacPng(icao);
      }
      if (png?.length) {
        showPngPreview(png);
        return;
      }

      setPreviewError(t('vac.notFound'));
    } catch (err) {
      setPreviewError((err as Error).message);
    } finally {
      setLoadingPreview(false);
    }
  }, [icao, vacInfo, t, clearPreview, showPngPreview]);

  useLayoutEffect(() => {
    if (vacInfo) void loadPreview();
    else clearPreview();
  }, [vacInfo, loadPreview, clearPreview]);

  useEffect(() => {
    if (vacInfo || !status?.hasData || !icao || reindexedRef.current) return;
    reindexedRef.current = true;
    void (async () => {
      await window.siaAPI.reindexVac();
      void queryClient.invalidateQueries({ queryKey: ['sia'] });
      void refetch();
    })();
  }, [vacInfo, status?.hasData, icao, queryClient, refetch]);

  useEffect(() => () => clearPreview(), [clearPreview]);

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
        <p className="text-xs">{t('vac.notFoundHint')}</p>
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
        {loadingPreview ? (
          <p className="p-4 text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : previewUrl ? (
          <img src={previewUrl} alt={`VAC ${vacInfo.icao}`} className="max-w-full" />
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            {previewError ?? t('vac.notFound')}
          </p>
        )}
      </div>

      {previewError && <p className="text-xs text-destructive">{previewError}</p>}

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
